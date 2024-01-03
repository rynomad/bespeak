import { BehaviorSubject, from, of, switchMap, catchError } from 'rxjs';
import { z } from 'zod';
import { createRxDatabase, addRxPlugin } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';

addRxPlugin(RxDBDevModePlugin);
addRxPlugin(RxDBStorageDexiePlugin);
addRxPlugin(RxDBStorageMemoryPlugin);

export const key = 'dbOperation';
export const version = '0.0.1';
export const description = 'Performs operations on a database using RxDB.';

export const configSchema = (operable) => {
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
              encrypted: z.boolean()
            }).optional()
          })
        })
      )
    })
  );
};

export const inputSchema = (operable) => {
  return of(
    z.object({
      operation: z.enum(['findOne', 'find', 'upsert', 'insert', 'update', 'remove']),
      collection: z.string(),
      params: z.record(z.any()).optional()
    })
  );
};

export const outputSchema = (operable) => {
  return of(
    z.object({
      result: z.union([
        z.array(z.record(z.any())),
        z.record(z.any()),
        z.null()
      ]).optional(),
      error: z.instanceof(Error).optional()
    })
  );
};

const dbInstances = new Map();

export const setupOperator = async (operable) => {
  const { dbName, collections } = operable.data.config;

  let db = dbInstances.get(dbName);
  if (!db) {
    const storage = self.indexedDB ? await getRxStorageDexie() : await getRxStorageMemory();

    db = await createRxDatabase({
      name: dbName,
      storage: storage,
    });

    await db.addCollections(collections);

    dbInstances.set(dbName, db);
  }

  return db;
};

export default function dbOperationProcess(operable) {
  return operable.input$.pipe(
    switchMap(async (input) => {
      const db = await setupOperator(operable);
      const collection = db[input.collection];
      const operation = input.operation;
      const params = input.params || {};

      try {
        let result;
        switch (operation) {
          case 'findOne':
          case 'find':
            result = collection[operation](params).$;
            break;
          case 'upsert':
          case 'insert':
          case 'update':
          case 'remove':
            result = await collection[operation](params);
            break;
          default:
            throw new Error(`Unsupported operation: ${operation}`);
        }
        return { result };
      } catch (error) {
        return { error };
      }
    }),
    catchError((error) => {
      operable.status$.next({
        status: 'error',
        message: 'An error occurred during the database operation',
        detail: error
      });
      throw error;
    })
  );
}