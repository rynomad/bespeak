import { pipe, catchError, of, switchMap, concatMap } from "rxjs";
import { map, tap } from "rxjs/operators";
import { Readability } from "@mozilla/readability";
import Ajv from "ajv";
// schemas.js

// Input schema for parsing HTML content using Readability.js
export const inputSchema = {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "Readability Parser Input",
    description: "Input schema for parsing HTML content using Readability.js",
    type: "object",
    properties: {
        html: {
            type: ["string", "null"],
            description:
                "The HTML content to be parsed. Can be null if a URL is provided.",
        },
        url: {
            type: ["string", "null"],
            description:
                "The URL of the web page to parse. Can be null if HTML content is provided.",
        },
        charThreshold: {
            type: ["integer", "null"],
            description:
                "The minimum number of characters an article must have in order to be considered 'readable'.",
            default: null,
        },
        classesToPreserve: {
            type: ["array", "null"],
            description:
                "An array of class names that should be preserved in the output.",
            items: {
                type: "string",
            },
            default: null,
        },
        keepClasses: {
            type: ["boolean", "null"],
            description:
                "A boolean flag indicating whether all classes should be preserved on elements.",
            default: null,
        },
    },
    required: [],
    additionalProperties: false,
};

// Schema for the output of the Readability.js parsing operation
export const outputSchema = {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "Readability Output",
    description:
        "Schema for the output of the Readability.js parsing operation",
    type: "object",
    properties: {
        title: {
            type: "string",
            description: "The title of the article",
        },
        byline: {
            type: "string",
            description: "The author or byline of the article",
        },
        content: {
            type: "string",
            description: "The main textual content of the article",
        },
        textContent: {
            type: "string",
            description:
                "The text content of the article without any HTML tags",
        },
        length: {
            type: "integer",
            description: "The length of the article in characters",
        },
        excerpt: {
            type: "string",
            description: "A short excerpt or summary of the article",
        },
        siteName: {
            type: "string",
            description: "The name of the website or publication",
        },
        image: {
            type: "string",
            description: "URL of the lead image of the article, if available",
        },
        favicon: {
            type: "string",
            description: "URL of the website's favicon",
        },
    },
    required: ["title", "content"],
};

// Schema for representing the status of an operation
export const statusSchema = {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "Operation Status",
    description: "Schema for representing the status of an operation",
    type: "object",
    properties: {
        success: {
            description: "Indicates if the operation was successful",
            type: "boolean",
        },
        code: {
            description:
                "A numeric status code representing the result of the operation",
            type: "integer",
            enum: [200, 400, 401, 403, 404, 500],
            default: 200,
        },
        message: {
            description:
                "A human-readable message providing more details about the status",
            type: "string",
        },
        timestamp: {
            description: "The timestamp when the operation was processed",
            type: "string",
        },
    },
    required: ["success", "code"],
};
// readabilityOperator.mjs

// Create Ajv instance for validation
const ajv = new Ajv({ allErrors: true });
const validateInput = ajv.compile(inputSchema);
const validateOutput = ajv.compile(outputSchema);
const validateStatus = ajv.compile(statusSchema);

// Custom RxJS operator
export const readabilityOperator = (config, keys, status$) => {
    return pipe(
        switchMap(async (payload) => {
            if (!window.DOMParser) {
                // Check if we are in Deno and DOMParser is not defined
                window.DOMParser = (
                    await import(
                        "https://deno.land/x/deno_dom/deno-dom-wasm.ts"
                    )
                ).DOMParser;
            }
            return payload;
            // ... rest of your code
        }),
        concatMap(async (payload) => {
            const parser = new DOMParser();
            let doc;
            if (payload.url) {
                const response = await fetch(payload.url);
                const contentType = response.headers.get("content-type");
                if (!contentType || !contentType.includes("text/html")) {
                    throw new Error(
                        "Invalid content type. Expected text/html."
                    );
                }
                const text = await response.text();
                doc = parser.parseFromString(text, "text/html");
            } else {
                doc = parser.parseFromString(payload.html, "text/html");
            }
            const reader = new Readability(doc, config);
            const article = reader.parse();
            if (!article) {
                const status = {
                    success: false,
                    code: 500,
                    message: "Failed to parse HTML content.",
                    timestamp: new Date().toISOString(),
                };
                // Validate status object against the status schema
                if (!validateStatus(status)) {
                    throw new Error("Status object validation failed.");
                }
                status$.next(status);
                throw new Error("Failed to parse HTML content.");
            }

            Object.keys(article).forEach((key) => {
                if (article[key] === null) {
                    delete article[key];
                }
            });

            // Validate output against the output schema
            if (!validateOutput(article)) {
                const validationErrors = validateOutput.errors
                    .map((error) => error.message)
                    .join(", ");
                console.warn(article, outputSchema, validateOutput.errors);
                throw new Error(
                    `Output validation failed: ${validationErrors}`
                );
            }

            const status = {
                success: true,
                code: 200,
                message: "HTML content successfully parsed.",
                timestamp: new Date().toISOString(),
            };
            // Validate status object against the status schema
            if (!validateStatus(status)) {
                throw new Error("Status object validation failed.");
            }
            status$.next(status);

            return { ...article, ...keys };
        }),
        catchError((error) => {
            const status = {
                success: false,
                code: determineErrorCode(error),
                message: `Error during parsing: ${error.message}`,
                timestamp: new Date().toISOString(),
            };
            // Validate status object against the status schema
            if (!validateStatus(status)) {
                throw new Error("Status object validation failed.");
            }
            status$.next(status);
            throw error;
        })
    );
};

// Helper function to determine the appropriate error code
function determineErrorCode(error) {
    // Implement logic to determine the error code based on the error
    // For example:
    if (error.message.includes("validation failed")) {
        return 400;
    }
    return 500;
}

export default readabilityOperator;
