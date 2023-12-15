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
import { v4 as uuid } from "https://esm.sh/uuid";

export default class Node {
    static $ = new ReplaySubject(10);

    static systemTools$ = new ReplaySubject(1);
    static ready$ = new ReplaySubject(1);

    constructor(id = uuid()) {
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
        this.process$ = new ReplaySubject(1);
        this.output$ = new ReplaySubject(1);

        this.destroy$ = new ReplaySubject(1);
        this.$ = new ReplaySubject(1);

        this.setupPipelines();

        this.$.next(this);
        this.reset$.next();
        this.flowTools$.next([]);
        Node.$.next(this);
    }

    setupPipelines() {
        this.setupToolsPipelines();
        this.setupSystemPipelines();
        this.setupMainPipeline();
    }

    setupToolsPipelines() {
        combineLatest(this.flowTools$.pipe(startWith([])), Node.systemTools$)
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
                distinctUntilChanged(deepEqual),
                takeTillDone({ node: this })
            )
            .subscribe(this.ingress$);

        this.system$
            .pipe(
                systemToConfiguredModule({
                    node: this,
                    config: { role: "process" },
                }),
                distinctUntilChanged(deepEqual),
                takeTillDone({ node: this })
            )
            .subscribe(this.process$);

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
                skipValidation: true,
                skipPresets: true,
                role: "ingress",
            },
        })
            .pipe(takeTillDone({ node: this }))
            .subscribe(this.input$);

        applyModule({
            node: this,
            config: {
                module$: this.process$,
                stream$: this.input$,
                role: "process",
            },
        })
            .pipe(takeTillDone({ node: this }))
            .subscribe(this.output$);
    }

    tool$$(toolId) {
        if (this.id === toolId) {
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
        const nonce = Math.random().toString(36).slice(2);
        if (role === "system") {
            return of(systemSchema);
        }

        const [functionRole, dataRole] = role.split(":");
        // console.log("schema$$", role, nonce, functionRole, dataRole);
        return this[`${functionRole}$`].pipe(
            timeout({
                each: 1000,
                with: () => {
                    return combineLatest({
                        system: this.system$,
                        imports: this.tool$$("system:imports"),
                    }).pipe(
                        this.log(
                            `schema$$(${role}) (timeout recovery): got system json and system:imports tool.`
                        ),
                        switchMap(({ system, imports }) => {
                            return of({
                                module: system[`${functionRole}`],
                            }).pipe(
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

                return schemaOp({
                    node: this,
                    config,
                    keys,
                });
            }),
            distinctUntilChanged(deepEqual),
            this.log(`got schema for ${role} ${nonce}`)
        );
    }

    write$$(role, data) {
        const [functionRole, collection] = role.split(":");
        if (functionRole === "system") {
            console.log("WRITE SYSTEM");
            return of(data).pipe(
                tap((data) => this.system$.next(data)),
                this.log(`write$$(${role}): wrote system data`)
            );
        }

        return combineLatest(
            this.system$,
            this.tool$$("system:validator"),
            this.tool$$("system:db")
        ).pipe(
            this.log(`got system, validator, and db for role: ${role}`),
            switchMap(([system, validator, db]) => {
                console.log(
                    "write$$",
                    system,
                    functionRole,
                    system[functionRole]
                );
                return of(data).pipe(
                    this.log(`validating write$$ data for role: ${role}`),
                    validator.operator({
                        node: this,
                        config: {
                            role,
                        },
                    }),
                    this.log(`validated write$$ data for role: ${role}`),
                    map((data) => {
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
                    db.operator({ node: this }),
                    this.log(`wrote write$$ document for role: ${role}`),
                    switchMap(() => {
                        return this[`${functionRole}$`].pipe(
                            this.log(`write$$(${role}): got ${functionRole}$`),
                            filter(
                                (triple) =>
                                    !!triple &&
                                    validateObject(data, triple[collection])
                            ),
                            this.log(
                                `write$$(${role}): got ${functionRole}$ document that matches data`
                            ),
                            take(1)
                        );
                    })
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
            withLatestFrom(this.process$),
            this.log(`invoked as operator: ${node.id}: got process operator`),
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
                        detail: value,
                        callSite: error.stack.split("\n")[2]?.trim(),
                    });
                },
                (error) => {
                    this.log$.next({
                        message: `tap error at message: ${message}, error: ${error}`,
                        detail: error,
                        callSite: error.stack.split("\n")[2]?.trim(),
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
    return combineLatest(
        node.$,
        module$.pipe(distinctUntilChanged(deepEqual))
    ).pipe(
        withLatestFrom(node.tool$$("system:validator")),
        switchMap(([[node, { module, config, keys, system }], validator]) => {
            const _operator = module.default({
                node,
                config,
                keys,
                system,
            });
            let operator = _operator;

            switch (system?.map) {
                case "switch":
                    operator = switchMap((input) => {
                        return of(input).pipe(_operator);
                    });
                    break;
                case "merge":
                    operator = mergeMap((input) => {
                        return of(input).pipe(_operator);
                    });
                    break;
                case "concat":
                    operator = concatMap((input) => {
                        return of(input).pipe(_operator);
                    });
                    break;
                case "exhaust":
                    operator = exhaustMap((input) => {
                        return of(input).pipe(_operator);
                    });
                    break;
                case "none":
                default:
            }

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
                operator,
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
    ({ node, config: { role = "process" } }) =>
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
            switchMap(([system, imports, db, validator]) => {
                // console.log("re-getting module", system);
                return of({
                    module: system[role],
                }).pipe(
                    node.log(
                        `systemToConfiguredModule ${role} importing module`
                    ),
                    imports.operator({ node: this }),
                    node.log(
                        `systemToConfiguredModule ${role} imported module`
                    ),
                    switchMap((module) => {
                        // console.log("re-getting config and keys");
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
                                `systemToConfiguredModule ${role} got config$ and keys$`
                            ),
                            switchMap(([config$, keys$]) => {
                                return combineLatest([
                                    config$.pipe(
                                        node.log(
                                            `systemToConfiguredModule ${role} got config document`
                                        ),
                                        validator.operator({
                                            node,
                                            config: {
                                                role: `${role}:config`,
                                            },
                                        }),
                                        node.log(
                                            `systemToConfiguredModule ${role} validated config document`
                                        )
                                    ),
                                    keys$.pipe(
                                        node.log(
                                            `systemToConfiguredModule ${role} got keys document`
                                        ),
                                        validator.operator({
                                            node,
                                            config: {
                                                role: `${role}:keys`,
                                            },
                                        }),
                                        node.log(
                                            `systemToConfiguredModule ${role} validated keys document`
                                        )
                                    ),
                                ]).pipe(
                                    map(([config, keys]) => {
                                        return {
                                            module,
                                            config,
                                            keys,
                                            system,
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
            node.log(`systemToConfiguredModule completed for ${role}`)
        );
    };

function validateObject(baseObject, objectToValidate) {
    for (const key in baseObject) {
        if (baseObject.hasOwnProperty(key)) {
            // Check if both objects have the key
            if (!objectToValidate.hasOwnProperty(key)) {
                return false;
            }

            // If the value is an object, recurse
            if (
                typeof baseObject[key] === "object" &&
                typeof objectToValidate[key] === "object"
            ) {
                if (!validateObject(baseObject[key], objectToValidate[key])) {
                    return false;
                }
            } else {
                // Direct value comparison
                if (baseObject[key] !== objectToValidate[key]) {
                    return false;
                }
            }
        }
    }
    return true;
}
