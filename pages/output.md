## Templates.md
template::  process operator requirements
	- # Requirements Document Template for Process Operator Development
	- ## Introduction
		- Provide a brief introduction to the process operator being developed, including its purpose and potential use cases.
	- ## Operator Identification
		- **Key**: A unique identifier for the operator.
		- **Version**: The semantic versioning (semver) of the operator.
		- **Description**: A clear and concise description of what the operator does.
	- ## Dependencies
		- List any external dependencies required by the operator, including libraries, frameworks, or other operators.
		- Include links to relevant web documentation
	- ## Schema Definitions
		- **Input Schema**:
			- Define the expected input data to the operator.
		- **Output Schema**:
			- Define the output data from the operator.
		- **Config Schema**:
			- Define the configuration used to construct an instance of the operator.
		- **Keys Schema**:
			- Define the keys shared by all instances of the operator.
	- ## Operator Components
		- **Setup Operator**:
			- Describe any setup required before the operator can function.
		- **Tool Operator**:
			- Describe any tools that the operator will use to perform its tasks.
		- **Status Operator**:
			- Describe how the operator will report its status or handle errors.
	- ## Process Operator Logic
		- Describe the logic and flow of the process operator, including how it will compose the setup, tool, and status operators to achieve the desired functionality.
	- ## Logging
		- Outline the logging strategy for the operator, including what information will be logged and at what level (e.g., debug, info, error).
		  --e
- ## data roles.md
- [[nodes]] have 5 data roles which are used to store configuration and parameterization which defines the nodes behavior
	- `node` - entry point which declares the following:
		- id - string
		- ingress - `module@version`
		- process - `module@version`
		- name - optional human readable name
		- description - optional contextual description of what the node is for.
	- `ingress:config`, `ingress:keys`, `process:config`, and `process:keys`
		- `:config`: per-node config for the respective operator
			- defined by the `:config` [[schema roles]]
			-
		- `:keys`: shared keydata for all instances of the operator-e
- ## db process operator.md
- ## Introduction
  
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
- if the operation is an insert/upsert, wrap the result in an observable-e
- ## fetch process operator.md
-
- ## Introduction
  
  The fetch operator is designed to retrieve and parse the HTML content of web pages using the readability.js library. The primary purpose of this operator is to extract the main content from web pages, stripping away clutter such as ads and sidebars. This operator will be particularly useful for applications that require clean and readable content for further processing or display, such as content aggregators, readability tools, and text analysis applications.
- ## Operator Identification
- **Key**: fetch-readability-operator
- **Version**: 1.0.0
- **Description**: An operator that fetches HTML content from a specified URL, parses it using readability.js, and optionally reinserts image and/or anchor tags into the parsed content.
- ## Dependencies
- **readability.js**: A library for parsing HTML content and extracting the main body of text in a readable format.
	- Documentation: [Readability.js GitHub Repository](https://github.com/mozilla/readability)
- **node-fetch**: A light-weight module that brings `window.fetch` to Node.js.
	- Documentation: [node-fetch NPM Package](https://www.npmjs.com/package/node-fetch)
- ## Schema Definitions
- **Input Schema**:
	- `url`: The URL of the web page to fetch and parse (string, required).
	- `includeImages`: Flag to indicate whether to reinsert image tags in the output (boolean, optional, default: false).
	- `includeLinks`: Flag to indicate whether to reinsert anchor tags in the output (boolean, optional, default: false).
- **Output Schema**:
	- `title`: The title of the parsed content (string).
	- `content`: The main body of the parsed content, with optional images and links (string).
	- `textContent`: The text content of the parsed content without HTML tags (string).
	- `length`: The length of the text content (number).
	- `excerpt`: A short excerpt or summary of the content (string).
	- `siteName`: The name of the website or publication (string).
- **Config Schema**:
	- `userAgent`: The user agent string to use when making the fetch request (string, optional).
	- `timeout`: The maximum time to wait for a response (number, optional, default: 5000ms).
- **Keys Schema**:
	- No shared keys are required for this operator.
- ## Operator Components
- **Setup Operator**:
	- Initialize the readability.js library and configure the node-fetch module with the provided user agent and timeout.
- **Tool Operator**:
	- Use node-fetch to retrieve HTML content from the specified URL.
	- Pass the fetched HTML content to readability.js for parsing.
	- Reinsert images and/or links into the parsed content if the respective flags are set.
- **Status Operator**:
	- The operator will return a status object indicating success or failure.
	- In case of errors, the status object will include an error message and code.
- ## Process Operator Logic
  
  1. Receive input parameters including the URL and optional flags for images and links.
  2. Perform an HTTP GET request to the URL using node-fetch.
  3. On successful retrieval, pass the HTML content to readability.js for parsing.
  4. If `includeImages` is true, reinsert `<img>` tags into the content at their original location.
  5. If `includeLinks` is true, reinsert `<a>` tags into the content at their original location.
  6. Return the parsed content along with metadata such as title, excerpt, and site name.
  7. Handle any errors that occur during the fetch or parsing process and return a status object with error details.
- ## Logging
- The operator will log the following information:
	- `debug`: Details about the fetch request and parsing process.
	- `info`: Summary of the operation including URL fetched and status.
	- `error`: Any errors encountered during the operation with stack traces.-e
- ## gmail process operator.md
- ## Introduction
  The Gmail Search Operator is designed to allow users to search through their Gmail accounts using specific queries. This operator will enable users to filter their emails based on various criteria such as sender, date, subject, and keywords. The potential use cases include finding specific emails quickly, organizing inbox, and automating email management tasks.
- ## Operator Identification
- **Key**: `gmail-search-operator`
- **Version**: `1.0.0`
- **Description**: This operator allows users to search and retrieve emails from their Gmail account based on user-defined search queries.
- ## Dependencies
- Google API Client Libraries: Required for authenticating and interfacing with the Gmail API.
	- Documentation: [Google API Client Libraries](https://developers.google.com/api-client-library)
- OAuth 2.0 Authorization Framework: For secure access to user's Gmail account.
	- Documentation: [OAuth 2.0](https://oauth.net/2/)
- ## Schema Definitions
- **Input Schema**:
	- `query`: The search query string in Gmail search syntax.
	- `maxResults`: (Optional) Maximum number of email results to return.
- **Output Schema**:
	- `emails`: An array of email objects, each containing:
		- `id`: The unique identifier of the email.
		- `threadId`: The thread identifier to which this email belongs.
		- `snippet`: A brief snippet of the email content.
		- `labels`: An array of label identifiers applied to the email.
- **Config Schema**:
	- `credentials`: User's OAuth 2.0 credentials for Gmail API access.
	- `token`: Access token for the user's Gmail account.
- **Keys Schema**:
	- `apiKey`: The API key for the Gmail API.
	- `clientSecret`: The client secret for the Gmail API.
- ## Operator Components
- **Setup Operator**:
	- Responsible for obtaining and refreshing OAuth 2.0 credentials.
- **Tool Operator**:
	- Utilizes the Gmail API to execute search queries and retrieve email data.
- **Status Operator**:
	- Reports the status of the search operation and handles any errors encountered during the process.
- ## Process Operator Logic
- The Gmail Search Operator will start by using the Setup Operator to ensure that valid OAuth 2.0 credentials are available. It will then pass the search query to the Tool Operator, which interacts with the Gmail API to fetch the emails that match the query. The Status Operator will monitor the operation, handle any exceptions, and provide feedback on the operation's success or failure.-e
- ## gpt process operator.md
- ## Introduction
- The GPT operator is designed to handle invoking GPT chat models. It is used to process an array of messages, append a configured message, and make API calls to generate responses.
- ## Operator Identification
- **Key**: GPT Operator
- **Version**: 0.0.1
- **Description**: The operator takes an array of messages as input, appends a configured message, and then calls the openai chat endpoint.
- ## Dependencies
- openai-node library
	- https://www.npmjs.com/package/openai -
		- this gives an overview of the openai module
	- https://github.com/openai/openai-node/blob/HEAD/helpers.md
		- this gives details on how to use the runner returned by the `stream()` and `runFunctions()`
		- It lists all the events you'll need to listen for.
- ## Schema Definitions
- **Input Schema**:
	- `messages`: a message array to be used as history
- **Output Schema**:
	- `messages`: The total message array, including all received messages, optionally filtered based on configuration
- **Config Schema**:
	- `prompt`: The prompt content to be appended to the incoming message array.
	- `role`: The role to be used with the prompt content, can be "user", "assistant", or "system".
		- default "user"
	- `temperature`: Controls randomness in the generation process.
		- between 0 and 1 in 0.1 increments
		- default "0.3"
	- `model`: The model to be used for generating responses.
		- default gpt-4
		- the available models are fetched with a snippet like this
			- ```javascript
			  const response = await openai.models.list();
			  try {
			    return response.data
			      .map((model) => model.id)
			      .filter((id) => id.startsWith("gpt"));
			  } catch (e) {
			    console.warn(e);
			    return [
			      "gpt-4",
			      "gpt-3.5-turbo-0613",
			      "gpt-4-1106-preview",
			      "gpt-3.5-turbo-1106",
			      "gpt-4-vision-preview",
			    ];
			  }
			  ```
	- `tools`: Whether to expose tools to the LLM, can be "user", "none", or "all".
	- `clean`: Whether to strip system and/or user messages from the returned message history.
- **Keys Schema**:
	- `apiKey`: the apiKey for the openai client.
- ## Operator Components
- **Setup Operator**:
	- configure the openai client with dangerouslyAllowBrowser: true and the api keys
- **Tool Operator**:
	- Transforms node [[tools]] into the expected format for the `runFunctions` call.
		- name: node.id
		- function: an async wrapper function around a single invocation of the `toolNode.operator()`
		- parse: JSON.parse
		- description: systemData.description
		- parameters: inputSchema
	- https://github.com/openai/openai-node/blob/HEAD/helpers.md
		- This documents the api for using functiona
- **Status Operator**:
	- take the runner returned from the the and listen to all the events and emit them on the status$ interface.
	- Make sure to consult this document before writing the status operator:
		- https://github.com/openai/openai-node/blob/HEAD/helpers.md
			- this gives details on how to use the runner returned by the `stream()` and `runFunctions()`
			- It lists all the events you'll need to listen for.
- ## Process Operator Logic
- with latest from setup and tool operators
- append a new message based on the configured prompt and role to the messages array
- based on configuration, call `client.beta.chat.completions.stream()` or `client.beta.chat.completions.runFunctions()`
- use the status operator to emit status events for ALL events emitted by the runner
- `await .finalMessage()` to get the last message and append it to the messages array
- emit the completed output.
- ## Logging
- don't worry about logging.-e
- ## imports process operator.md
- ## Introduction
  The "Memoized Imports" operator is designed to efficiently handle the importation of modules by memoizing the results. This process operator is particularly useful in scenarios where modules are repeatedly imported, as it caches the imported modules to avoid redundant network requests or processing. It is applicable in systems that dynamically load modules at runtime and require optimization to improve performance.
- ## Operator Identification
- **Key**: `imports`
- **Version**: `0.0.1`
- **Description**:  imports takes an array of module documents and returns an array of imported modules.
- ## Dependencies
- **rxjs**: A library for reactive programming using Observables, to make it easier to compose asynchronous or callback-based code. [RxJS Documentation](https://rxjs.dev/guide/overview)
- ## Schema Definitions
- **Input Schema**:
	- Type: `array`
	- Items:
		- Type: `object`
		- Properties:
			- `id`: A string identifier for the module.
			- `data`: A string containing the module data.
- **Output Schema**:
	- an array of imported modules.
- **Config Schema**:
	- There is no config schema, export `null`
- **Keys Schema**:
	- There is no keys schema, export `null`
- ## Operator Components
- **Setup Operator**:
	- setup memoization
- **Tool Operator**:
	- The operator uses the `system:db` tool to interact with a database for fetching module documents.
- **Status Operator**:
	- The operator uses logging with the `node.log("memoizedImport")` method to report its status or handle errors.
- ## Process Operator Logic
- The operator works by taking an array of module identifiers or documents, checking if the module has already been memoized, and if not, fetching the module document from the database, creating a blob from the module data, generating a URL for the blob, and dynamically importing the module. The imported module is then memoized to optimize subsequent imports.-e
- ## index.md
  Templates.md
  data roles.md
  db process operator.md
  fetch process operator.md
  gmail process operator.md
  gpt process operator.md
  imports process operator.md
  index.md
  interfaces.md
  nodes.md
  process operators.md
  registrar process operator.md
  runtime.md
  schema operators.md
  schema roles.md
  schemas.md
  setup operator.md
  status messages.md
  status operator.md
  template test.md
  tool operator.md
  tools.md
  validator process operator.md
  writing a process operator.md
  -e
- ## interfaces.md
- An interface is an RxJS ReplaySubject configured to always emit it's last single value
	- see https://rxjs.dev/guide/operators#creation-operators-1
- Interfaces are intended to be writable or readable.-e
- ## nodes.md
- A Node is the central building block for a [[flow]].
- Nodes are wrappers around two rxjs [[process operators]]
	- the `process` operator does the actual work of the node (api calls, data transformation, state management)
	- the `ingress` operator is responsible for piping one or more upstream nodes into a single observable to be piped into the `process` operator. The [[Default Ingress]] simply performs basic schema matching, but more advanced ingress operators could do more complex data manipulation to normalize upstream output to downstream input.
- There are 5 [[data roles]] for a node.
- A Node additionally has [[tools]], which are just other nodes.
	- A user or programmer may add tools to a node
	- Tools are used by way of the `node.operator()` function
	- There are several built-in [[system tools]]
		- `system:db` - access the database
		- `system:validator` - validate incoming data against one of a nodes [[schema roles]]
		- `system:imports` - import ESM modules by `module@version`
		- `system:registrar` - register an ESM module into the system so it can be imported
- Nodes have the following [[interfaces]]
	- writables
		- `upstream$` - accepts arrays of nodes to be fed into the ingress
		- `flowTools$` - accepts arrays of nodes to be used as [[flow tools]]
		- `status$` - accepts [[status messages]]
	- readables
		- `tools$` - emits a combined array of [[system tools]] and [[flow tools]]
		  ```javascript
		  node.tools.pipe(
		  tap((toolNodes) => console.log(toolNodes.map(node => node.id)))
		  // ['system:db','system:validator','system:imports','system:registrar']
		  )
		  ```
- Nodes have the following methods
	- `operator({node, config}) => operator`
		- returns a new instance the bare `process` [[process operators]] for use elsewhere
		- `config` is optional. If omitted, the existing config for the node will be used
		- `node` is optional. If omitted, the node being called will be used.
	- `read$$(datarole) => observable`
		- read the data from the database for the appropriate role
		- ```javascript
		  // read the currect config for the process operator
		  node.read$$("process:config").subscribe(config => {
		    console.log(node.id, 'config:', config)
		  })
		  ```
	- `write$$(datarole, data) => observable`
		- write data for the given role, the observable emits when the write is complete
		- ```
		  // write config for the process operator
		  node.write$$("process:config", { prompt: "prompt data for this node" }).subscribe(config => {
		    console.log(node.id, 'wrote config:', config)
		  })
		  ```
	- `tool$$(id) => observable`
		- get a tool by the given id
		- ```javascript
		  node.tool$$("system:db").subscribe(dbNode => {
		    of({
		  	operation: 'upsert',
		      collection: 'notes',
		      params: {
		        id: 'newnote',
		        note: 'this is how you use tools...'
		      }
		    }).pipe(dbNode.operator()).subscribe(() => {
		      console.log('data written')
		    })
		  })
		  ```
	- `schema$$(schemarole) => observable<schema>`
		- returns an observable that emits the schema for the given [[schema role]]
		- ```javascript
		  // get the config schema for the ingress
		  node.schema$$("ingress:config").subscribe(schema => {
		    console.log('got ingress config schema for',node.id)
		  })
		  
		  ```
	- `log(message) => operator`
		- this is a wrapper around `tap` and `console log`. it is equivalent do the following:
		- ```javascript
		  tap((value) => {
		    console.log(node.id, message, value)
		  })
		  ```-e
- ## process operators.md
- process operators are the unit of the system. they are used in [[nodes]]  `process` role
  title:: process operators
  title:: operators
- operators are defined as an ECMAScript17 JavaScript ESM Module with the following export signature:
	- Mandatory exports
		- `default` - the operator factory function which returns an operator instance
			- `({node, config, keys}) => operator`
				- `node` - the node instance that is using this operator
				- `config` - configuration data for the operator
				- `keys` - key data for the operator
			- see [[nodes]] for details on the node object
			- see [[schema roles]] for details on the config and keys object
		- `key` - a unique key for the operator
		- `version` - semver version of the operator.
		- `description` - a clear and concise description of what the operator does.
		- [[schema operators]] for each of the [[schema roles]]
			- `inputSchema` - `input` role
			- `outputSchema` - `output` role
			- `configSchema` - `config` role
			- `keysSchema` - `keys` role (optional if keys are not relevant)
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
   
   addRxPlugin(RxDBDevModePlugin);
   
   
   export const key = "dbOperation";
   export const version = "0.0.1";
   export const prompt = `Access an RxDB database in Deno and the Browser.`
   
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
   
  ```-e
- ## registrar process operator.md
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
- Error logging is also included, logging any errors that occur during the import and storage process.-e
- ## runtime.md
- This is an isomorphic javascript library.
- The core of the library supports:
	- Node
	- Deno
	- Electron
	- Web
	- Chrome extensions-e
- ## schema operators.md
- Schema Operators are custom RxJS creation operators that provide [[schemas]] for one of the [[schema roles]]
  title:: schema operators
- all schema operators are optional. If they are omitted, the system will simply accept all data for that schema role.
- factory signature for a schema operator:
	- `({node, config, keys}) => observable<schema>`
	- example:
		- ```javascript
		  export const outputSchema = (context) => {
		      return of({
		          $schema: "http://json-schema.org/draft-07/schema#",
		          title: "ChatGPT Message History Output",
		          description:
		              "The output schema for the message history after processing through the custom RxJS operator for ChatGPT.",
		          type: "object",
		          properties: {
		              messages: {
		                  type: "array",
		                  items: {
		                      $ref: "#/definitions/message",
		                  },
		              },
		              code: {
		                  type: "string",
		                  description:
		                      "The last code block from the accumulated response.",
		              },
		              json: {
		                  type: "object",
		                  description:
		                      "If the last code block from the accumulated response was JSON, this is the parsed JSON object.",
		                  additionalProperties: true,
		              },
		          },
		          definitions: {
		              message: {
		                  type: "object",
		                  properties: {
		                      role: {
		                          type: "string",
		                          enum: ["user", "assistant", "system"],
		                          description: "The role of the message sender.",
		                      },
		                      content: {
		                          type: "string",
		                          description: "The content of the message.",
		                      },
		                  },
		                  required: ["role", "content"],
		              },
		          },
		          required: ["messages"],
		      });
		  };
		  ```
- we return an observable so that our schemas can by more expressive
	- For example, consider the case where we are want to be able to configure an operator to access one of a users storage buckets via a cloud storage provider.
	- we want the config schema to have an enum of the users buckets
	- in order to get the list of buckets, we have to make an authenticated api call, which means we need keys.
	- therefor, we construct all of our schema operators as creation operators that themselves receive the node, config, and keys values.
	- Since we don't know in advance what the dependencies would look like for construction of these schemas, we always call the schema operators once with null values for config and keys.
	- It is imperative that schema operators handle this case gracefully.
	- Here's an example of how you might use this to fetch models for a gpt process operator config
		- ```javascript
		  const getModels = async ({ apiKey }) => {
		      const openai = new OpenAI({
		          apiKey,
		          dangerouslyAllowBrowser: true,
		      });
		      const response = await openai.models.list();
		      try {
		          return response.data
		              .map((model) => model.id)
		              .filter((id) => id.startsWith("gpt"));
		      } catch (e) {
		          console.warn(e);
		          return [
		              "gpt-4",
		              "gpt-3.5-turbo-0613",
		              "gpt-4-1106-preview",
		              "gpt-3.5-turbo-1106",
		              "gpt-4-vision-preview",
		          ];
		      }
		  };
		  
		  // ChatGPT Operator Configuration Schema
		  export const configSchema = ({ node, keys }) => {
		      const models$ = keys?.apiKey
		          ? from(getModels(keys))
		          : of([
		                "gpt-4",
		                "gpt-3.5-turbo-0613",
		                "gpt-4-1106-preview",
		                "gpt-3.5-turbo-1106",
		                "gpt-4-vision-preview",
		            ]);
		  
		      return models$.pipe(
		          map((models) => ({
		             // return a schema with the models
		          }))
		      );
		  };
		  ```-e
- ## schema roles.md
- there are 4 roles that define [[schemas]] for various data for [[process operators]]
	- `input` - expected input data to the operator
	- `output` - output data from the operator
	- `config` - configuration used to construct an instance of the operator
		- passed into the [[process operators]] factory function
	- `keys` - keys shared by all instances of an operator
		- passed into the [[process operators]] factory function
- accessing schema roles will typically be prefixed by the role of the operator, `process` or `config`
	- ```javascript
	  node.schema$$('process:keys').subscribe(schema => console.log(schema))
	  ```
	  --e
- ## schemas.md
- Schemas are defined as JSON schemas.
- Schemas make liberal use of titles, defaults, descriptions, examples, and enums to aid in the procedural generation of form UI and generation of default data objects.
- Schemas are thorough, but not insane: if a schema needs to define a property that is a complex object (say, an observable or websocket connection), it should simply note in the description what it is, ducktype a couple parameters, and set `additionalProperties` to `true`.
- Schemas have an object root, never an array or primitive value.
	- sometimes this seems excessive when an operator only cares about a single value, but knowing that we're always dealing with objects gives us more flexibility to add things later without breaking changes.
- The object root of the schema always has `additionalProperties` set to `true`-e
- ## setup operator.md
- A setup operator is a helper to do any initialization at the time of invoking the operator factory.
- For example, you may use a setup operator to initialize an api client:
- ```javascript
  const setupOperator = ({node, config, keys}) => {
    const client = new Client(keys.apiKey)
    client.setConfig(config.clientConfig)
    return of(client)
  }
  ```
	- this is a trivial example, but in more complex scenarios it can be useful to have this setup logic factored out
- You would then use your setup operator in a process operator like so:
	- ```javascript
	  import {pipe, from, withLatestFrom} from "https://esm.sh/rxjs"
	  
	  export default function myProcessOperator({node, config, keys}) {
	    return pipe(
	    	withLatestFrom(setupOperator({node, config, keys})),
	      switchMap(([input, client]) => from(client.makeApiCall(input)))
	    )
	  }
	  ```-e
- ## status messages.md
- status messages are useful for providing progress while an operator is running.
- status messages are emitted on the `node.status$` [[interface]]
- a status message object has three top level properties:
	- status - a one word status type
	- message - a short useful message
	- detail - any arbitrary data specific to the status type-e
- ## status operator.md
- The `node.status$` [[interface]] is used to emit status events or intermediate results.
- [[status messages]] have a simple schema
- If any operator is doing complex or long running work, it can be helpful to emit status events
- setting up these status events in a dedicated sub operator can make code easier to read by removing it from the main flow.
- let's say we have a client library that gives us an event emitter, we want to capture some number of events and emit them as status messages
- ```javascript
  const statusOperator = ({node, config, keys}) => {
     return pipe(
       tap(client => {
         ["events","to","monitor"].forEach(evt => client.on(evt, (event) => node.status$.next({
   			status: evt,
              message: `got ${evt} event`,
              detail: event
  		})))
       })
     )
  }
  ```
- the above is a simplified example, you would usually have more meaningful construction of the status message based on the requirements and access to documentation for the events you're monitoring.
- You would use it in your main operator like so:
	- ```javascript
	  export default function myStatusEmittingProcess({node, config, keys}){
	    return pipe(
	  	withLatestFrom(setupOperator.pipe(statusOperator({node, config, keys})))
	      switchMap(([input, client]) => from(client.doTask(input))
	    )
	  }
	  ```
- You could also see a scenario where an api call returns an event emitter
	- ```javascript
	  const statusOperator = ({node, config, keys}) => {
	    return pipe(
	    	tap(response => {
	              ["events","to","monitor"].forEach(evt => client.on(evt, (event) => node.status$.next({
	   			status: evt,
	              message: `got ${evt} event`,
	              detail: event
	  		})))
	      })
	    )
	  }
	  ```
- you could use it like so
	- ```javascript
	  export default function myStatusEmittingProcess({node, config, keys}){
	    return pipe(
	  	withLatestFrom(setupOperator)
	      switchMap(([input, client]) => from(client.doTask(input))
	    	statusOperator({node, config, keys})
	    )
	  }
	  ```
- When writing status operators, you will often need to consult web documentation to get lists of events-e
- ## template test.md
-
	- # Requirements Document Template for Process Operator Development
	- ## Introduction
	  Provide a brief introduction to the process operator being developed, including its purpose and potential use cases.
	- ## Operator Identification
	- **Key**: A unique identifier for the operator.
	- **Version**: The semantic versioning (semver) of the operator.
	- **Description**: A clear and concise description of what the operator does.
	- ## Dependencies
	  List any external dependencies required by the operator, including libraries, frameworks, or other operators.
	- ## Schema Definitions
	  Define the schemas for the various roles associated with the operator:-e
- ## tool operator.md
- a tool operator is a helper to present [[node tools]] in the fashion that they are needed for another use.
- since tools are [[nodes]], often you'll need to wrap their functionality to interface with another system.
- The relevant apis on tool nodes are:
- id - if you need an id or name in another system, use node.id
- `.read$$('system')` - use this to get system data if you need to provide a description to another system
	- `read$$` returns an observable that emits the system data, which has a `description` property.
- `.schema$$('process:input')` use the schema function to get the input schema for the tool
	- ```javascript
	  node.schema$$("process:input").subscribe(schema => console.log(schema))
	  ```
- `.operator()` - use this to get a configured rxjs operator
	- you may need to wrap it in a function to match other interfaces
	- ```javascript
	  async (input) => new Promise((resolve,reject) => of(input).pipe(
	    node.operator()
	  ).subscribe({next: resolve, error: reject})
	  ```
- `tools$` - this interface is an observable emits arrays of all available tool nodes.
- `tool$$(toolID)` - this function returns an observable that emits the appropriate tool.-e
- ## tools.md
- Tools are [[nodes]] that are used by other nodes as bare operators.-e
- ## validator process operator.md
- ## Introduction
  The `validator` process operator is designed to validate data against a specified JSON schema. It ensures that the data being processed conforms to predefined standards and rules. This operator is essential for maintaining data integrity and is commonly used in scenarios where data validation is a critical step, such as form submissions, configuration settings, and data transformation processes.
- ## Operator Identification
- **Key**: `validator`
- **Version**: `0.0.1`
- **Description**: The `validator` operator is responsible for validating input data against a JSON schema, optionally applying presets to the data, and handling validation errors according to the configuration.
- ## Dependencies
- `rxjs`: A library for reactive programming using Observables.
- `ajv`: A JSON schema validator.
- `json-schema-preset`: A utility for applying presets to JSON data.
	- https://www.npmjs.com/package/json-schema-preset
- `json-schema-empty`: A utility for generating empty objects based on JSON schema.
	- https://www.npmjs.com/package/json-schema-empty
- ## Schema Definitions
- **Input Schema**:
	- The input data to be validated.
	- The JSON schema against which the data will be validated.
- **Output Schema**:
	- The validated data, potentially with presets applied.
- **Config Schema**:
	- `strict`: A boolean indicating whether to throw an error on invalid data (default: `true`).
	- `role`: A string specifying the schema key to use.
	- `data`: An object representing the initial data to use.
	- `skipValidation`: A boolean indicating whether to skip validation (default: `false`).
	- `ajv`: An object containing JSON schema validator options.
- ## Process Operator Logic
  The `validator` operator will:
  1. Combine the source data with the schema.
  2. Log the start of the validation process.
  3. Apply presets to the data if not skipped.
  4. Validate the data against the schema.
  5. If validation fails and `strict` mode is enabled, throw an error.
  6. If validation passes or is skipped, proceed with the validated data.
  7. Log the validated data.
- ## Logging
  The operator will log the following information:
- The start of the validation process, including the role being validated.
- The end of the validation process, indicating that the data has been validated.
- Errors, if any, especially when the input does not match the schema in `strict` mode.-e
- ## writing a process operator.md
- Instructions for writing [[process operators]] module according to our [[conventions]]
	- Write the header: import any dependencies, export key, version, and description
	- Write the [[schema operators]] for any necessary [[schema roles]]
		- if necessary, export the `keysSchema`
			- many simple operators will not need a `keysSchema`, generally only operators that use externally authenticated apis will need them
		- export the `configSchema`
		- export the `inputSchema`
		- export the `outputSchema`
	- if necessary, write a [[setup operator]]
	- if necessary, write a [[tool operator]]
	- if necessary, write a [[status operator]]
	- write the actual process operator, composing any setup, tool, and status operators to achieve the desired functionality.
	- add [[logging]]
	- review for adherence to requirements and documentation.
		- provide fixes if needed
	- bring together all of the code into a complete module.
		- It's imperative that there are no omissions, the code at this step must be a complete artifact, with all text included inline, even if it's a repetition of code provided earlier.
		- The code should all be in a single module file that respects the export signature of [[process operators]]