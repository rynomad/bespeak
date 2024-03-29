# Requirements Document for Process Operator Development
- ## Introduction
  The process operator to be developed is designed to take a serialized flow of operables, along with their configuration, meta, and key data, and construct a flow out of them. This operator will be a crucial component in managing and orchestrating the flow of data between different nodes in a system.
- ## Operator Identification
- **Key**: FlowConstructor
- **Version**: 1.0.0
- **Description**: This operator encapsulates a flow of other operables.
- ## Dependencies
- You'll need familiarity with the [[operable]] interface
- ## Schema Definitions
- **Config Schema**:
	- operables: a list of operable `names`
	- connections: lists of `to` and `from` pairs of names, in two categories
		- stream - denoting upstream/downstream connections between operables
		- tools - denoting tool/user connections between operables
	- input: the name of the operable that is piped directly to the flow input
	- output: the name of the operable that is piped directly to the flow output
- **Keys Schema**: N/A
- **Input Schema**: the schema of the input operable.
- **Output Schema**: the schema of the output operable.
- ## Operator Components
- **Status Operator**: The status operator will mirror the status events of every internal node. it will augment the `detail` property with the id of the internal node that created the event.
- ## Process Operator Logic
- The process operator will subscribe to the config of its operable and use it to manage its own tools, inserting or removing operables to the tools interface to keep in sync with the present state of the config. all tool operables will have the id `[flow-id]-[name]`. stream connections will be kept in sync via the `connect` and `disconnect` operable methods. tool connections will be kept in sync via the `use` and `discard` operable methods.
- flow inputs will be piped to the configured input, and return the configured output.