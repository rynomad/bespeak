# Operable.mjs Technical Specification

The `Operable` class in `operable.mjs` is a reactive programming construct that uses the RxJS library to manage data flow and operations. It is designed to handle data processing in a pipeline-like manner, with a focus on modularity and reactivity.
- ## Class Properties
- `id`: A unique identifier for the instance of the `Operable` class.
- `meta$`: A BehaviorSubject that holds metadata. BehaviorSubjects are a type of Observable in RxJS that can hold a value and emit it to any subscribers immediately upon subscription.
- `process`: An object containing two BehaviorSubjects, `module$` and `operator$`, for managing the processing module and operator. The processing module is responsible for the main data processing logic, while the operator is the actual function that performs the processing.
	- The `process` property of the `Operable` class interacts with process operators by receiving an ESM import object, which is sent to `module$`. The various exports from this object are then invoked with the operable as the only argument. The default export is written to `operator$`, ensuring that the currently instantiated operator is always available. Similarly, the ingress interfaces work with the corresponding ingress operators. Additionally, all the schemas are invoked, and their results are piped to the appropriate schema interface, maintaining current zod schemas. For more information, see [[schemas]].
- `ingress`: An object containing two BehaviorSubjects, `module$` and `operator$`, for managing the ingress module and operator. The ingress module is responsible for handling incoming data, while the operator is the actual function that performs the ingress operation.
	- The `ingress` property of the `Operable` class interacts with ingress operators in a similar manner to the `process` property. The ESM import object for the ingress operator is sent to `module$`, and the various exports are invoked with the operable as the argument. The default export is written to `operator$`, ensuring the currently instantiated operator is available.
- `io`: An object containing four BehaviorSubjects, `upstream$`, `downstream$`, `users$`, `tools$`, for managing various IO streams. These streams represent different sources and destinations of data.
- `schema`: An object containing four BehaviorSubjects, `input$`, `output$`, `config$`, `keys$`, for managing various schemas. These schemas define the structure of the data at different stages of the pipeline.
- `write`: An object containing four BehaviorSubjects, `input$`, `output$`, `config$`, `keys$`, for managing various data streams. data written to these endpoints will be parsed by the appropriate schema and passed to the `read` counterpart
- `read`: An object containing four BehaviorSubjects, `input$`, `output$`, `config$`, `keys$`, for managing various data streams.
- `status$`: a BehaviorSubject for status events
- `log$`: a BehaviorSubject for log events
- ## Class Methods
- Private
	- `constructor(id)`: Initializes the `Operable` instance with a unique ID and sets up the BehaviorSubjects. The ID is generated using the `uuidv4` function if not provided.
	- `initModules()`: Initializes the modules for processing and ingress. It subscribes the `operator$` BehaviorSubjects to the `module$` BehaviorSubjects, meaning that whenever the module is updated, the operator is also updated. It also sets up the schemas for input, output, config, and keys based on the processing module. This is done by subscribing the schema BehaviorSubjects to the `module$` BehaviorSubject, and applying the corresponding function from the module to the `Operable` instance.
	- `initPipelines()`: Initializes the pipelines for ingress and processing. It sets up the data input stream by subscribing it to the ingress operator. It also sets up the data output stream by subscribing it to the process operator, and applying the input and output schemas to the data. This is done using the `switchMap` operator, which switches to a new Observable (the data input stream) whenever the operator or schemas change.
- Public
	- `pipe(...args)`: A method for piping operators to the output data stream. It supports both regular RxJS operators and custom operators with an `asOperator` method. This allows for additional processing to be applied to the output data.
	- `subscribe(observer)`: A method for subscribing an observer to the output data stream. This allows for the processed data to be consumed.
	- `next(value)`: A method for pushing a new value to the input data stream. This allows for new data to be processed.
	- `asOperator()`: A method for getting the current value of the process operator. This allows for the `Operable` instance to be used as an operator in other Observables.
	- `async invokeAsFunction(input)` - invoke the operable process operator as a function. it will share the configuration of the operable but will not otherwise affect the state.
	- `connect(operable)` - creates a connection between this operable and the target
	- `disconnect(operable)` - remove a connection between this operable and the target
	- `use(operable)` - use the given operable as a tool
	- `disuse(operable)` - stope using the given operable as a tool
- ## Usage
  
  An instance of `Operable` can be used to set up a reactive data processing pipeline. The processing and ingress modules can be dynamically updated, and the data input and output streams are automatically managed based on these modules. The `pipe`, `subscribe`, and `next` methods provide interoperability with other RxJS observables and operators. The `asOperator` method allows for the `Operable` instance to be used as an operator in other Observables, providing a high degree of modularity and reusability.