- The `operable.status$` [[interface]] is used to emit status events or intermediate results.
- [[status messages]] have a simple schema
- If any operator is doing complex or long running work, it can be helpful to emit status events
- setting up these status events in a dedicated sub operator can make code easier to read by removing it from the main flow.
- let's say we have a client library that gives us an event emitter, we want to capture some number of events and emit them as status messages
- ```javascript
  const statusOperator = (operable) => {
     return pipe(
       tap(client => {
         ["events","to","monitor"].forEach(evt => client.on(evt, (event) => operable.status$.next({
   			status: evt,
              message: `got ${evt} event`,
              detail: event
  		})))
       })
     )
  }
  ```
- the above is a simplified example, you would usually have more meaningful construction of the status message based on the requirements and access to documentation for the events you're monitoring.
- You would use it in your main operator like so:
	- ```javascript
	  export default function myStatusEmittingProcess(operable){
	    return pipe(
	  	withLatestFrom(setupOperator.pipe(statusOperator(operable)))
	      switchMap(([input, client]) => from(client.doTask(input))
	    )
	  }
	  ```
- You could also see a scenario where an api call returns an event emitter
	- ```javascript
	  const statusOperator = (operable) => {
	    return pipe(
	    	tap(response => {
	              ["events","to","monitor"].forEach(evt => client.on(evt, (event) => operable.status$.next({
	   			status: evt,
	              message: `got ${evt} event`,
	              detail: event
	  		})))
	      })
	    )
	  }
	  ```
- you could use it like so
	- ```javascript
	  export default function myStatusEmittingProcess(operable){
	    return pipe(
	  	withLatestFrom(setupOperator)
	      switchMap(([input, client]) => from(client.doTask(input))
	    	statusOperator(operable)
	    )
	  }
	  ```
- When writing status operators, you will often need to consult web documentation to get lists of events