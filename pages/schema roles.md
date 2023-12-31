- there are 4 roles that define [[schemas]] for various data for [[process operators]]
	- `input` - expected input data to the operator
	- `output` - output data from the operator
	- `config` - configuration used to construct an instance of the operator
		- passed into the [[process operators]] factory function
	- `keys` - keys shared by all instances of an operator
		- passed into the [[process operators]] factory function
- accessing schema roles will typically be prefixed by the role of the operator, `process` or `config`
	- ```javascript
	  operable.schema.input$.subscribe(schema => console.log(schema))
	  ```
-
-