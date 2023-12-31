## Introduction
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
	- https://www.npmjs.com/package/@deboxsoft/zod-to-json-schema
		- converts tool input zod schemas to json schemas for openai
		- see https://github.com/openai/openai-node/blob/HEAD/helpers.md#integrate-with-zod
	-
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
- don't worry about logging.