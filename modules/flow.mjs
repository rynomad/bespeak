import Node from "http://localhost:3004/modules/node.mjs";

import {
    combineLatest,
    of,
    map,
    merge,
    pipe,
    tap,
    take,
    switchMap,
    shareReplay,
    withLatestFrom,
    catchError,
    zip,
    pluck,
    takeUntil,
    distinctUntilChanged,
    filter,
} from "rxjs";

import { deepEqual } from "https://esm.sh/fast-equals";
import { pluginMissing } from "rxdb";
import { jsonDefault } from "https://esm.sh/v134/json-schema-default@1.0.1/denonext/json-schema-default.mjs";

export const key = "flow";
export const version = "0.0.1";
export const description = `Description of what the flow operator does.`;

const getIOSchema = (role, { node, config }) => {
    if (!config?.nodes) {
        return of({
            type: "object",
            properties: {
                name: {
                    type: "string",
                    description: "The name of the internal node.",
                },
                payload: {
                    type: "object",
                    description: "The payload of the internal node.",
                    additionalProperties: true,
                },
            },
        });
    }

    return of(
        config.nodes.map(({ system }) => new Node(`${system.name}-${node.id}}`))
    ).pipe(
        switchMap((nodes) => {
            return combineLatest({
                schemas: combineLatest(
                    nodes.map((node) => node.schema$$(role))
                ),
                nodes: combineLatest(
                    nodes.map((node) =>
                        node.read$$("system").pipe(filter((e) => e?.name))
                    )
                ),
            });
        }),
        map(({ schemas, nodes }) => {
            return {
                type: "object",
                properties: {
                    name: {
                        type: "string",
                        enum: nodes.map((node) => node.name),
                        description: "The name of the internal node.",
                    },
                    payload: {
                        oneOf: schemas.map((schema, index) => {
                            return {
                                title: nodes[index].id,
                                ...schema,
                            };
                        }),
                    },
                },
                // Define the properties of your input schema here
            };
        })
    );
};

export function inputSchema({ node, config }) {
    return getIOSchema("process:input", { node, config });
}

export function outputSchema({ node, config }) {
    return getIOSchema("process:output", { node, config });
}

export function configSchema({ node }) {
    return node.tool$$("system:imports").pipe(
        switchMap((imports) => {
            return of({}).pipe(
                imports.operator(),
                switchMap((map) => {
                    console.log("GOT IMPORTS MAP", map);
                    return combineLatest(Array.from(map.values()));
                })
            );
        }),
        map((imports) => {
            console.log("GOT IMPORTS", imports);
            return imports.filter((i) => i.key !== "flow");
        }),
        switchMap((imports) => {
            return zip(
                of(imports),
                of(imports).pipe(
                    switchMap((imports) =>
                        zip(
                            imports.map(({ key, version, configSchema }) =>
                                configSchema
                                    ? configSchema({ node }).pipe(
                                          map((schema) => ({
                                              title: `process Schema for ${key}@${version}`,
                                              ...schema,
                                          }))
                                      )
                                    : of({
                                          type: "object",
                                          title: `process Schema for ${key}@${version}`,
                                          additionalProperties: true,
                                      })
                            )
                        ).pipe(take(1))
                    )
                )
            );
        }),
        map(([modules, processSchemas]) => {
            const schema = {
                type: "object",
                description: "nodes and connections.",
                additionalProperties: true,
                properties: {
                    nodes: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                system: {
                                    type: "object",
                                    properties: {
                                        process: {
                                            description:
                                                "which process operator to use.",
                                            type: "string",
                                            enum: modules.map(
                                                (i) => `${i.key}@${i.version}`
                                            ),
                                            default: "chat-gpt@0.0.1",
                                        },
                                        ingress: {
                                            type: "string",
                                            description:
                                                "the ingress operator.",
                                            default: "default-ingress@0.0.1",
                                        },
                                        name: {
                                            type: "string",
                                        },
                                        description: {
                                            type: "string",
                                        },
                                    },
                                    required: ["name"],
                                },
                                processConfig: {
                                    type: "object",
                                    anyOf: processSchemas,
                                },
                                ingressConfig: {
                                    type: "object",
                                    additionalProperties: true,
                                },
                                tools: {
                                    type: "array",
                                    description:
                                        "A list of other nodes in the flow that this node should use as tools.",
                                    items: {
                                        type: "string",
                                        description:
                                            "The system.name of the node.",
                                    },
                                },
                            },
                        },
                    },
                    connections: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                from: {
                                    type: "string",
                                    description:
                                        "The name of the upstream node.",
                                },
                                to: {
                                    type: "string",
                                    description:
                                        "The name of the downstream node.",
                                },
                            },
                            required: ["from", "to"],
                        },
                    },
                },
                // Define the properties of your config schema here
            };

            return schema;
        })
    );
}

const NODES = new Map();

const createSessionNode = ({ node, name, id }) => {
    const nonce = Math.random().toString(36).substring(2, 15);
    const _node = new Node(id);
    NODES.set(id, _node);

    node.destroy$.subscribe(() => {
        _node.destroy$.next();
    });

    _node.destroy$.subscribe(() => {
        NODES.delete(id);
    });

    _node.destroy$.subscribe(() => {
        NODES.delete(id);
    });

    _node.status$.pipe(takeUntil(_node.destroy$)).subscribe((status) => {
        node.status$.next({
            status: "subnode-status",
            detail: status,
        });
    });

    const flowNodeConfig = combineLatest({
        system: _node.read$$("system").pipe(
            map(({ name, description, process, ingress }) => ({
                name,
                description,
                process,
                ingress,
            })),
            distinctUntilChanged(deepEqual),
            tap((system) => console.log("SPAM SYSTEM", nonce, _node.id, system))
        ),
        tools: _node.flowTools$.pipe(
            switchMap((tools) =>
                combineLatest(
                    tools.map((tool) =>
                        tool.read$$("system").pipe(pluck("name"))
                    )
                )
            ),
            distinctUntilChanged(deepEqual),
            tap((system) => console.log("SPAM TOOLS", nonce, _node.id, system))
        ),
        processConfig: _node.read$$("process:config").pipe(
            pluck("data"),
            distinctUntilChanged(deepEqual),
            tap((system) =>
                console.log("SPAM PROCESS CONFIG", nonce, _node.id, system)
            )
        ),
        ingressConfig: _node.read$$("ingress:config").pipe(
            pluck("data"),
            distinctUntilChanged(deepEqual),
            tap((system) =>
                console.log("SPAM INGRESS CONFIG", nonce, _node.id, system)
            )
        ),
    })
        .pipe(
            distinctUntilChanged(deepEqual),
            tap((config) => console.log("SPAM", nonce, _node.id, config)),
            takeUntil(_node.destroy$),
            withLatestFrom(
                node.read$$("process:config").pipe(
                    pluck("data"),
                    map((config) => {
                        console.log("flow got process config", config);
                        return config.nodes.find((n) => n.system.name === name);
                    }),
                    distinctUntilChanged(deepEqual)
                )
            ),
            filter(
                ([nodeConfig, flowNodeConfig]) =>
                    !deepEqual(nodeConfig, flowNodeConfig)
            ),
            map(([nodeConfig]) => nodeConfig),
            withLatestFrom(node.read$$("process:config").pipe(pluck("data"))),
            switchMap(([nodeConfig, config]) => {
                // replace the node in the config
                const index = config.nodes.findIndex(
                    (n) => n.system.name === nodeConfig.system.name
                );
                const nodes = [
                    ...config.nodes.slice(0, index),
                    nodeConfig,
                    ...config.nodes.slice(index + 1),
                ];

                return node.write$$("process:config", {
                    ...config,
                    nodes,
                });
            })
        )
        .subscribe();

    return _node;
};

const setup = ({ node, config }) => {
    console.log("SETUP", Node.ready$);
    return zip([
        Node.ready$,
        zip(
            config.nodes.map(({ system, processConfig, ingressConfig }) => {
                const id = `${system.name}-${node.id}`;
                const _node =
                    NODES.get(id) ||
                    createSessionNode({ node, config, name, id });

                return _node.write$$("system", system).pipe(
                    _node.log("wrote system data for flow node"),
                    switchMap((res) => {
                        return _node.process$.pipe(
                            _node.log("got process$"),
                            filter(
                                (e) =>
                                    e.system.process === system.process ||
                                    !system.process
                            ),
                            take(1)
                        );
                    }),
                    _node.log("process$ matches system.process"),
                    switchMap((sys) => {
                        console.log(
                            "flow node writing configs",
                            sys,
                            processConfig,
                            ingressConfig
                        );
                        return zip([
                            _node
                                .write$$("process:config", processConfig || {})
                                .pipe(
                                    _node.log("flow node wrote process config")
                                ),
                            _node
                                .write$$("ingress:config", ingressConfig || {})
                                .pipe(
                                    _node.log("flow node wrote ingress config")
                                ),
                        ]).pipe(take(1));
                    }),
                    _node.log("wrote process and ingress config"),
                    catchError((e) => {
                        console.log("flow setup error", e);
                        return of(e);
                    }),
                    map(() => _node)
                );
            })
        ),
    ]).pipe(
        take(1),
        node.log("got ready and all nodes"),
        tap(([_, nodes]) => {
            config.nodes.forEach(({ tools = [] }, i) => {
                const toolNodes = tools.map((tool) => {
                    return nodes.find((node) => node.id.startsWith(tool));
                });

                nodes[i].flowTools$.next(toolNodes);
            });
        }),
        node.log("set flow tools"),
        tap(([_, nodes]) => {
            nodes.forEach((node) => {
                node.upstream$.next([]);
            });
            config.connections.forEach(({ from, to }) => {
                const fromNode = nodes.find((node) => node.id.startsWith(from));
                const toNode = nodes.find((node) => node.id.startsWith(to));

                toNode.upstream$.pipe(take(1)).subscribe((upstream) => {
                    toNode.upstream$.next([...upstream, fromNode]);
                });
            });
        }),
        node.log("set upstreams, all nodes ready"),
        map(([_, nodes]) => {
            return {
                nodes,
            };
        })
    );
};

const status = ({ node, config }) => {
    return pipe(
        tap(({ nodes }) => {
            node.status$.next({
                status: "rebuild",
                detail: nodes,
            });
        })
    );
};

function flowOperation({ node, config }) {
    console.log("REBUILD FLOW", config);
    return (input$) => {
        console.log("REINVOKE FLOW", config.nodes.length);
        const flow$ = setup({ node, config }).pipe(shareReplay(1));
        console.log("FLOW$", flow$);

        flow$.pipe(status({ node, config })).subscribe(({ nodes }) => {
            console.log("flow got status", nodes);
        });

        combineLatest(input$, flow$)
            .pipe(
                node.log("got input and flow"),
                tap(([input, { nodes }]) => {
                    const target = nodes.find((node) =>
                        node.id.startsWith(input.name)
                    );
                    if (target) {
                        console.log(
                            "flow found target",
                            target.id,
                            input.payload
                        );
                        target.input$.next(input.payload);
                    }
                })
            )
            .subscribe();

        return flow$.pipe(
            switchMap(({ nodes }) => {
                return merge(
                    ...nodes.map((node) =>
                        node.output$.pipe(
                            map((payload) => ({
                                name: node.name,
                                payload,
                            }))
                        )
                    )
                );
            })
        );
    };
}

export default flowOperation;
