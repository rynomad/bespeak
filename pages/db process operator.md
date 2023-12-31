## Introduction

The `dbOperation` function is part of a database module that utilizes the RxDB library to perform operations on a database. It supports both IndexedDB and in-memory storage, providing flexibility in data management. The function accepts an array of operations to execute on the database and returns the results as Observables.
- ## Operator Identification
- **Key**: `dbOperation`
- **Version**: `0.0.1`
- **Description**: Performs operations on a database using RxDB.
- ## Dependencies
- `rxjs`: Used for creating Observables and implementing reactive programming patterns.
- `rxdb`: The core library for creating and managing the RxDB database.
- `rxdb/plugins/dev-mode`: Enables development mode in RxDB.
- `rxdb/plugins/storage-dexie`: Provides Dexie-based storage, used when IndexedDB is available.
- `rxdb/plugins/storage-memory`: Provides in-memory storage, used when IndexedDB is not available.
- [Quickstart Guide](https://rxdb.info/quickstart.html)
  [Rx Query](https://rxdb.info/rx-query.html)
  [Rx Storage Memory](https://rxdb.info/rx-storage-memory.html)
  [Rx Storage Dexie](https://rxdb.info/rx-storage-dexie.html)
  [Rx Schema](https://rxdb.info/rx-schema.html)
-
- ## Schema Definitions
- ### Input Schema
  
  An array of operations to be performed on the database, with each operation being an object that contains:
- `operation`: The type of operation (e.g., 'findOne', 'upsert', 'patch').
- `collection`: The target collection for the operation.
- `params`: The parameters for the operation.
- ### Output Schema
- The output is an Observable that emits the result of the database operation.
- ### Config Schema
	- Configuration object for the database module:
		- `dbName`: The name of the database.
		- `collections`: Configuration for the collections, including names and schemas.
- ## Operator Components
- ### Setup Operator
- Check if a database instance matching the config has already been created,
- If not, initializing the database with the provided `dbName` and `collections` configuration.
- store it in memory for later use.
- ## Process Operator Logic
- get the db instance
- execute the operation on the appropriate collection
- if the operation is a query, return it's observable form `$`
- if the operation is an insert/upsert, wrap the result in an observable