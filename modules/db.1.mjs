import {
    BehaviorSubject,
    of,
    from,
    switchMap,
    mergeMap,
    pipe,
    catchError,
} from "rxjs";
import { createRxDatabase, addRxPlugin } from "rxdb";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { RxDBDevModePlugin } from "rxdb/plugins/dev-mode";
import { z } from "zod";

addRxPlugin(RxDBDevModePlugin);

const dbInstances = new Map();

export const input = () => {
    const schema = z.object({
        operation: z.enum([
            "findOne",
            "upsert",
            "patch",
            "insert",
            "find",
            "remove",
        ]),
        collection: z.string(),
        params: z.record(z.any()).optional(),
    });

    return of(schema);
};

export const output = () => {
    const schema = z.object({
        result: z.union([
            z.array(z.record(z.any())),
            z.record(z.any()),
            z.null(),
        ]),
    });

    return of(schema);
};

export const config = () => {
    const schema = z.object({
        dbName: z.string(),
        collections: z.record(
            z.object({
                schema: z.record(z.any()),
                methods: z.record(z.function()).optional(),
                statics: z.record(z.function()).optional(),
                migrationStrategies: z.record(z.function()).optional(),
            })
        ),
    });

    return of(schema);
};

export const setupOperator = (operable) => {
    return operable.read.config$.pipe(
        switchMap(async (config) => {
            let db = dbInstances.get(config.dbName);
            if (!db) {
                let storage;
                if (typeof indexedDB !== "undefined") {
                    storage = getRxStorageDexie();
                } else {
                    storage = getRxStorageMemory();
                }
                db = await createRxDatabase({
                    name: config.dbName,
                    storage,
                });
                await db.addCollections(config.collections);
                dbInstances.set(config.dbName, db);
            }
            return db;
        })
    );
};

export const statusOperator = (operable) => {
    return {
        next: (result) => {
            operable.status$.next({
                status: "success",
                message: "Operation completed successfully",
                detail: result,
            });
        },
        error: (error) => {
            operable.status$.next({
                status: "error",
                message: "An error occurred during the operation",
                detail: error,
            });
        },
    };
};

const dbOperation = (operable) => {
    return pipe(
        mergeMap((input) => {
            const { operation, collection, params } = input;
            return from(setupOperator(operable)).pipe(
                switchMap((db) => {
                    const collectionInstance = db[collection];
                    let result;
                    switch (operation) {
                        case "find":
                        case "findOne":
                            result = collectionInstance[operation](params).$;
                            break;
                        case "insert":
                        case "upsert":
                        case "patch":
                        case "remove":
                            result = from(
                                collectionInstance[operation](params)
                            );
                            break;
                        default:
                            throw new Error(
                                `Unsupported operation: ${operation}`
                            );
                    }
                    return result;
                }),
                catchError((error) => {
                    operable.status$.next({
                        status: "error",
                        message:
                            "An error occurred during the database operation",
                        detail: error.message,
                    });
                    throw error;
                })
            );
        })
    );
};

export const key = "dbOperation";
export const version = "0.0.1";
export const description = "Performs operations on a database using RxDB.";
export default dbOperation;
