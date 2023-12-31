- Nodes are the central building blocks for [[flows]].
- Nodes are wrappers around two rxjs [[operators]]
	- the `[[process operators]]` do the actual work of the node (api calls, data transformation, state management)
	- the `[[ingress operators]]` is responsible for piping one or more upstream nodes into a single observable to be piped into the `process` operator. The [[Default Ingress]] simply performs basic schema matching, but more advanced ingress operators could do more complex data manipulation to normalize upstream output to downstream input.
- {{embed [[data roles]]}}
- {{embed [[tools]]}}
- {{embed [[interfaces]]}}
- Nodes have the following methods:
	- `operator({node, config}) => operator`
	  id:: 656e5315-9475-429c-ab44-3c2634f2635e
		- returns a new instance the bare `process` [[process operators]] for use elsewhere
		- `config` is optional. If omitted, the existing config for the node will be used
		- `node` is optional. If omitted, the node being called will be used.
		- ```javascript
		  const myNode = new Node()
		  
		  of('some input').pipe(
		  	myNode.operator()
		  ).subscribe(result => console.log(result))
		  ```
	- `read$$(datarole) => observable`
		- read the data from the database for the appropriate [[data roles]]
		- ```javascript
		  
		  // read the currect config for the process operator
		  node.read$$("process:config").subscribe(config => {
		    console.log(node.id, 'config for the process operator:', config)
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
	  id:: 656e59b5-f132-4353-9200-976e8f8d28cd
		- get a tool by the given id
		- id:: 656e59d8-640e-40eb-ae3b-f2a11101a892
		  ```javascript
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
		  
		  // using log in an rxJS pipeline
		  const node = new Node('node-id')
		  
		  from([1,2,3]).pipe(
		  	node.log('logging my input')
		  ).subscribe()
		  
		  // node-id logging my input 1
		  // node-id logging my input 2
		  // node-id logging my input 3
		  ```