- An interface is an RxJS BehaviorSubject.
- readable interfaces:
	- `tools$` - emits an array of all currently available tools
		- ```javascript
		  node.tools$.pipe(
		  	tap((toolNodes) => console.log(toolNodes.map(node => node.id)))
		  // ['system:db','system:validator','system:imports','system:registrar']
		  ).subscribe()
		  ```
	- `output$` - emits the output of the node
- writable interfaces:
	- `input$` - write to this to trigger the operation of a node, as well as all downstream nodes
		- ```javascript
		  const gptNode = new Node()
		  
		  // configure the node to use the gpt process operator
		  gptNode.write$$('system', {
		    process: 'gpt@1.0.0'
		  })
		  
		  gptNode.output$.subscribe(({messages}) => console.log(messages))
		  
		  gptNode.write$$('process:config', {
		    basic: {
		  	prompt: 'tell me a joke'
		    }
		  }).subscribe(() => {
		    // the node is configured
		    gptNode.input$.next()
		  })
		  
		  // will log [{role: 'user', content: 'tell me a joke'}, {role: 'assistant', content: '...'}]
		  ```
	- `upstream$` - write to this interface to pipe nodes together
		- ```javascript
		  const node1 = new Node()
		  const node2 = new Node()
		  
		  node2.upstream.next([node1])
		  
		  // the node1 output will now flow to the node2 input
		  ```
	- `flowTools$` - write to this interface to add other nodes as tools
		- ```javascript
		  const tool = new Node('my-tool')
		  const myNode = new Node()
		  // configure the tool
		  
		  myNode.tools$.pipe(
		  	tap(toolNodes => console.log(toolNodes.map(node => node.id)))
		  ).subscribe()
		  
		  myNode.flowTools.next([tool])
		  
		  // ['system:db','system:validator','system:imports','system:registrar']
		  // ['system:db','system:validator','system:imports','system:registrar', 'my-tool']
		  ```