-
- ## Introduction
  The registrar module, identified as `registrar.mjs`, is designed to dynamically import JavaScript modules from a specified path and store them in a collection. This module is essential for managing the lifecycle of various JavaScript modules within an application, including their importation, versioning, and storage.
- ## Operator Identification
- **Key**: `registrar`
- **Version**: 0.0.1
- **Description**: Dynamically imports JavaScript modules, extracts their key and version, and stores them in a collection with an upsert operation.
- ## Dependencies
- **rxjs**: Utilizes operators such as `pipe`, `mergeMap`, `combineLatest`, `switchMap`, `of`, `catchError`, `EMPTY`, `map`, `from` for reactive programming.
- **Deno**: Uses `Deno.readTextFile` for reading module source code from the file system.
- **Blob**: Creates a Blob instance to handle the module source as a JavaScript type.
- **URL**: Uses `URL.createObjectURL` to create a URL for the Blob for importing.
- ## Schema Definitions
- **Input Schema**:
	- `path`: A string representing the path to the JavaScript module to be imported.
- **Output Schema**:
	- An array of operations, where each operation contains:
		- `operation`: The type of operation, e.g., "upsert".
		- `collection`: The name of the collection, e.g., "modules".
		- `params`: An object containing the `id`, `key`, `version`, and `data` (source code).
- **Config Schema**:
	- no config schema, export `null`
- **Keys Schema**:
	- no keys schema, export `null`
- ## Process Operator Logic
  The registrar module follows these steps:
  1. Takes a module path as input.
  2. Reads the module source code from the provided path.
  3. Dynamically imports the module from the source code.
  4. Extracts the key and version from the imported module.
  5. Creates an id from the key and version.
  6. Prepares an "upsert" operation to store the module in a collection named "modules", with the id, key, version, and the module's source code as parameters.
  7. If any error occurs during this process, it logs the error and returns an empty observable.
- ## Logging
- The module logs the following information:
	- When a module path is received.
	- When a module and its source have been received.
	- When a module save is mapped to operations.
- Error logging is also included, logging any errors that occur during the import and storage process.