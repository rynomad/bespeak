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
    timeout,
    concatMap,
    tap,
    pipe,
    of,
    switchMap,
} from "https://esm.sh/rxjs";
import * as DefaultIngress from "./ingress.mjs";
import { deepEqual } from "https://esm.sh/fast-equals";

const GPT = await import("./gpt.mjs");
const Imports = await import("./imports.mjs");
const Registrar = await import("./registrar.mjs");
const Validator = await import("./validator.mjs");
const DB = await import("./db.mjs");

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
    required: ["operator", "ingress"],
    indexes: ["operator", "ingress"],
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
        system: {
            operator: `${DB.key}@${DB.version}`,
            ingress: `${DefaultIngress.key}@${DefaultIngress.version}`,
        },
    },
    {
        id: "validator",
        operator: {
            module: Validator,
            config: {},
        },
        system: {
            ingress: `${DefaultIngress.key}@${DefaultIngress.version}`,
            operator: `${Validator.key}@${Validator.version}`,
        },
    },
    {
        id: "imports",
        operator: {
            module: Imports,
        },
        system: {
            ingress: `${DefaultIngress.key}@${DefaultIngress.version}`,
            operator: `${Imports.key}@${Imports.version}`,
        },
    },
    {
        id: "registrar",
        operator: {
            module: Registrar,
        },
        system: {
            operator: `${Registrar.key}@${Registrar.version}`,
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
        }),
        tap(
            () => {},
            (error) => {},
            () => {
                console.log(node.id, "takeTillDone complete");
            }
        )
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

const systemToConfiguredModule =
    ({ node, config: { role = "operator" } }) =>
    (system$) => {
        return combineLatest(
            system$,
            node.tool$$("system:imports"),
            node.tool$$("system:db"),
            node.tool$$("system:validator")
        ).pipe(
            node.log("systemToConfiguredModule start"),
            filter(([system]) => system?.[role]),
            distinctUntilChanged(
                ([systemA], [systemB]) => systemA[role] === systemB[role]
            ),
            node.log(`systemToConfiguredModule got system.${role}`),
            node.log(`systemToConfiguredModule got db$ and imports$`),
            switchMap(([system, imports, db, validator]) => {
                return of(system[role]).pipe(
                    node.log("systemToConfiguredModule importing module"),
                    imports.operator({ node: this }),
                    node.log(`systemToConfiguredModule imported module`),
                    switchMap((module) => {
                        // TODO make this configurable
                        return of([
                            {
                                operation: "findOne",
                                collection: "config",
                                params: {
                                    selector: {
                                        node: node.id,
                                        module: system[role],
                                    },
                                },
                            },
                            {
                                operation: "findOne",
                                collection: "keys",
                                params: {
                                    selector: {
                                        module: system[role],
                                    },
                                },
                            },
                        ]).pipe(
                            db.operator({ node }),
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
                                                role: `${role}:config`,
                                            },
                                        }),
                                        node.log(
                                            `systemToConfiguredModule validated config document`
                                        )
                                    ),
                                    keys$.pipe(
                                        node.log(
                                            `systemToConfiguredModule got keys document`
                                        ),
                                        validator.operator({
                                            node,
                                            config: {
                                                role: `${role}:keys`,
                                            },
                                        }),
                                        node.log(
                                            `systemToConfiguredModule validated keys document`
                                        )
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
        this.reset$.next();

        NodeWrapper.$.next(this);
    }

    setupPipelines() {
        this.setupToolsPipelines();
        this.setupSystemPipelines();
        this.setupMainPipeline();
    }

    setupToolsPipelines() {
        combineLatest(
            this.flowTools$.pipe(startWith([])),
            NodeWrapper.systemTools$
        )
            .pipe(
                map(([flowTools, systemTools]) => {
                    return flowTools.concat(systemTools);
                }),
                this.log("register tools"),
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
                map((data) => [
                    {
                        operation: "upsert",
                        collection: "system",
                        params: {
                            ...data,
                            id: this.id,
                        },
                    },
                ]),
                withLatestFrom(this.tool$$("system:db")),
                switchMap(([op, db]) => {
                    return of(op).pipe(db.operator({ node: this }));
                }),
                takeTillDone({ node: this })
            )
            .subscribe();

        this.tool$$("system:db")
            .pipe(
                this.log("got system:db"),
                switchMap((db) => {
                    return of([
                        {
                            operation: "findOne",
                            collection: "system",
                            params: {
                                selector: {
                                    id: this.id,
                                },
                            },
                        },
                    ]).pipe(db.operator({ node: this }));
                }),
                switchMap(([system$]) => system$),
                filter((doc) => !!doc),
                map((doc) => doc.toJSON()),
                distinctUntilChanged(deepEqual),
                this.log("found system data"),
                takeTillDone({ node: this })
            )
            .subscribe(this.system$);
    }

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
            console.log("tool$$: self", this.id);
            const sub = new ReplaySubject(1);
            sub.next(this);
            return sub;
        }

        return this.tools$.pipe(
            this.log(`looking for tool ${toolId}`),
            map((tools) => {
                return tools.find((node) => node.id === toolId);
            }),
            filter((tool) => !!tool),
            takeTillDone({ node: this }),
            this.log(`found tool ${toolId}`)
        );
    }

    schema$$(role) {
        if (role === "system") {
            return of(systemSchema);
        }

        const [functionRole, dataRole] = role.split(":");
        return this[`${functionRole}$`].pipe(
            timeout({
                each: 1000,
                with: () => {
                    console.log(
                        "timeout recovery",
                        this.id,
                        this.system$.closed
                    );
                    return combineLatest({
                        system: this.system$,
                        imports: this.tool$$("system:imports"),
                    }).pipe(
                        this.log(
                            `schema$$(${role}) (timeout recovery): got system json and system:imports tool.`
                        ),
                        switchMap(({ system, imports }) => {
                            return of(system[`${functionRole}`]).pipe(
                                imports.operator({ node: this }),
                                map((module) => ({ module })),
                                this.log(
                                    `schema$$(${role}) (timeout recovery): got module`
                                )
                            );
                        })
                    );
                },
            }),
            switchMap(({ module, config, keys }) => {
                const schemaOp = module[`${dataRole}Schema`];
                if (!schemaOp) {
                    return of(null);
                }

                console.log("got schemaOp", role, schemaOp, config, keys);
                return schemaOp({
                    node: this,
                    config,
                    keys,
                });
            }),
            this.log(`got schema for ${role}`)
        );
    }

    write$$(role, data) {
        const [functionRole, collection] = role.split(":");
        if (functionRole === "system") {
            return of(data).pipe(
                tap((data) => this.system$.next(data)),
                this.log(`write$$(${role}): wrote system data`)
            );
        }

        console.log("write$$ get system, validator, db");
        return combineLatest(
            this.system$,
            this.tool$$("system:validator"),
            this.tool$$("system:db")
        ).pipe(
            this.log(`got system, validator, and db for role: ${role}`),
            switchMap(([system, validator, db]) => {
                console.log("write$$ got system, validator, db", data);
                return of(data).pipe(
                    this.log(`validating write$$ data for role: ${role}`),
                    validator.operator({
                        node: this,
                        config: {
                            role,
                            skipPresets: true,
                        },
                    }),
                    this.log(`validated write$$ data for role: ${role}`),
                    map((data) => {
                        console.log("validated", data);
                        const params = {
                            module: system[functionRole],
                            data,
                        };
                        if (collection !== "keys") {
                            params.node = this.id;
                        }
                        return [
                            {
                                operation: "upsert",
                                collection,
                                params,
                            },
                        ];
                    }),
                    db.operator({ node: this })
                );
            }),
            this.log(`write$$(${role}): wrote document`)
        );
    }

    read$$(role) {
        const [functionRole, collection] = role.split(":");

        if (functionRole === "system") {
            return this.system$.pipe(
                this.log(`read$$(${role}): got system data`)
            );
        }

        return combineLatest(this.system$, this.tool$$("system:db")).pipe(
            this.log(`read$$(${role}): got system data and db tool.`),
            switchMap(([system, db]) => {
                const selector = {
                    module: system[functionRole],
                };

                if (collection !== "keys") {
                    selector.node = this.id;
                }
                return of([
                    {
                        operation: "findOne",
                        collection,
                        params: {
                            selector,
                        },
                    },
                ]).pipe(db.operator({ node: this }));
            }),
            switchMap(([doc$]) => doc$),
            filter((doc) => !!doc),
            map((doc) => doc.toJSON()),
            this.log(`read$$(${role}): got document`)
        );
    }

    operator({ node, config, keys } = {}) {
        node ||= this;
        return pipe(
            this.log(`invoked as operator: ${node.id}`),
            withLatestFrom(this.operator$),
            this.log(`invoked as operator: ${node.id}: got operator`),
            mergeMap(([input, { module, config: _config, keys: _keys }]) => {
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
        return pipe(
            tap(
                (value) => {
                    this.log$.next({
                        message,
                        value,
                        callSite: error.stack.split("\n")[2].trim(),
                    });
                },
                (error) => {
                    this.log$.next({
                        message: `tap error at message: ${message}, error: ${error}`,
                        value: error,
                        callSite: error.stack.split("\n")[2].trim(),
                    });
                },
                () => {
                    // this.log$.next({
                    //     message: `tap complete: ${message}`,
                    //     callSite: error.stack.split("\n")[2].trim(),
                    // });
                }
            )
        );
    }
}

NodeWrapper.systemTools$.next(
    systemTools.map(({ id, operator, system }) => {
        const node = new NodeWrapper(`system:${id}`);
        node.operator$.next(operator);
        node.system$.next(system);
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
        concatMap(([paths, tools]) => {
            console.log("paths", paths);
            return from(paths).pipe(
                tools.find(({ id }) => id === "system:registrar").operator(),
                tools.find(({ id }) => id === "system:db").operator(),
                catchError((error) => {
                    console.error(
                        "Catastrophic Error In Registration: ",
                        error.stack
                    );
                    return EMPTY;
                })
            );
        })
    )
    .subscribe();

NodeWrapper.$.pipe(
    tap((node) => {
        // node.operator$.subscribe(
        //     (operator) => {
        //         console.log(node.id, "got operator", operator);
        //     },
        //     (error) => {
        //         console.error(node.id, "operator$ error", error);
        //     },
        //     () => {
        //         console.log(node.id, "operator$ complete");
        //     }
        // );
        node.log$.subscribe(({ message, value, callSite }) => {
            // return console.log(node.id, message, callSite);
            const text = new TextEncoder().encode(".");
            Deno.writeAllSync(Deno.stdout, text);
        });
        node.error$.subscribe((error) => console.error(node.id, error));
    })
).subscribe();
setTimeout(() => {
    const gpt = new NodeWrapper("test");

    gpt.read$$("system").subscribe((system) => {
        console.log("\ngpt test read system document", system);
    });

    gpt.read$$("operator:config").subscribe((data) => {
        console.log("\ngpt test read operator config document", data);
    });

    gpt.read$$("operator:keys").subscribe((data) => {
        console.log("\ngpt test read operator keys document", data);
    });

    gpt.read$$("ingress:config").subscribe((data) => {
        console.log("\ngpt test read ingress config document", data);
    });

    gpt.read$$("ingress:keys").subscribe((data) => {
        console.log("\ngpt test read ingress keys document", data);
    });

    gpt.write$$("operator:keys", keys).subscribe(() => {
        console.log("\ngpt test write operator keys document");
    });

    gpt.write$$("operator:config", {
        basic: {
            prompt: "hello world",
        },
    }).subscribe(() => {
        console.log("\ngpt test write operator config document");
    });

    gpt.output$.subscribe((output) => {
        console.log("\ngpt test output", output);
    });

    gpt.operator$.subscribe((operator) => {
        console.log("\nASSET operator", operator);
    });

    gpt.input$.next({
        override: {
            prompt: "hello world",
        },
    });
    gpt.log$.subscribe(({ message, value, callSite }) =>
        console.log("\ngpt test:", message, callSite)
    );
});
