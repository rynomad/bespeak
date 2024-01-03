import { BehaviorSubject, from, of, mergeMap, catchError } from 'https://esm.sh/rxjs';
import { createRxDatabase, addRxPlugin } from 'https://esm.sh/rxdb';
import { getRxStorageDexie } from 'https://esm.sh/rxdb/plugins/storage-dexie';
import { getRxStorageMemory } from 'https://esm.sh/rxdb/plugins/storage-memory';
import { z } from 'https://esm.sh/zod';

addRxPlugin(RxDBDevModePlugin);

export const key = "dbOperation";
export const version = "0.0.1";
export const description = "Performs operations on a database using RxDB.";

export const input = () => {
  return of(
    z.array(
      z.object({
        operation: z.enum(['findOne', 'find', 'upsert', 'insert', 'patch', 'remove']),
        collection: z.string(),
        params: z.record(z.any()).optional(),
      })
    )
  );
};

export const output = () => {
  return of(
    z.object({
      result: z.any(),
      error: z.string().optional(),
    })
  );
};

export const config = () => {
  return of(
    z.object({
      dbName: z.string(),
      collections: z.record(
        z.object({
          schema: z.object({
            version: z.number(),
            primaryKey: z.string(),
            type: z.literal('object'),
            properties: z.record(z.any()),
            required: z.array(z.string()),
            indexes: z.array(z.union([z.string(), z.array(z.string())])).optional(),
            encrypted: z.array(z.string()).optional(),
            attachments: z.object({
              encrypted: z.boolean(),
            }).optional(),
          }),
        })
      ),
    })
  );
};

const dbInstances = new Map();

export const setupOperator = async (config) => {
  const { dbName, collections } = config;

  let db = dbInstances.get(dbName);
  if (!db) {
    const storage = typeof indexedDB !== 'undefined' ? getRxStorageDexie() : getRxStorageMemory();
    db = await createRxDatabase({
      name: dbName,
      storage: storage
    });
    await db.addCollections(collections);
    dbInstances.set(dbName, db);
  }

  return db;
};

const processOperator = (operable) => {
  return mergeMap(async (operations) => {
    const db = await setupOperator(operable.config);
    return from(operations).pipe(
      mergeMap(async (operation) => {
        try {
          const { collection, params } = operation;
          let result;
          switch (operation.operation) {
            case 'findOne':
            case 'find':
              result = db[collection][operation.operation](params).$;
              break;
            case 'upsert':
            case 'insert':
            case 'patch':
            case 'remove':
              result = await db[collection][operation.operation](params);
              break;
            default:
              throw new Error(`Unsupported operation: ${operation.operation}`);
          }
          return { result };
        } catch (error) {
          return { error: error.message };
        }
      }),
      catchError((error) => of({ error: error.message }))
    );
  });
};

export default processOperator;