-
- ## Introduction
  
  The fetch operator is designed to retrieve and parse the HTML content of web pages using the readability.js library. The primary purpose of this operator is to extract the main content from web pages, stripping away clutter such as ads and sidebars. This operator will be particularly useful for applications that require clean and readable content for further processing or display, such as content aggregators, readability tools, and text analysis applications.
- ## Operator Identification
- **Key**: fetch-readability-operator
- **Version**: 1.0.0
- **Description**: An operator that fetches HTML content from a specified URL, parses it using readability.js, and optionally reinserts image and/or anchor tags into the parsed content.
- ## Dependencies
- **readability.js**: A library for parsing HTML content and extracting the main body of text in a readable format.
	- Documentation: [Readability.js GitHub Repository](https://github.com/mozilla/readability)
- DOMParser (Deno only): In the browser,
- ## Schema Definitions
- **Input Schema**:
	- `url`: The URL of the web page to fetch and parse (string, required).
	- `includeImages`: Flag to indicate whether to reinsert image tags in the output (boolean, optional, default: false).
	- `includeLinks`: Flag to indicate whether to reinsert anchor tags in the output (boolean, optional, default: false).
- **Output Schema**:
	- `title`: The title of the parsed content (string).
	- `content`: The main body of the parsed content, with optional images and links (string).
	- `textContent`: The text content of the parsed content without HTML tags (string).
	- `length`: The length of the text content (number).
	- `excerpt`: A short excerpt or summary of the content (string).
	- `siteName`: The name of the website or publication (string).
- **Config Schema**:
	- N/A
- **Keys Schema**:
	- `proxy`: (optional) url for a cors anywhere proxy.
- ## Operator Components
- **Setup Operator**:
	- Initialize the readability.js library and either pass in the browser provided DOMParser or DOMParser for Deno
		- ```javascript
		  const { DOMParser } = await import("https://deno.land/x/deno_dom/deno-dom-wasm.ts")
		  ```
- **Tool Operator**:
	- N/A
- **Status Operator**:
	- The operator will emit status events indicating success or failure.
	- In case of errors, the status object will include an error message and code.
- ## Process Operator Logic
  
  1. Receive input parameters including the URL and optional flags for images and links.
  2. Perform an HTTP GET request to the URL using fetch
	- If `operable.read.keys` has a cors-proxy url, use it.
- 3. On successful retrieval, pass the HTML content to readability.js for parsing.
- 4. If `includeImages` is true, reinsert `<img>` tags into the content at their original location.
  5. If `includeLinks` is true, reinsert `<a>` tags into the content at their original location.
  6. Return the parsed content along with metadata such as title, excerpt, and site name.
  7. Handle any errors that occur during the fetch or parsing process and return a status object with error details.
- ## Logging
- The operator will log the following information:
	- `debug`: Details about the fetch request and parsing process.
	- `info`: Summary of the operation including URL fetched and status.
	- `error`: Any errors encountered during the operation with stack traces.