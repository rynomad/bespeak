import * as GPT from "./modules/gpt.mjs";
// import schinquirer from "https://esm.sh/@luismayo/schinquirer";
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
    switchMap,
} from "https://esm.sh/rxjs";
import Ajv from "https://esm.sh/ajv";
import getDB from "./db.mjs";
import {
    getText,
    addDefaultValuesToSchema,
    addDefaultValuesToObject,
} from "./util.mjs";
import { jsonPreset } from "https://esm.sh/json-schema-preset";

const db = await getDB();

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
        module: {
            type: "string",
            maxLength: 255,
            final: true,
        },
        version: {
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
        },
    },
    required: ["module", "version"],
    indexes: ["module", "version"],
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

const createKeysCollection = async (db) => {
    await db.addCollections({
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
    });
};

db.$.subscribe((event) => {
    console.log("db event", event.documentId, event.collectionName);
});

await createKeysCollection(db);

class Modules {
    static db = db;
    static modules = new Map();
    static log$ = new ReplaySubject(100);

    static register(...paths) {
        paths = paths.flat();
        from(paths)
            .pipe(
                log(this, "paths received"),
                concatMap((path) => Modules.register$(path)),
                log(this, "module registered")
            )
            .subscribe();
    }

    static register$(path) {
        return combineLatest({
            module: from(import(path)),
            source: from(getText(path)),
        }).pipe(
            log(this, "module and source received"),
            mergeMap(({ module, source }) => {
                const { key, version } = module;

                return Modules.db.modules
                    .findOne({
                        selector: { id: "chat-gpt", version: "0.0.1" },
                    })
                    .$.pipe(
                        log(this, "module entry event"),
                        take(1),
                        log(this, "module entry event"),
                        switchMap((moduleEntry) => {
                            if (moduleEntry) {
                                of(moduleEntry)
                                    .pipe(log(this, "module entry"))
                                    .subscribe();
                                const _source = moduleEntry.get$("data");
                                if (source !== _source) {
                                    throw new Error(
                                        `Module ${id} already exists with different source code. you must update the version number.`
                                    );
                                }
                            }

                            console.log("moduleEntry null");
                            return Modules.db.modules.insert({
                                id: key,
                                version,
                                data: source,
                            });
                        }),
                        log(this, "module inserted"),
                        catchError((err) => {
                            console.error(err);
                            return EMPTY;
                        })
                    );
            }),
            catchError((err) => {
                console.error(err);
                return EMPTY;
            })
        );
    }

    static get({ key, module, version }) {
        const id = `${key || module}@${version}`;
        return Modules.modules.get(id);
    }

    static set({ key, module, version }, module$) {
        const id = `${key || module}@${version}`;
        Modules.modules.set(id, module$);
    }

    static get$(system) {
        const { module, version } = system;
        const module$ = Modules.get(system);
        console.log("got module$?", module$);
        if (module$) {
            return module$;
        }
        const newModule$ = Modules.db.modules
            .findOne({
                selector: { id: module, version },
            })
            .$.pipe(
                filter((e) => e !== null),
                take(1),
                log(this, "received module document"),
                switchMap((module) => {
                    const source = module.get("data");
                    const blob = new Blob([source], {
                        type: "text/javascript",
                    });
                    const url = URL.createObjectURL(blob);
                    return import(url);
                }),
                log(this, "imported module source"),
                shareReplay(1)
            );

        Modules.set(system, newModule$);
        return newModule$;
    }
}

Modules.register("./modules/gpt.mjs");

Modules.log$.subscribe((log) => console.log("Modules log", log.message));

class Storage {
    static db = db;

    get db() {
        return Storage.db;
    }
    constructor(node) {
        this.node = node;
        this.system$ = new ReplaySubject(1);
        this.config$ = new ReplaySubject(1);
        this.keys$ = new ReplaySubject(1);
        this.read$ = new ReplaySubject(1);
        this.log$ = new ReplaySubject(100);

        this.setupPipelines();
    }

    setupPipelines() {
        this.setupModulePipeline();
        this.setupSystemPipeline();
        this.setupConfigPipeline();
        this.setupKeysPipeline();
        this.setupReadPipeline();
    }

    setupConfigPipeline() {
        this.node.module$
            .pipe(
                log(this, "config pipeline module received"),
                switchMap(
                    (module) =>
                        db.config.findOne({
                            selector: {
                                id: this.node.id,
                                module: module.key,
                            },
                        }).$
                ),
                filter((e) => e !== null),
                log(this, "config found"),
                switchMap((config) => config.get$("data")),
                log(this, "config data gotten"),
                takeUntil(this.node.destroy$),
                catchError((err) => {
                    console.error(err);
                    return EMPTY;
                })
            )
            .subscribe(this.node.config$);

        combineLatest(this.config$, this.node.module$)
            .pipe(
                take(1),
                log(this, "config upsert pipeline started"),
                switchMap(() =>
                    this.config$.pipe(withLatestFrom(this.node.module$))
                ),
                log(this, "config received with module"),
                switchMap(([config, module]) =>
                    this.db.config.upsert({
                        id: this.node.id,
                        module: module.key,
                        data: config,
                    })
                ),
                log(this, "config upserted"),
                takeUntil(this.node.destroy$)
            )
            .subscribe();
    }

    setupKeysPipeline() {
        this.node.module$
            .pipe(
                log(this, "keys pipeline module received"),
                switchMap(
                    (module) =>
                        db.keys.findOne({
                            selector: { module: module.id },
                        }).$
                ),
                filter((e) => e !== null),
                switchMap((keys) => keys.get$("data")),
                log(this, "keys found"),
                takeUntil(this.node.destroy$)
            )
            .subscribe(this.node.keys$);

        combineLatest(this.keys$, this.node.module$)
            .pipe(
                take(1),
                log(this, "keys upsert pipeline started"),
                switchMap(() =>
                    this.keys$.pipe(withLatestFrom(this.node.module$))
                ),
                log(this, "keys received with module"),
                switchMap(([keys, module]) =>
                    this.db.keys.upsert({
                        id: this.node.id,
                        module: module.key,
                        data: keys,
                    })
                ),
                log(this, "keys upserted"),
                takeUntil(this.node.destroy$),
                catchError((err) => {
                    console.error(err);
                    return EMPTY;
                })
            )
            .subscribe();
    }

    setupSystemPipeline() {
        this.db.system
            .findOne({ selector: { id: this.node.id } })
            .$.pipe(
                filter((e) => e !== null),
                map((system) => system.toJSON()),
                log(this, "system found"),
                takeUntil(this.node.destroy$)
            )
            .subscribe(this.node.system$);

        this.system$
            .pipe(
                log(this, "system received"),
                switchMap((system) =>
                    this.db.system.upsert({ id: this.node.id, ...system })
                ),
                log(this, "system upserted")
            )
            .subscribe();
    }

    setupModulePipeline() {
        this.node.system$
            .pipe(
                filter((system) => system?.module && system?.version),
                log(this, "system received from node"),
                distinctUntilChanged(
                    (a, b) => a.module === b.module && a.version === b.version
                ),
                switchMap((system) => Modules.get$(system)),
                log(this, "module received from modules"),
                takeUntil(this.node.destroy$)
            )
            .subscribe(this.node.module$);
    }

    setupReadPipeline() {
        combineLatest({
            module: this.node.module$,
            config: this.node.config$,
            keys: this.node.keys$,
            system: this.node.system$,
        }).subscribe(this.read$);
    }
}

class Node {
    constructor(id = "test") {
        this.id = id;
        this.input$ = new ReplaySubject(1);
        this.output$ = new ReplaySubject(1);
        this.error$ = new ReplaySubject(1);
        this.status$ = new ReplaySubject(1);
        this.config$ = new ReplaySubject(1);
        this.keys$ = new ReplaySubject(1);
        this.module$ = new ReplaySubject(1);
        this.reset$ = new ReplaySubject(1);
        this.destroy$ = new ReplaySubject(1);
        this.context$ = new ReplaySubject(1);
        this.schemas$ = new ReplaySubject(1);
        this.storage$ = new ReplaySubject(1);
        this.system$ = new ReplaySubject(1);
        this.log$ = new ReplaySubject(100);
        this.$ = new ReplaySubject(1);
        this.$.next(this);

        this.setupPipelines();
    }

    setupPipelines() {
        this.setupSchemaPipeline();
        this.setupInputPipeline();
    }

    setupSchemaPipeline() {
        combineLatest(this.$, this.module$)
            .pipe(
                take(1),
                log(this, "schema pipeline started"),
                switchMap(() =>
                    this.$.pipe(
                        log(this, "node received"),
                        withLatestFrom(
                            this.module$,
                            this.keys$.pipe(startWith(null))
                        )
                    )
                ),
                log(this, "node received with module and keys"),
                switchMap(([context, module, keys]) =>
                    Promise.all([
                        module.configSchema(context, keys),
                        module.keysSchema(context),
                        module.inputSchema(context, keys),
                        module.outputSchema(context, keys),
                    ])
                ),
                log(this, "schemas received"),
                map(
                    ([
                        configSchema,
                        keysSchema,
                        inputSchema,
                        outputSchema,
                    ]) => ({
                        configSchema,
                        keysSchema,
                        inputSchema,
                        outputSchema,
                    })
                ),
                log(this, "schemas mapped"),
                takeUntil(this.destroy$),
                catchError((err) => {
                    console.error(err);
                    return EMPTY;
                })
            )
            .subscribe(this.schemas$);
    }

    setupInputPipeline() {
        combineLatest({
            module: this.module$,
            config: this.config$,
            keys: this.keys$,
            schemas: this.schemas$,
            resetTrigger: this.reset$.pipe(startWith(null)), // Emit at least once to start the pipeline
        })
            .pipe(
                log(this, "resetting pipeline"),
                switchMap(({ module, config, keys, schemas }) => {
                    try {
                        // Validate config and keys
                        config = this.validate(schemas, "config", config);
                        keys = this.validate(schemas, "keys", keys);
                    } catch (err) {
                        console.error(err);
                        this.error$.next(err);
                        return EMPTY;
                    }

                    return this.input$.pipe(
                        log(this, "input received"),
                        withLatestFrom(this.schemas$),
                        log(this, "input received with schemas"),
                        map(([input, schemas]) =>
                            this.validate(schemas, "input", input)
                        ),
                        log(this, "input validated"),
                        module.default(config, keys, this),
                        log(this, "module ran"),
                        withLatestFrom(this.schemas$),
                        log(this, "module ran with schemas"),
                        map(([output, schemas]) =>
                            this.validate(schemas, "output", output)
                        ),
                        log(this, "output validated"),
                        catchError((err) => {
                            console.error(err);
                            this.error$.next(err);
                            return EMPTY;
                        }),
                        log(this, "no error"),
                        takeUntil(this.reset$) // Reset the pipeline on reset$
                    );
                })
            )
            .subscribe(this.output$);
    }

    validate(schemas, key, value) {
        const schema = schemas[`${key}Schema`];
        value = jsonPreset(schema, value);
        const ajv = new Ajv({ useDefaults: true });
        value = addDefaultValuesToObject(schema, value);
        const valid = ajv.validate(schema, value);
        if (!valid) {
            throw new Error(`Invalid ${key}: ${ajv.errorsText()}`);
        }
        return value;
    }
}

function log(node, message) {
    return tap((value) => node.log$.next({ node, message, value }));
}

const node = new Node();
const storage = new Storage(node);
// storage.keys$.subscribe((k) => console.log("storage keys got keys", k));
node.storage$.next(storage);

// node.module$.subscribe((m) => console.log("NODE GOT MODULE"));
// node.$.subscribe(() => console.log("NODE GOT SELF"));
storage.system$.next({ module: GPT.key, version: GPT.version });
storage.config$.next({
    basic: { prompt: "write me a short story about space" },
});
storage.keys$.next(keys);
// storage.read$.subscribe((read) => console.log("read", read));
// storage.log$.subscribe((log) => console.log("storage log", log.message));
node.input$.next({});
// node.log$.subscribe((log) => console.log("node log:", log.message));
// node.status$.subscribe((status) =>
//     console.log("Status:", status.chunk || "\nOUTPUT COMPLETE\n")
// );
node.output$.subscribe((output) => console.log("Output:", output));

window.node = node;
window.storage = storage;

// node.keys$
//     .pipe(
//         timeout({
//             each: 1000,
//             with: () =>
//                 node.schemas$.pipe(
//                     take(1),
//                     switchMap(({ keysSchema }) =>
//                         schinquirer.prompt(keysSchema.properties)
//                     ),
//                     withLatestFrom(node.db$),
//                     tap(([keys, db]) =>
//                         db.keys.insert({ module: GPT.id, data: keys })
//                     )
//                 ),
//         })
//     )
//     .subscribe();

// node.keys$
//     .pipe(
//         switchMap(() => {
//             return node.config$.pipe(
//                 timeout({
//                     each: 1000,
//                     with: () =>
//                         node.schemas$.pipe(
//                             take(1),
//                             tap(({ configSchema }) =>
//                                 console.log(configSchema)
//                             ),
//                             switchMap(async ({ configSchema }) => {
//                                 const basic = await schinquirer.prompt(
//                                     configSchema.properties.basic.properties
//                                 );
//                                 const advanced = await schinquirer.prompt(
//                                     configSchema.properties.advanced.properties
//                                 );
//                                 return { basic, advanced };
//                             }),
//                             withLatestFrom(node.db$),
//                             tap(([config, db]) =>
//                                 db.config.insert({
//                                     id: "test",
//                                     node: node.id,
//                                     module: GPT.id,
//                                     data: config,
//                                 })
//                             )
//                         ),
//                 })
//             );
//         })
//     )
//     .subscribe();

// // Usage:
// // const node = new Node();
// // node.module$.next(GPT);

// // node.config$.next({ basic: { prompt: "write me a short story about space" } });
// node.input$.next({ messages: [] });
// node.output$.subscribe((output) => console.log("Output:", output));
// node.status$.subscribe((status) =>
//     Deno.writeAllSync(
//         Deno.stdout,
//         new TextEncoder().encode(status.chunk || "\nOUTPUT COMPLETE\n")
//     )
// );
// node.error$.subscribe((error) => console.error("Error:", error));
// // node.schemas$.subscribe((schemas) =>
// //     console.log(
// //         "Schemas:",
// //         schemas.configSchema.properties.advanced.properties.model.enum
// //     )
// // );

// const _node = new Node("second");
// _node.db$.next(db);
// _node.module$.next(GPT);
// _node.context$.next({ node: { id: "second" } });
// _node.config$.next({
//     basic: { prompt: "tell me more about the minor characters" },
// });
// _node.status$.subscribe((status) =>
//     Deno.writeAllSync(
//         Deno.stdout,
//         new TextEncoder().encode(status.chunk || "\nNODE 2 OUTPUT COMPLETE\n")
//     )
// );
// _node.error$.subscribe((error) => console.error("NODE 2 Error:", error));
// _node.output$.subscribe((output) => {
//     console.log("NODE 2 Output:");
//     setTimeout(() => {
//         node.input$.next({
//             override: {
//                 prompt: "write me a sonnet about the moon",
//             },
//         });
//     }, 1000);
// });
// _node.input$.subscribe((input) => console.log("NODE 2 Input:", input));
// node.output$.subscribe(_node.input$);
