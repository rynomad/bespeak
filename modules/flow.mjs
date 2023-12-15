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
    debounceTime,
    filter,
} from "rxjs";

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

export function outputSchema({ node, config }) {
    return getIOSchema("process:output", { node, config });
}

export function configSchema({ node }) {
    return node.tool$$("system:imports").pipe(
        switchMap((imports) => {
            return of({}).pipe(
                imports.operator(),
                switchMap((map) => {
                    return combineLatest(Array.from(map.values()));
                })
            );
        }),
        map((imports) => {
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
        }),
        tap((schema) => console.log(JSON.stringify(schema, null, 2)))
    );
}

const setup = ({ node, config }) => {
    console.log("SETUP", Node.ready$);
    return zip([
        Node.ready$,
        zip(
            config.nodes.map(({ system, processConfig, ingressConfig }) => {
                const _node = new Node(`${system.name}-${node.id}`);
                return _node.write$$("system", system).pipe(
                    switchMap((res) => {
                        return _node.process$.pipe(
                            tap((sys) => {
                                console.log(
                                    "flow got process",
                                    system.name,
                                    system.process,
                                    res.process,
                                    sys.system.process
                                );
                            }),
                            filter(
                                (e) =>
                                    e.system.process === system.process ||
                                    !system.process
                            )
                        );
                    }),
                    switchMap((sys) => {
                        console.log(
                            "flow wrote system",
                            system.name,
                            system.process,
                            sys.system.process
                        );
                        return zip([
                            _node.write$$("process:config", processConfig),
                            _node.write$$("ingress:config", ingressConfig),
                        ]);
                    }),
                    tap((written) =>
                        console.log(
                            "flow setup wrote configs",
                            system.name,
                            system.process,
                            written[0].system.process
                        )
                    ),
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
        tap(() => {
            console.log("flow setup got nodes", config.nodes);
        }),
        tap(([_, nodes]) => {
            console.log();
            config.nodes.forEach(({ tools = [] }, i) => {
                const toolNodes = tools.map((tool) => {
                    return nodes.find((node) => node.id.startsWith(tool));
                });

                nodes[i].flowTools$.next(toolNodes);
            });
        }),
        tap(([_, nodes]) => {
            nodes.forEach((node) => {
                node.upstream$.next([]);
            });
            config.connections.forEach(({ from, to }) => {
                const fromNode = nodes.find((node) => node.id.startsWith(from));
                const toNode = nodes.find((node) => node.id.startsWith(to));

                console.log(
                    "flow setup got connection",
                    from,
                    to,
                    !!fromNode,
                    !!toNode
                );

                toNode.upstream$.pipe(take(1)).subscribe((upstream) => {
                    toNode.upstream$.next([...upstream, fromNode]);
                });
            });
        }),
        // debounceTime(500),
        map(([_, nodes]) => {
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
        console.log("FLOW$", flow$);

        flow$.pipe(status({ node, config })).subscribe(({ nodes }) => {
            console.log("flow got status", nodes);
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
