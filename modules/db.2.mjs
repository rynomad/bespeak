import {
    BehaviorSubject,
    from,
    isObservable,
    of,
    switchMap,
    pipe,
    mergeMap,
    withLatestFrom,
    combineLatest,
    map,
} from "rxjs";
import { createRxDatabase, addRxPlugin } from "rxdb";
import { RxDBDevModePlugin } from "rxdb/plugins/dev-mode";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { z } from "zod";

addRxPlugin(RxDBDevModePlugin);

const dbInstances = new Map();

async function initializeDatabase(config) {
    let db;
    if (typeof indexedDB !== "undefined") {
        db = await createRxDatabase({
            name: config.dbName,
            storage: getRxStorageDexie(),
        });
    } else {
        db = await createRxDatabase({
            name: config.dbName,
            storage: getRxStorageMemory(),
        });
    }
    await db.addCollections(config.collections);
    return db;
}

export const setupOperator = (operable) => {
    return operable.read.config$.pipe(
        switchMap(async (config) => {
            let db = dbInstances.get(config.dbName);
            if (!db) {
                db = initializeDatabase(config);
                dbInstances.set(config.dbName, db);
            }
            return await db;
        })
    );
};

export const inputSchema = (operable) => {
    return of(
        z.object({
            operation: z.enum([
                "findOne",
                "upsert",
                "patch",
                "find",
                "insert",
                "remove",
            ]),
            collection: z.string(),
            params: z.record(z.any()).optional(),
        })
    );
};

export const outputSchema = (operable) => {
    return of(
        z.object({
            result: z.any(),
        })
    );
};

export const configSchema = (operable) => {
    return of(
        z.object({
            dbName: z.string(),
            collections: z.record(
                z.object({
                    schema: z.object({
                        version: z.number(),
                        primaryKey: z.string(),
                        type: z.literal("object"),
                        properties: z.record(z.any()),
                        required: z.array(z.string()),
                        encrypted: z.array(z.string()).optional(),
                        attachments: z
                            .object({
                                encrypted: z.boolean(),
                            })
                            .optional(),
                    }),
                })
            ),
        })
    );
};

const dbOperation = (operable) => {
    const db$ = setupOperator(operable);
    return (input$) =>
        combineLatest(input$, db$).pipe(
            mergeMap(([input, db]) => {
                const { operation, collection, params } = input;
                const collectionInstance = db[collection];
                let result;
                switch (operation) {
                    case "findOne":
                    case "find":
                        result = collectionInstance[operation](params).$;
                        break;
                    case "insert":
                    case "upsert":
                    case "patch":
                    case "remove":
                        result = from(collectionInstance[operation](params));
                        break;
                    default:
                        throw new Error(`Unsupported operation: ${operation}`);
                }

                if (!isObservable(result)) {
                    result = of(result);
                }

                return result;
            }),
            map((result) => (result ? result.toMutableJSON?.() : result))
        );
};

export const key = "dbOperation";
export const version = "0.0.1";
export const description = "Performs operations on a database using RxDB.";

export default dbOperation;
