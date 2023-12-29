# Primary Functional Requirements of validator.mjs

1. The primary function of this module is to validate incoming data against a specified JSON schema. It uses the JSON schema to create a default object if no initial data is provided. 

2. The validation process can be configured to be strict or not. In strict mode, an error is thrown when the data does not match the schema. In non-strict mode, the offending event is simply ignored.

3. The module allows skipping the preset and validation steps through configuration.

4. The module uses the role to determine the schema to use for validation.

5. The module logs the start and end of the validation process.
edit
- testing
-
- # Dependencies
- json-schema-preset: Used to create a default object based on the JSON schema.
- json-schema-empty: Used to create an empty object if no initial data is provided and no schema is available.
- ajv: A JSON schema validator.
- # Input Schema
  
  the input is the data to be validated against the role schema
- # Output Schema
  
  The output is the data, augmented with defaults via empty and jsonPreset
- # Config Schema
- strict (boolean): If true, will throw an error on invalid data. Otherwise the offending event will just be ignored. Default is true.
- role (string): The schema key to use.
- data (object): The initial data to use.
- skipValidation (boolean): If true, skips the validation process. Default is false.
- ajv (object): JSON schema validator options. Allows additional properties.
- # relevant docs
  
  ```json
  [
    "https://www.npmjs.com/package/json-schema-preset",
    "https://www.npmjs.com/package/json-schema-empty"
  ]
  ```