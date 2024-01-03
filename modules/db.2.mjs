import { BehaviorSubject, firstValueFrom, from, of, switchMap } from 'rxjs';
import { z } from 'zod';
import { createRxDatabase, addRxPlugin } from 'rxdb';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';

addRxPlugin(RxDBDevModePlugin);

const dbInstances = new Map();

async function initializeDatabase(config) {
  let db;
  if (typeof indexedDB !== 'undefined') {
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

export const setupOperator = async (operable) => {
  const config = await firstValueFrom(operable.data.config);
  let db = dbInstances.get(config.dbName);
  if (!db) {
    db = await initializeDatabase(config);
    dbInstances.set(config.dbName, db);
  }
  return db;
};

export const statusOperator = (operable) => {
  return {
    initializing: () => operable.status$.next({ status: 'initializing', message: 'Initializing database' }),
    initialized: () => operable.status$.next({ status: 'initialized', message: 'Database initialized' }),
    operationStarted: (operation) => operable.status$.next({ status: 'operationStarted', message: `Operation ${operation} started` }),
    operationCompleted: (operation) => operable.status$.next({ status: 'operationCompleted', message: `Operation ${operation} completed` }),
    error: (error) => operable.status$.next({ status: 'error', message: 'An error occurred during the database operation', detail: error }),
  };
};

export const inputSchema = z.object({
  operation: z.enum(['findOne', 'upsert', 'patch', 'find', 'insert', 'remove']),
  collection: z.string(),
  params: z.any(),
});

export const outputSchema = z.object({
  result: z.any(),
});

export const configSchema = z.object({
  dbName: z.string(),
  collections: z.record(z.object({
    schema: z.object().passthrough(),
    methods: z.record(z.function()).optional(),
    statics: z.record(z.function()).optional(),
    migrationStrategies: z.record(z.function()).optional(),
  })),
});

export const key = "dbOperation";
export const version = "0.0.1";
export const description = "Performs operations on a database using RxDB.";

const dbOperation = (operable) => {
  const status = statusOperator(operable);

  return switchMap(async (input) => {
    const db = await setupOperator(operable);
    status.initialized();

    const { operation, collection, params } = input;
    status.operationStarted(operation);

    try {
      const collectionInstance = db[collection];
      let result;

      switch (operation) {
        case 'find':
        case 'findOne':
          result = collectionInstance[operation](params).$;
          break;
        default:
          result = await collectionInstance[operation](params);
          break;
      }

      status.operationCompleted(operation);
      return of({ result });
    } catch (error) {
      status.error(error);
      throw error;
    }
  });
};

export default dbOperation;