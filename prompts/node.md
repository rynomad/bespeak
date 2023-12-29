# Documentation for `node.mjs`
- ## Public API
- ### `tools$` and `flowTools$` Observables
  id:: 656ad6bb-e446-4f12-acc8-73c3e4607996
  
  The `tools$` observable emits an array of other nodes, which includes system nodes and any additional nodes that the user has added. These nodes are the tools that the `Node` instance has access to.
  
  The `flowTools$` observable is used to augment the tools available to the `Node`. By writing to `flowTools$`, users can add additional nodes to the `tools$` observable.
  
  Here's an example of how you might add a new node to `flowTools$`:
  
  ```javascript
  const newNode = new Node('newNode');
  NodeInstance.flowTools$.next(newNode]);
  ```
  
  In this example, `newNode` is added to the `tools$` observable and will be emitted in the array of nodes the next time `tools$` emits.
  
  Remember, the `tools$` observable is used internally by the `Node` to find tools by their ID. When you add a new node to `flowTools$`, you're making it available for use within the `Node` instance.
- ### `operator({ node, config, keys } = {})`
  
  This function is used to return a bare instance of the operator from this node, which you can then use in any rxjs pipeline. It is especially useful when the `Node` is being used as a tool by another node.
- `node`: The `Node` instance. If not provided, it defaults to the current instance.
- `config`: The configuration object for the operator. If not provided, it defaults to the configuration from the system data.
- `keys`: The keys object for the operator. If not provided, it defaults to the keys from the system data.
  
  The function returns a pipeline that:
  
  1. Logs the invocation of the operator.
  2. Combines the input data with the operator module.
  3. Logs the receipt of the operator module.
  4. Applies the operator module to the input data.
  5. Returns the output of the operator module.
  
  Here's an example of how you might use the `operator()` function:
- ### `read$$(role)`
  
  This function is used to read data from the system or from a specific role. The role is a string that is split into `functionRole` and `collection`.
- If `functionRole` is "system", it returns the system data.
- If `functionRole` is not "system", it combines the system data and the database tool to find and return the document that matches the selector.
  
  The role can be "system", "ingress", "process", "ingress:input", "ingress:output", "ingress:config", "ingress:keys", "process:input", "process:output", "process:config", or "process:keys".
- ### `write$$(role, data)`
  
  This function is used to write data to the system or to a specific role. The role is a string that is split into `functionRole` and `collection`.
- If `functionRole` is "system", it writes the data to the system.
- If `functionRole` is not "system", it validates the data and writes it to the database.
  
  The role can be "system", "ingress", "process", "ingress:input", "ingress:output", "ingress:config", "ingress:keys", "process:input", "process:output", "process:config", or "process:keys".
- ### `schema$$(role)`
  
  This function is used to subscribe to the current schema for any role. It returns the schema for the specified role.
  
  The role can be "system", "ingress", "process", "ingress:input", "ingress:output", "ingress:config", "ingress:keys", "process:input", "process:output", "process:config", or "process:keys".
- ### `log(message)`
  
  This function is used to insert logging into a pipeline. It automatically adds some affordances like prefixing with the node id, logging the value being passed at that stage of the pipeline, etc.
- ## How These Functions Fit Together
  
  A node has an ingress and operator, defined in its system data. Ingress and operator are both modules that have schemas for their input, output, config, and keys. The `node.mjs` wrapper allows you to read/write system data, as well as config/keys data for ingress and operator. The `schema$$` function allows you to subscribe to the current schema for any role. The `log()` function allows you to easily insert logging into a pipeline.