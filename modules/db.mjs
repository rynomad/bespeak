import {
    map,
    isObservable,
    of,
    from,
    pipe,
    withLatestFrom,
    combineLatest,
    tap,
    switchMap,
    mergeMap,
} from "https://esm.sh/rxjs";
import { createRxDatabase, addRxPlugin } from "rxdb";
import { RxDBDevModePlugin } from "rxdb/plugins/dev-mode";
const getText = async (path) => {
    try {
        const cwd = Deno.realPathSync(".");
        return await Deno.readTextFile(`${cwd}/${path}`);
    } catch (e) {
        return await fetch(path).then((res) => res.text());
    }
};

addRxPlugin(RxDBDevModePlugin);

const memos = new Map();

async function getDB(dbName, collections) {
    let db;
    if (self.indexedDB) {
        const { getRxStorageDexie } = await import(
            "rxdb/plugins/storage-dexie"
        );

        db = await createRxDatabase({
            name: dbName,
            storage: await getRxStorageDexie(),
        });
    } else {
        const { getRxStorageMemory } = await import(
            "rxdb/plugins/storage-memory"
        );

        db = await createRxDatabase({
            name: dbName,
            storage: await getRxStorageMemory(),
        });
    }

    await db.addCollections(collections);
    // console.log("db finished", db);
    return db;
}

export const key = "dbOperation";
export const version = "0.0.1";
export const description = `Performs operations on a database.`;

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
    const db =
        memos.get(config.dbName) || getDB(config.dbName, config.collections);
    memos.set(config.dbName, db);
    return pipe(
        mergeMap((operations) => {
            return combineLatest({
                operations: of(operations),
                db: from(db),
            }).pipe(
                map(({ operations, db }) => {
                    return operations.map((_operation) => {
                        try {
                            const { operation, collection, params } =
                                _operation;
                            // console.log(
                            //     "DB OPERATION",
                            //     collection,
                            //     operation,
                            //     params
                            // );
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
                            throw new Error(
                                `Error in dbOperation: ${err.message}`
                            );
                        }
                    });
                }),
                node.log("dbOperation: mapped operations")
            );
        })
    );
}

export default dbOperation;
