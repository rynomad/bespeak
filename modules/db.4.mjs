import { map, mergeMap, from, of, catchError, switchMap, tap } from 'rxjs';
import { createRxDatabase, addRxPlugin } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { z } from 'zod';

addRxPlugin(RxDBDevModePlugin);

const databases = new Map();

async function initializeDatabase(config) {
  let db;
  if (databases.has(config.dbName)) {
    db = databases.get(config.dbName);
  } else {
    const storage = self.indexedDB ? getRxStorageDexie() : getRxStorageMemory();
    db = await createRxDatabase({
      name: config.dbName,
      storage: storage,
    });
    await db.addCollections(config.collections);
    databases.set(config.dbName, db);
  }
  return db;
}

export const setupOperator = (operable) => {
  return of(operable.data.config)
    .pipe(
      mergeMap(config => from(initializeDatabase(config)))
    );
};

export const input = () => {
  const schema = z.array(
    z.object({
      operation: z.enum(['findOne', 'upsert', 'patch', 'find']),
      collection: z.string(),
      params: z.union([
        z.object({}).passthrough(),
        z.string(),
      ]),
    })
  );
  return of(schema);
};

export const output = () => {
  const schema = z.object({
    result: z.any()
  });
  return of(schema);
};

export const config = () => {
  const collectionSchema = z.object({
    name: z.string(),
    schema: z.object({}).passthrough(),
    methods: z.object({}).passthrough().optional(),
    statics: z.object({}).passthrough().optional(),
    attachments: z.object({}).passthrough().optional(),
    options: z.object({}).passthrough().optional(),
  }).passthrough();
  const schema = z.object({
    dbName: z.string(),
    collections: z.record(collectionSchema)
  });
  return of(schema);
};

export const statusOperator = (operable) => {
  return tap({
    next: (result) => {
      operable.status$.next({
        status: "success",
        message: "Database operation completed successfully.",
        detail: result
      });
    },
    error: (error) => {
      operable.status$.next({
        status: "error",
        message: "Database operation failed.",
        detail: error
      });
    }
  });
};

const dbOperation = (operable) => {
  return setupOperator(operable).pipe(
    switchMap(db => from(operable.data.input).pipe(
      mergeMap(operations => from(operations).pipe(
        mergeMap(async operation => {
          const collection = db[operation.collection];
          let result;
          switch (operation.operation) {
            case 'findOne':
              result = await collection.findOne(operation.params).exec();
              break;
            case 'find':
              result = await collection.find(operation.params).exec();
              break;
            case 'upsert':
              result = await collection.upsert(operation.params);
              break;
            case 'patch':
              result = await collection.atomicPatch(operation.params);
              break;
            default:
              throw new Error(`Unsupported operation: ${operation.operation}`);
          }
          return result;
        }),
        map(result => ({ result })),
        catchError(error => {
          operable.status$.next({
            status: "error",
            message: "Database operation failed.",
            detail: error.message
          });
          throw error;
        })
      ))
    )),
    statusOperator(operable)
  );
};

export const key = "dbOperation";
export const version = "0.0.1";
export const description = "Performs operations on a database using RxDB.";

export default dbOperation;