# Node Component
- ## Static Properties - Child defined
- ### `keys`
  
  This is a static property that a subclass may implement. It represents the schema for the keys that the component uses. These keys are set globally and shared by each instance of the component. If not implemented, the default value is `null`.
  
  keys being defined will cause forms for them to appear in the sidebar, available at all times.
- ### `config`
  
  This is a static property that a subclass may implement. It represents the configuration schema for the component. These configurations are set independently on each instance of the component. If not implemented, the default value is an object with `type` set to `"object"` and `properties` set to an empty object. Regardless of the implementation, the `config` will always be augmented with a `description` property with `type` set to `"string"` and `description` set to `"A description of this node."`.
  
  config being defined wll cause forms for them to appear on the backside of the respective node.
- ### `output`
  
  This is a static property that a subclass may implement. It represents the output schema for the component. If not implemented, the default value is `null`.
  
  output being defined, and no \_process or render being defined, will cause a form for the output to appear on the frontside of the respective node.
- ## Methods - Child defined
- ### `_process(input, config, keys)`
  
  This is a method that a subclass may implement. It is used to process the input and configuration based on the keys. If not implemented, the method returns the output if `outputSchema` is set, otherwise it acts as a passthrough, returning the input.
  
  The `input` and `config` variables in the process function are the current input and configuration of the component, respectively. The `keys` variable is the current shared keys for all instances.
- ### `render()`
  id:: 656abeda-a160-4a70-b2da-9bf6a3d65ac1
  
  will this edit?
  
  This is a method that a subclass may implement. It is used to render the component. If not implemented, the method returns a `fa-icon` element if the component has an icon, a `form` element if the component has an output schema, or a `yaml-renderer` element otherwise. The `yaml-renderer` element includes a preamble with the component's title and description, and data with the component's input, configuration, and output.
- ## Reactive properties
  
  the following properties are reactive, and will cause the component to re-render when they change.
- ### `input` - triggers `process`
  
  The input is constructed as an array of objects. Each object in the array contains the following properties:
- `nodeId`: The ID of the node.
- `nodeName`: The name of the node.
- `config`: The configuration of the node.
- `schema`: The output schema of the node.
- `value`: The value of the node.
- ### `config` - triggers `process`
- ### `keys` - triggers `process`
- ### `output` - writes value to `output$`
- ### `error` - writes value to `error$`
- ## Non-reactive properties
- ### `output$` - rxjs ReplaySubject
- ### `error$` - rxjs ReplaySubject
- ### `piped` - a set of operables whos output goes to this operable input
- ### `used` - a Set of nodes for whom this node is a sidecar
- ## Methods - callable
- ### `call({input, config})`
  
  Any nodes `process` can be invoked by calling the `call` method on the node. The `input` and `config` parameters are the input and configuration of the node, respectively. The method returns a promise that resolves to the output of the node. this will not cause the node to propagate these values on it's own output.
  
  config will be merged with the current config of the node, and input, if defined, will replace the current input of the node.
  
  `keys` will be automatically provided based on the shared keys store.
- ### `process(force = !this.keysSchema)`
  
  this will trigger `_process(this.input, this.config, this.keys)` and set `this.output` to the returned value. If there is a cached value from a prior run with matching input and config, then that value will be returned unless force is set to true, in which case it will be recomputed. if there is no keysSchema, force defaults to true, otherwise it defaults to false.
- ### `pipe(target)`
- ### `unpipe(target)`
  
  this will wire/unwire together the components output to the input of the target component. It will change the `input`, thus triggering a `process`
- ### `use(target)` and `unuse(target)`
  
  this will add or remove the target from the `used` Set.
- # ReteNode
  
  The ReteNode class wraps Node components such that they can be rendered and piped via the rete visual interface. It also serves as a singleton storage interface for component source code and versions
- ## Static methods