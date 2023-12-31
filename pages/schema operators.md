- Schema Operators are custom RxJS creation operators that provide [[schemas]] for one of the [[schema roles]]
  title:: schema operators
- all schema operators are optional. If they are omitted, the system will simply accept all data for that schema role.
- factory signature for a schema operator:
	- `(operable) => observable<schema>`
	- example:
		- ```javascript
		  export const output = (operable) => {
		      return of(
		          z.object({
		              messages: z.array(
		                  z.object({
		                      role: z.enum(["user", "assistant", "system"]),
		                      content: z.string(),
		                  })
		              ),
		              code: z.string(),
		              json: z.record(z.any()),
		          })
		      );
		  };
		  ```
- we return an observable so that our schemas can by more expressive
	- For example, consider the case where we are want to be able to configure an operator to access one of a users storage buckets via a cloud storage provider.
	- we want the config schema to have an enum of the users buckets
	- in order to get the list of buckets, we have to make an authenticated api call, which means we need keys.
	- therefor, we construct all of our schema operators as creation operators that themselves receive the node, config, and keys values.
	- Since we don't know in advance what the dependencies would look like for construction of these schemas, we always call the schema operators once with null values for config and keys.
	- It is imperative that schema operators handle this case gracefully.
	- Here's an example of how you might use this to fetch models for a gpt process operator config
		- ```javascript
		  const getModels = async ({ apiKey }) => {
		      const openai = new OpenAI({
		          apiKey,
		          dangerouslyAllowBrowser: true,
		      });
		      const response = await openai.models.list();
		      try {
		          return response.data
		              .map((model) => model.id)
		              .filter((id) => id.startsWith("gpt"));
		      } catch (e) {
		          console.warn(e);
		          return [
		              "gpt-4",
		              "gpt-3.5-turbo-0613",
		              "gpt-4-1106-preview",
		              "gpt-3.5-turbo-1106",
		              "gpt-4-vision-preview",
		          ];
		      }
		  };
		  
		  // ChatGPT Operator Configuration Schema
		  export const configSchema = (operable) => {
		    const models$ = operable.data.keys.pipe(
		        switchMap(keys => 
		            keys?.apiKey
		                ? from(getModels(keys))
		                : of([
		                    "gpt-4",
		                    "gpt-3.5-turbo-0613",
		                    "gpt-4-1106-preview",
		                    "gpt-3.5-turbo-1106",
		                    "gpt-4-vision-preview",
		                ])
		        )
		    );
		  
		    return models$.pipe(
		        map((models) => ({
		        // return a schema with the models
		        }))
		    );
		  };
		  ```