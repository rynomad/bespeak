- A setup operator is a helper to do any initialization at the time of invoking the operator factory.
- For example, you may use a setup operator to initialize an api client:
- ```javascript
  const setupOperator = (operable) => {
    return combineLatest(operable.data.keys)
    			.pipe(
      			map((keys) => new Client(keys)),
      			withLatestFrom(operable.data.config),
      			tap(([client,config]) => client.setConfig(config.clientConfig)),
                  map(([client]) => client),
    			)
  }
  ```
	- this is a trivial example, but in more complex scenarios it can be useful to have this setup logic factored out
- You would then use your setup operator in a process operator like so:
	- ```javascript
	  import {pipe, from, withLatestFrom} from "https://esm.sh/rxjs"
	  
	  export default function myProcessOperator(operable) {
	    return pipe(
	    	withLatestFrom(setupOperator(operable)),
	      switchMap(([input, client]) => from(client.makeApiCall(input)))
	    )
	  }
	  ```