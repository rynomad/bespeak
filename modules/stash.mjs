import {
    ReplaySubject,
    combineLatest,
    from,
    EMPTY,
    startWith,
    withLatestFrom,
    map,
    filter,
    take,
    mergeMap,
    catchError,
    distinctUntilChanged,
    shareReplay,
    takeUntil,
    concatMap,
    tap,
    pipe,
    of,
    switchMap,
} from "https://esm.sh/rxjs";
import * as GPT from "./gpt.mjs";
import * as DefaultIngress from "./ingress.mjs";
import { deepEqual } from "https://esm.sh/fast-equals";

// Replace 'your-api-key' with your actual OpenAI API key
const keys = {
    apiKey: "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",
};
const keySchema = {
    title: "key schema",
    version: 0,
    type: "object",
    primaryKey: "module",
    properties: {
        module: {
            type: "string",
            maxLength: 255,
            primary: true,
        },
        data: {
            type: "object",
            additionalProperties: true,
        },
    },
};

const configSchema = {
    title: "config schema",
    version: 0,
    type: "object",
    primaryKey: "id",
    properties: {
        id: {
            type: "string",
            final: true,
            maxLength: 255,
        },
        node: {
            type: "string",
            maxLength: 255,
            final: true,
        },
        module: {
            type: "string",
            maxLength: 255,
            final: true,
        },
        data: {
            type: "object",
            additionalProperties: true,
        },
    },
    required: ["node", "module"],
    indexes: ["node", "module"],
};

const systemSchema = {
    title: "system schema",
    version: 0,
    type: "object",
    primaryKey: "id",
    properties: {
        id: {
            type: "string",
            final: true,
            maxLength: 255,
        },
        operator: {
            type: "string",
            maxLength: 255,
            final: true,
            default: `${GPT.key}@${GPT.version}`,
        },
        ingress: {
            type: "string",
            maxLength: 255,
            default: `${DefaultIngress.key}@${DefaultIngress.version}`,
        },
        name: {
            type: "string",
            maxLength: 255,
        },
        description: {
            type: "string",
        },
    },
    required: ["module", "ingress"],
    indexes: ["module", "ingress"],
};

const moduleSchema = {
    title: "module schema",
    version: 0,
    type: "object",
    primaryKey: "id",
    properties: {
        id: {
            type: "string",
            maxLength: 255,
            final: true,
        },
        version: {
            type: "string",
            maxLength: 255,
        },
        type: {
            type: "string",
            maxLength: 255,
            final: true,
        },
        name: {
            type: "string",
            maxLength: 255,
        },
        description: {
            type: "string",
            maxLength: 255,
        },
        data: {
            type: "string",
        },
    },
    required: ["id", "version"],
    indexes: ["version"],
};

const systemTools = [
    {
        id: "db",
        operator: {
            module: await import("./db.mjs"),
            config: {
                dbName: "requine",
                collections: {
                    keys: {
                        schema: keySchema,
                    },
                    config: {
                        schema: configSchema,
                    },
                    system: {
                        schema: systemSchema,
                    },
                    modules: {
                        schema: moduleSchema,
                    },
                },
            },
        },
    },
    {
        id: "validator",
        operator: {
            module: await import("./validator.mjs"),
            config: {},
        },
    },
    {
        id: "imports",
        operator: {
            module: await import("./imports.mjs"),
        },
    },
    {
        id: "registrar",
        operator: {
            module: await import("./registrar.mjs"),
        },
    },
];

const takeTillDone = ({ node }) => {
    return pipe(
        takeUntil(node.destroy$),
        catchError((error) => {
            console.error("Catastrophic Error: ", error.stack);
            node.log$.next({
                message: `Catastrophic Error: ${error?.message}`,
                value: error,
            });
            node.error$.next(error);
            return EMPTY;
        })
    );
};

const applyModule = ({
    node,
    config: { module$, stream$, role, strict, skipValidation, skipPresets },
}) => {
    return combineLatest(node.$, module$).pipe(
        withLatestFrom(node.tool$$("system:validator")),
        switchMap(([[node, { module, config, keys }], validator]) => {
            return stream$.pipe(
                node.log(`${role} input received`),
                validator.operator({
                    node,
                    config: {
                        role: `${role}:input`,
                        strict,
                        skipValidation,
                        skipPresets,
                    },
                }),
                node.log(`${role} input validated`),
                module.default({
                    node,
                    config,
                    keys,
                }),
                node.log(`${role} output received`),
                validator.operator({
                    node,
                    config: {
                        role: `${role}:output`,
                        strict,
                        skipPresets,
                    },
                }),
                node.log(`${role} output validated`)
            );
        })
    );
};

const systemToConfiguredModule = ({ node, config }) => {
    return pipe(
        node.log("systemToConfiguredModule start"),
        filter((system) => system?.[config.role]),
        map((system) => system[config.role]),
        distinctUntilChanged(),
        node.log(`systemToConfiguredModule got system.${config.role}`),
        withLatestFrom(node.tool$$("system:imports")),
        node.log(`systemToConfiguredModule got db$ and imports$`),
        switchMap(([moduleId, imports]) => {
            return of(moduleId).pipe(
                imports.operator(),
                node.log(`systemToConfiguredModule got module`),
                withLatestFrom(
                    node.tool$$("system:db"),
                    node.tool$$("system:validator")
                ),
                switchMap(([module, db, validator]) => {
                    // TODO make this configurable
                    return of([
                        {
                            operation: "findOne",
                            collection: "config",
                            params: {
                                selector: {
                                    node: this.node.id,
                                    module: moduleId,
                                },
                            },
                        },
                        {
                            operation: "findOne",
                            collection: "keys",
                            params: {
                                selector: {
                                    module: moduleId,
                                },
                            },
                        },
                    ]).pipe(
                        db.operator(),
                        node.log(
                            `systemToConfiguredModule got config$ and keys$`
                        ),
                        switchMap(([config$, keys$]) => {
                            return combineLatest([
                                config$.pipe(
                                    node.log(
                                        `systemToConfiguredModule got config document`
                                    ),
                                    validator.operator({
                                        node,
                                        config: {
                                            module,
                                            schema: "config",
                                        },
                                    })
                                ),
                                keys$.pipe(
                                    node.log(
                                        `systemToConfiguredModule got keys document`
                                    ),
                                    validator.operator({
                                        node,
                                        config: {
                                            module,
                                            schema: "keys",
                                        },
                                    })
                                ),
                            ]).pipe(
                                map(([config, keys]) => {
                                    return {
                                        module,
                                        config,
                                        keys,
                                    };
                                })
                            );
                        }),
                        node.log(
                            `systemToConfiguredModule got module, config, and keys`
                        )
                    );
                })
            );
        }),
        node.log(`systemToConfiguredModule completed`)
    );
};

class NodeWrapper {
    static $ = new ReplaySubject(systemTools.length);

    static systemTools$ = new ReplaySubject(1);

    constructor(id = "test", system) {
        this.id = id;

        this.status$ = new ReplaySubject(1);
        this.log$ = new ReplaySubject(100);
        this.error$ = new ReplaySubject(1);
        this.writeConfig$ = new ReplaySubject(1);
        this.readConfig$ = new ReplaySubject(1);

        this.flowTools$ = new ReplaySubject(1);
        this.tools$ = new ReplaySubject(1);

        this.system$ = new ReplaySubject(1);
        this.reset$ = new ReplaySubject(1);

        this.upstream$ = new ReplaySubject(1);
        this.ingress$ = new ReplaySubject(1);
        this.input$ = new ReplaySubject(1);
        this.operator$ = new ReplaySubject(1);
        this.output$ = new ReplaySubject(1);

        this.destroy$ = new ReplaySubject(1);
        this.$ = new ReplaySubject(1);

        this.setupPipelines();

        this.$.next(this);
        this.system$.next(system);
        this.reset$.next();

        NodeWrapper.$.next(this);
    }

    setupPipelines() {
        this.setupToolsPipelines();
        this.setupSystemPipelines();
        this.setupConfigPipelines();
        this.setupKeysPipeline();
        this.setupMainPipeline();
    }

    setupToolsPipelines() {
        this.flowTools$
            .pipe(
                startWith([]),
                withLatestFrom(NodeWrapper.systemTools$),
                map(([flowTools, systemTools]) => {
                    return flowTools.concat(systemTools);
                }),
                takeTillDone({ node: this })
            )
            .subscribe(this.tools$);
    }

    setupSystemPipelines() {
        this.system$
            .pipe(
                systemToConfiguredModule({
                    node: this,
                    config: { role: "ingress" },
                }),
                takeTillDone({ node: this })
            )
            .subscribe(this.ingress$);

        this.system$
            .pipe(
                systemToConfiguredModule({
                    node: this,
                    config: { role: "operator" },
                }),
                takeTillDone({ node: this })
            )
            .subscribe(this.operator$);

        this.system$
            .pipe(
                startWith({}),
                distinctUntilChanged(deepEqual),
                this.log("got fresh system data"),
                map((data) => ({
                    operation: "upsert",
                    collection: "system",
                    params: {
                        ...data,
                        id: this.id,
                    },
                })),
                withLatestFrom(this.tool$$("system:db")),
                switchMap(([op, db]) => {
                    return of(op).pipe(db.operator());
                }),
                takeTillDone({ node: this })
            )
            .subscribe();

        this.tool$$("system:db")
            .pipe(
                this.log("got system:db"),
                switchMap((db) => {
                    return of({
                        operator: "findOne",
                        collection: "system",
                        params: {
                            selector: {
                                id: this.id,
                            },
                        },
                    }).pipe(db.operator());
                }),
                this.log("found system data"),
                takeTillDone({ node: this })
            )
            .subscribe(this.system$);
    }

    setupConfigPipelines() {}

    setupKeysPipeline() {}

    setupMainPipeline() {
        applyModule({
            node: this,
            config: {
                module$: this.ingress$,
                stream$: this.upstream$,
            },
        })
            .pipe(takeTillDone({ node: this }))
            .subscribe(this.input$);

        applyModule({
            node: this,
            config: {
                module$: this.operator$,
                stream$: this.input$,
            },
        })
            .pipe(takeTillDone({ node: this }))
            .subscribe(this.output$);
    }

    tool$$(toolId) {
        if (this.id === toolId) {
            return of(this);
        }

        return this.tools$.pipe(
            this.log(`looking for tool ${toolId}`),
            map((tools) => {
                return tools.find((node) => node.id === toolId);
            }),
            filter((tool) => !!tool),
            take(1),
            takeTillDone({ node: this }),
            this.log(`found tool ${toolId}`)
        );
    }

    schema$$(role) {
        const [functionRole, dataRole] = role.split(":");
        return this[`${functionRole}$`].pipe(
            switchMap(({ module, config, keys }) => {
                const schemaOp = module[`${dataRole}Schema`];
                if (!schemaOp) {
                    return of(null);
                }

                return schemaOp({
                    node: this,
                    config,
                    keys,
                });
            })
        );
    }

    operator({ node, config, keys } = {}) {
        node ||= this;
        return pipe(
            this.log(`invoked as operator: ${node.id}`),
            withLatestFrom(this.operator$),
            this.log(`invoked as operator: ${node.id}: got operator`),
            switchMap(([input, { module, config: _config, keys: _keys }]) => {
                return of(input).pipe(
                    module.default({
                        node,
                        config: config || _config,
                        keys: keys || _keys,
                    })
                );
            })
        );
    }

    log(message) {
        // construct a new error and use its stack property to get the line where the log was called
        const error = new Error();
        return tap((value) => {
            this.log$.next({
                message,
                value,
                callSite: error.stack.split("\n")[2].trim(),
            });
        });
    }
}

NodeWrapper.systemTools$.next(
    systemTools.map(({ id, operator }) => {
        const node = new NodeWrapper(`system:${id}`);
        node.operator$.next(operator);
        return node;
    })
);

combineLatest(
    of([
        "./db.mjs",
        "./imports.mjs",
        "./ingress.mjs",
        "./registrar.mjs",
        "./gpt.mjs",
        "./validator.mjs",
    ]),
    NodeWrapper.systemTools$
)
    .pipe(
        switchMap(([paths, tools]) => {
            return from(paths).pipe(
                tools.find(({ id }) => id === "system:registrar").operator()
            );
        })
    )
    .subscribe();

NodeWrapper.$.pipe(
    tap((node) => {
        node.log$.subscribe(({ message, value, callSite }) =>
            console.log(node.id, message, callSite)
        );
    })
).subscribe();
setTimeout(() => {
    const gpt = new NodeWrapper("test");

    gpt.system$.subscribe((system) => {
        console.log("gpt test system value", system);
    });
});
