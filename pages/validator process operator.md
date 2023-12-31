## Introduction
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
- Errors, if any, especially when the input does not match the schema in `strict` mode.