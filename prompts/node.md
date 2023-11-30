# Documentation for `node.mjs`

## Public API

### `read$$(role)`

This function is used to read data from the system or from a specific role. The role is a string that is split into `functionRole` and `collection`.

- If `functionRole` is "system", it returns the system data.
- If `functionRole` is not "system", it combines the system data and the database tool to find and return the document that matches the selector.

The role can be "system", "ingress", "operator", "ingress:input", "ingress:output", "ingress:config", "ingress:keys", "operator:input", "operator:output", "operator:config", or "operator:keys".

### `write$$(role, data)`

This function is used to write data to the system or to a specific role. The role is a string that is split into `functionRole` and `collection`.

- If `functionRole` is "system", it writes the data to the system.
- If `functionRole` is not "system", it validates the data and writes it to the database.

The role can be "system", "ingress", "operator", "ingress:input", "ingress:output", "ingress:config", "ingress:keys", "operator:input", "operator:output", "operator:config", or "operator:keys".

### `schema$$(role)`

This function is used to subscribe to the current schema for any role. It returns the schema for the specified role.

The role can be "system", "ingress", "operator", "ingress:input", "ingress:output", "ingress:config", "ingress:keys", "operator:input", "operator:output", "operator:config", or "operator:keys".

### `log(message)`

This function is used to insert logging into a pipeline. It automatically adds some affordances like prefixing with the node id, logging the value being passed at that stage of the pipeline, etc.

## How These Functions Fit Together

A node has an ingress and operator, defined in its system data. Ingress and operator are both modules that have schemas for their input, output, config, and keys. The `node.mjs` wrapper allows you to read/write system data, as well as config/keys data for ingress and operator. The `schema$$` function allows you to subscribe to the current schema for any role. The `log()` function allows you to easily insert logging into a pipeline.