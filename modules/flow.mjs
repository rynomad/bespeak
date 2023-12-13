import Node from "http://localhost:3002/modules/node.mjs";

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
    debounceTime,
    filter,
} from "https://esm.sh/rxjs";
import { zip } from "npm:rxjs@^7.8.1";

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
        config.nodes.map(({ system }) => new Node(`${node.id}-${system.name}`))
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
            console.log(nodes);
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
        }),
        tap(console.log.bind(console, "flow got config"))
    );
};

export function inputSchema({ node, config }) {
    return getIOSchema("process:input", { node, config });
}

export function outputSchema() {
    return getIOSchema("process:output", { node, config });
}

export function configSchema({ node }) {
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
                                    type: "string",
                                    description: "the process operator.",
                                    default: "chat-gpt@0.0.1",
                                },
                                ingress: {
                                    type: "string",
                                    description: "the ingress operator.",
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
                            additionalProperties: true,
                        },
                        ingressConfig: {
                            type: "object",
                            additionalProperties: true,
                        },
                        tools: {
                            type: "array",
                            items: {
                                type: "string",
                                description:
                                    "The name of the node to use as a tool.",
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
                            description: "The name of the upstream node.",
                        },
                        to: {
                            type: "string",
                            description: "The name of the downstream node.",
                        },
                    },
                    required: ["from", "to"],
                },
            },
        },
        // Define the properties of your config schema here
    };

    return of(schema);
}

const setup = ({ node, config }) => {
    return zip(
        config.nodes.map(({ system, processConfig, ingressConfig }) => {
            const _node = new Node(`${node.id}-${system.name}`);
            return _node.write$$("system", system).pipe(
                tap((res) =>
                    console.log(
                        "flow setup wrote system",
                        _node.id,
                        res,
                        processConfig,
                        ingressConfig
                    )
                ),
                switchMap(() => {
                    return zip([
                        _node.write$$("process:config", processConfig),
                        _node.write$$("ingress:config", ingressConfig),
                    ]);
                }),
                tap((written) =>
                    console.log(
                        "flow setup wrote configs",
                        system.name,
                        written
                    )
                ),
                catchError((e) => {
                    console.log("flow setup error", e);
                    return of(e);
                }),
                map(() => _node)
            );
        })
    ).pipe(
        take(1),
        tap(() => {
            console.log("flow setup got nodes", config.nodes);
        }),
        tap((nodes) => {
            config.nodes.forEach(({ tools = [] }, i) => {
                const toolNodes = tools.map((tool) => {
                    return nodes.find((node) => node.id.endsWith(tool));
                });

                nodes[i].flowTools$.next(toolNodes);
            });
        }),
        tap((nodes) => {
            config.connections.forEach(({ from, to }) => {
                const fromNode = nodes.find((node) => node.id.endsWith(from));
                const toNode = nodes.find((node) => node.id.endsWith(to));

                toNode.upstream$.pipe(take(1)).subscribe((upstream) => {
                    toNode.upstream$.next([...upstream, fromNode]);
                });
            });
        }),
        // debounceTime(500),
        map((nodes) => {
            console.log("MADE ALL NODES");
            return {
                nodes,
            };
        })
    );
};

const status = ({ node, config }) => {
    return pipe(
        tap(({ nodes }) => {
            nodes.forEach((_node) => {
                _node.status$.subscribe((status) => {
                    node.status$.next({
                        status: "subnode-status",
                        detail: status,
                    });
                });
            });
        })
    );
};

function flowOperation({ node, config }) {
    console.log("REBUILD FLOW", config);
    return (input$) => {
        console.log("REINVOKE FLOW", config.nodes.length);
        const flow$ = setup({ node, config }).pipe(shareReplay(1));

        flow$.pipe(status({ node, config })).subscribe(() => {
            console.log("flow got status");
        });

        combineLatest(input$, flow$)
            .pipe(
                tap(([input, { nodes }]) => {
                    console.log(
                        "flow got input",
                        input,
                        nodes.map((node) => node.id)
                    );
                    const target = nodes.find((node) =>
                        node.id.endsWith(input.name)
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
