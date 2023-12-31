# Requirements Document for the "fs" Process Operator
- ## Introduction
- The "fs" process operator is designed to provide access to a single folder on the filesystem. It works in Node, Deno, and Browsers that have the file system access api.
- ## Operator Identification
- **Key**: `fs`
- **Version**: `0.0.1`
- **Description**: The fs operator gives access to a single folder on the filesystem.
- ## Dependencies
- The "fs" operator uses a file system access api ponyfill to support multiple runtimes:
	- https://www.npmjs.com/package/file-system-access
- ## Schema Definitions
- **Input Schema**:
	- The input schema expects an object containing a `file` property, which is a string representing the filename (e.g., `readme.md`).
- **Output Schema**:
	- The output schema defines an object with a `contents` property, which is a string containing the contents of the file.
- **Config Schema**:
	- The configuration schema requires an object with a `directory` property, which is a string specifying the directory of the files.
- ## Operator Components
- **Setup Operator**:
	- setup the ponyfills based on environment.
- ## Process Operator Logic
  
  The logic of the "fs" operator involves creating a stream that takes an input observable, maps the file path from the input and configuration, and then switches to a new observable that reads the file content. If an error occurs, it catches the error and outputs it as part of the stream.