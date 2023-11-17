import { map, catchError, isObservable, of } from "https://esm.sh/rxjs";
import { createRxDatabase, addRxPlugin } from "rxdb";
import { RxDBDevModePlugin } from "rxdb/plugins/dev-mode";

addRxPlugin(RxDBDevModePlugin);

async function getDB(dbName, collections) {
    let db;
    if (window.indexedDB) {
        const { getRxStorageDexie } = await import(
            "rxdb/plugins/storage-dexie"
        );

        db = createRxDatabase({
            name: dbName,
            storage: await getRxStorageDexie(),
        });
    } else {
        const { getRxStorageMemory } = await import(
            "rxdb/plugins/storage-memory"
        );

        db = createRxDatabase({
            name: dbName,
            storage: await getRxStorageMemory(),
        });
    }

    await db.createCollections(collections);
}

export const key = "dbOperation";
export const version = "0.0.1";
export const description =
    "The dbOperation operator is a higher-order function that takes a configuration object and returns a function that operates on an Observable of database operations. The configuration object should include the database name and collections. The operator maps each operation (which should be an object with operation, collection, and params properties) to a corresponding operation on the specified collection in the database. The result of each operation is ensured to be an Observable.";

export function inputSchema() {
    const schema = {
        type: "array",
        description: "An array of operations to be performed on the database.",
        items: {
            type: "object",
            properties: {
                operation: {
                    type: "string",
                    description:
                        "The operation to be performed. Can be 'findOne', 'upsert', or 'patch'.",
                },
                collection: {
                    type: "string",
                    description:
                        "The collection on which the operation is to be performed.",
                },
                params: {
                    type: "object",
                    description: "The parameters for the operation.",
                },
            },
            required: ["operation", "collection", "params"],
        },
    };

    return of(schema);
}

export function configSchema() {
    const schema = {
        type: "object",
        properties: {
            dbName: {
                type: "string",
                description: "The name of the database.",
            },
            collections: {
                type: "object",
                description:
                    "The rxDB configuration for the collections. This includes the name of the collection and its schema, among other options.",
                additionalProperties: true,
            },
        },
        required: ["dbName", "collections"],
    };

    return of(schema);
}

function dbOperation({ config, node }) {
    let db;
    return (operations$) =>
        operations$.pipe(
            map(async (operations) => {
                if (!db) {
                    db = await getDB(config.dbName, config.collections);
                }
                return operations.map((_operation) => {
                    try {
                        const { operation, collection, params } = _operation;
                        let result = db[collection][operation](params);
                        result = result.$ || result;
                        // Ensure the result is an Observable
                        if (!isObservable(result)) {
                            result = of(result);
                        }

                        return result;
                    } catch (err) {
                        node.status$.next(
                            `Error in dbOperation: ${err.message}`
                        );
                        throw new Error(`Error in dbOperation: ${err.message}`);
                    }
                });
            })
        );
}

export default dbOperation;
