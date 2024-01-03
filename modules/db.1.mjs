import { BehaviorSubject, of, from, mergeMap, map, catchError } from 'rxjs';
import { createRxDatabase, addRxPlugin } from 'rxdb';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { z } from 'zod';

addRxPlugin(RxDBDevModePlugin);

const databases = new Map();

async function initializeDatabase(config) {
  let db;
  if (window.indexedDB) {
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
  return from(operable.data.config).pipe(
    mergeMap(async (config) => {
      if (!databases.has(config.dbName)) {
        const db = await initializeDatabase(config);
        databases.set(config.dbName, db);
      }
      return databases.get(config.dbName);
    })
  );
};

export const configSchema = () => {
  return of(
    z.object({
      dbName: z.string(),
      collections: z.record(
        z.object({
          name: z.string(),
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

export const inputSchema = () => {
  return of(
    z.object({
      operation: z.enum(['findOne', 'upsert', 'patch', 'insert', 'find', 'remove']),
      collection: z.string(),
      params: z.record(z.any()),
    })
  );
};

export const outputSchema = () => {
  return of(
    z.object({
      result: z.union([z.any(), z.array(z.any())]),
      success: z.boolean(),
      message: z.string().optional(),
    })
  );
};

const dbOperation = (operable) => {
  return operable.data$.pipe(
    mergeMap(({ operation, collection, params }) => {
      const db = databases.get(operable.data.config.dbName);
      if (!db) {
        throw new Error(`Database with name ${operable.data.config.dbName} not found.`);
      }
      const collectionInstance = db[collection];
      if (!collectionInstance) {
        throw new Error(`Collection ${collection} not found in database.`);
      }
      let result$;
      switch (operation) {
        case 'find':
        case 'findOne':
          result$ = collectionInstance[operation](params).$;
          break;
        default:
          result$ = from(collectionInstance[operation](params));
          break;
      }
      return result$.pipe(
        map(result => ({ result, success: true })),
        catchError(error => of({ result: null, success: false, message: error.message }))
      );
    })
  );
};

export const key = 'dbOperation';
export const version = '0.0.1';
export const description = 'Performs operations on a database using RxDB.';

export default dbOperation;