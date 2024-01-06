- process operators do the work of an [[operable]]
  title:: process operators
- operators are defined as an ECMAScript17 JavaScript ESM Module with the following export signature:
	- Mandatory exports
		- `default` - the operator factory function which returns an operator instance
			- `(operable) => operator`
				- `operable` - the [[operable]] instance that is using this operator
			- see [[operable]] for details on the operable object
			- see [[schema roles]] for details on the config and keys object
		- `key` - a unique key for the operator
		- `version` - semver version of the operator.
		- `description` - a clear and concise description of what the operator does.
		- [[schema operators]] for each of the [[schema roles]]
			- `input`
			- `output`
			- `config`
			- `keys`
- Runtimes:
	- process operators should aim to support, or gracefully fail, in the following runtimes:
		- modern web browsers
		- Deno
		- Node
		- Chrome extensions.
- Example Operator
- This operator provides access to a database singleton.
- ```javascript
   import {
       map,
       isObservable,
       of,
       from,
       pipe,
       combineLatest,
       mergeMap,
   } from "https://esm.sh/rxjs";
   import { createRxDatabase, addRxPlugin } from "rxdb";
   import { RxDBDevModePlugin } from "rxdb/plugins/dev-mode";
   import { z } from 'zod';
  
   addRxPlugin(RxDBDevModePlugin);
   
   
   export const key = "dbOperation";
   export const version = "0.0.1";
   export const description = `Access an RxDB database in Deno and the Browser.`
   
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
       return db;
   }
   
   
   
   export function input() {
       const schema = z.array(
           z.object({
               operation: z.string().description(
                   "The operation to be performed. Can be 'findOne', 'upsert', or 'patch'."
               ),
               collection: z.string().description(
                   "The collection on which the operation is to be performed."
               ),
               params: z.object().description("The parameters for the operation."),
           })
       ).description("An array of operations to be performed on the database.");
   
       return of(schema);
   }
   
   export function config() {
       const schema = z.object({
           dbName: z.string().description("The name of the database."),
           collections: z.object().description(
               "The rxDB configuration for the collections. This includes the name of the collection and its schema, among other options."
           ).additionalProperties(true),
       }).required(["dbName", "collections"]);
   
       return of(schema);
   }
  
  function setupDb(operable){
  	return operable.read.config$.pipe(
      	switchMap(config => {
              const db = memos.get(config.dbName) || getDB(config.dbName, config.collections);
       		memos.set(config.dbName, db);
             return of(db)
          })
      )
  }
   
   function dbOperation(operable) {
       return pipe(
         	 withLatestFrom(setupDB(operable))
           mergeMap(([operation, db]) => {
               return combineLatest({
                   operations: of(operation),
                   db: from(db),
               }).pipe(
                   map(({ operation, db }) => {
                      
                           try {
                               const { operation, collection, params } =
                                   _operation;
   
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
                       
                   }),
               );
           })
       );
   }
   
   export default dbOperation;
   
  ```