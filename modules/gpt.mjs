import {
    Observable,
    throwError,
    switchMap,
    catchError,
    of,
    map,
    from,
} from "https://esm.sh/rxjs";
import OpenAI from "openai";
import Ajv from "https://esm.sh/ajv";
import addFormats from "https://esm.sh/ajv-formats";
import { combineLatest } from "npm:rxjs@^7.8.1";
const getText = async (path) => {
    try {
        const cwd = Deno.realPathSync(".");
        return await Deno.readTextFile(`${cwd}/${path}`);
    } catch (e) {
        return await fetch(path).then((res) => res.text());
    }
};

export const key = "chat-gpt";
export const version = "0.0.1";
export const prompt = await getText(`prompts/gpt.md`);
export const description = `The primary functional requirement of the @gpt.mjs module is to create a custom RxJS operator that interacts with the OpenAI API to generate responses based on a given prompt. This operator is designed to be used in a chat application where it can generate responses from the GPT model in real-time.

The operator takes in a configuration object and an input object. The configuration object includes settings such as the role of the message sender, the temperature for randomness in the generation process, and the model to be used for generating responses. The input object includes a history of messages to be included in the prompt and optional overrides for the configured options.

The operator returns an Observable that emits the generated responses from the GPT model as they become available. It also emits status updates and handles errors.

The libraries that aid its function are:

- openai: This library provides a client for the OpenAI API. It is used to make requests to the API and receive responses.`;

function extractLastCodeBlock(str) {
    const codeBlockRegex = /```(.*?)\n([\s\S]*?)```/gs;
    let match;
    let lastMatch;
    let parsed = null;
    while ((match = codeBlockRegex.exec(str)) !== null) {
        lastMatch = match;
        if (lastMatch[1].trim().toLowerCase() === "json") {
            try {
                parsed = JSON.parse(lastMatch[2].trim());
            } catch (e) {
                console.warn("Failed to parse JSON in code block", e);
            }
        }
    }

    lastMatch = lastMatch ? lastMatch[2].trim() : null;

    return {
        raw: lastMatch,
        parsed: parsed,
    };
}

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
export const configSchema = ({ node, keys }) => {
    const models$ = keys?.apiKey
        ? from(getModels(keys))
        : of([
              "gpt-4",
              "gpt-3.5-turbo-0613",
              "gpt-4-1106-preview",
              "gpt-3.5-turbo-1106",
              "gpt-4-vision-preview",
          ]);

    return models$.pipe(
        map((models) => ({
            $schema: "http://json-schema.org/draft-07/schema#",
            title: "ChatGPT Operator Configuration",
            description:
                "Configuration schema for custom RxJS operator to interact with ChatGPT API.",
            type: "object",
            properties: {
                basic: {
                    type: "object",
                    properties: {
                        prompt: {
                            type: "string",
                            title: "Prompt Content",
                            description:
                                "The prompt content to be sent to the API as the most recent message.",
                        },
                    },
                    required: ["prompt"],
                },
                advanced: {
                    type: "object",
                    properties: {
                        role: {
                            type: "string",
                            title: "Role",
                            description: "The role of the message sender.",
                            enum: ["user", "assistant", "system"],
                            default: "user",
                        },
                        temperature: {
                            type: "number",
                            title: "Temperature",
                            description:
                                "Controls randomness in the generation process. Higher values mean more random completions.",
                            minimum: 0,
                            maximum: 1,
                            default: 0.3,
                        },
                        model: {
                            type: "string",
                            title: "Model",
                            description:
                                "The model to be used for generating responses.",
                            enum: models,
                            default: "gpt-3.5-turbo-0613",
                        },
                        tools: {
                            type: ["string", "null"],
                            enum: ["user", "none", "all"],
                            default: "user",
                            description: "Whether to expose tools to the LLM.",
                        },
                        continue: {
                            type: "boolean",
                            default: false,
                            description: `whether to allow the model to continue the conversation from the prompt. If set to false, the model the conversation will end after the model's first response. If set to true, the model will be allowed to continue the conversation for up to 4 additional turns or until it calls a "finish" function.`,
                        },
                        cleanup: {
                            type: "string",
                            enum: ["none", "system", "user", "all"],
                            title: "Clean",
                            description:
                                "Whether to strip system and or user messages from the returned message history.",
                            default: "none",
                        },
                        // Additional advanced options can be added here as needed.
                    },
                    required: ["role", "model"],
                    default: {},
                },
            },
            required: ["basic", "advanced"],
        }))
    );
};

// ChatGPT Message History Output Schema
export const outputSchema = (context) => {
    return of({
        $schema: "http://json-schema.org/draft-07/schema#",
        title: "ChatGPT Message History Output",
        description:
            "The output schema for the message history after processing through the custom RxJS operator for ChatGPT.",
        type: "object",
        properties: {
            messages: {
                type: "array",
                items: {
                    $ref: "#/definitions/message",
                },
            },
            code: {
                type: "string",
                description:
                    "The last code block from the accumulated response.",
            },
            json: {
                type: "object",
                description:
                    "If the last code block from the accumulated response was JSON, this is the parsed JSON object.",
                additionalProperties: true,
            },
        },
        definitions: {
            message: {
                type: "object",
                properties: {
                    role: {
                        type: "string",
                        enum: ["user", "assistant", "system"],
                        description: "The role of the message sender.",
                    },
                    content: {
                        type: "string",
                        description: "The content of the message.",
                    },
                },
                required: ["role", "content"],
            },
        },
        required: ["messages"],
    });
};

// ChatGPT Operator Input Schema
export const inputSchema = (context) => {
    return of({
        $schema: "http://json-schema.org/draft-07/schema#",
        title: "ChatGPT Operator Input",
        description: "The input schema for the custom ChatGPT RxJS operator.",
        type: "object",
        properties: {
            messages: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        role: {
                            type: "string",
                            enum: ["user", "assistant", "system"],
                            description: "The role of the message sender.",
                        },
                        content: {
                            type: "string",
                            description: "The content of the message.",
                        },
                    },
                    required: ["role", "content"],
                },
                default: [],
                description:
                    "The history of messages to be included in the prompt.",
            },
            override: {
                type: ["object", "null"],
                properties: {
                    prompt: {
                        type: ["string", "null"],
                        description:
                            "The prompt content to override the configured prompt.",
                    },
                    role: {
                        type: ["string", "null"],
                        enum: ["user", "assistant", "system"],
                        description:
                            "The role to override the configured role.",
                    },
                    temperature: {
                        type: ["number", "null"],
                        description:
                            "The temperature to override the configured temperature.",
                    },
                    model: {
                        type: ["string", "null"],
                        enum: [
                            "gpt-4",
                            "gpt-3.5-turbo-0613",
                            "gpt-4-1106-preview",
                            "gpt-3.5-turbo-1106",
                            "gpt-4-vision-preview",
                        ],
                        description:
                            "The model to override the configured model.",
                    },
                    tools: {
                        type: ["string", "null"],
                        enum: ["user", "none", "all"],
                        default: "user",
                        description: "Whether to expose tools to the LLM.",
                    },
                    // Add any other optional override properties here
                },
                description: "Optional overrides for the configured options.",
            },
        },
        required: ["messages"],
    });
};

export const keysSchema = (context) => {
    return of({
        title: "OpenAI API Keys",
        description: "API keys for OpenAI",
        type: "object",
        properties: {
            apiKey: {
                type: "string",
                title: "API Key",
                description: "The API key for OpenAI",
            },
        },
    });
};

export const toolsToFunctionsOperator = ({ node, config }) => {
    return node.tools$.pipe(
        node.log("toolsToFunctionsOperator"),
        map((tools) =>
            tools.filter((tool) =>
                config.advanced.tools === "all"
                    ? true
                    : config.advanced.tools === "user"
                    ? !tool.id.startsWith("system:")
                    : false
            )
        ),
        node.log("toolsToFunctionsprocess: filtered tools"),
        switchMap((tools) => {
            if (tools.length === 0) {
                return of({ tools: [] });
            }

            return combineLatest({
                tools: of(tools),
                inputSchemas: combineLatest(
                    tools.map((tool) =>
                        tool
                            .schema$$("process:input")
                            .pipe(node.log(`got input schema for ${tool.id}`))
                    )
                ),
                configSchemas: combineLatest(
                    tools.map((tool) =>
                        tool
                            .schema$$("process:config")
                            .pipe(node.log(`got config schema for ${tool.id}`))
                    )
                ),
                operators: combineLatest(tools.map((tool) => tool.process$)),
                system: node.system$,
            });
        }),
        map(({ tools, inputSchemas, configSchemas, operators, system }) => {
            return tools.map((toolNode, i) => {
                const { module, config } = operators[i];

                const description = `${toolNode.id}\nCode Description: ${
                    module.description
                }${
                    system.description
                        ? `\nUser Description: ${system.description}`
                        : ``
                }`;

                const parameters = inputSchemas[i];

                const parse = (str) => {
                    const data = JSON.parse(str);
                    const ajv = new Ajv();
                    addFormats(ajv);
                    const validate = ajv.compile(parameters);
                    const valid = validate(data);
                    if (!valid) {
                        console.warn(data, parameters);
                        throw new Error(
                            `Input data does not match schema.\n${ajv.errorsText()}`
                        );
                    }

                    return data;
                };

                return {
                    name: toolNode.id,
                    description,
                    function: async (input) => {
                        return await new Promise((resolve, reject) => {
                            of(input)
                                .pipe(
                                    toolNode.operator({ node }),
                                    catchError(reject)
                                )
                                .subscribe(resolve);
                        });
                    },
                    parse,
                    parameters,
                };
            });
        })
    );
};

// Implementation of the custom RxJS operator
export const chatGPTOperator =
    ({ config, keys, node }) =>
    (source$) => {
        const openai = new OpenAI({
            apiKey: keys.apiKey,
            dangerouslyAllowBrowser: true,
        });

        let abortController; // Store the AbortController
        console.log("chatGPTOperator");
        return combineLatest(
            source$,
            toolsToFunctionsOperator({ node, config })
        ).pipe(
            node.log("toolsToFunctionsOperator complete"),
            switchMap(([input, functions]) => {
                // Merge input overrides with config
                const effectiveConfig = {
                    ...config,
                    basic: {
                        ...config.basic,
                        ...input.override, // Nested under 'basic' to match the schema
                    },
                    advanced: {
                        ...config.advanced,
                        ...input.override, // Nested under 'advanced' to match the schema
                    },
                    messages: input.messages || [],
                };

                // Use the prompt from the 'basic' configuration if it's the first call in the chain
                if (effectiveConfig.basic && effectiveConfig.basic.prompt) {
                    effectiveConfig.messages.push({
                        role: effectiveConfig.advanced.role,
                        content: effectiveConfig.basic.prompt,
                    });
                }

                // Prepare the API call parameters
                const apiParams = {
                    model: effectiveConfig.advanced.model,
                    messages: effectiveConfig.messages,
                    temperature: effectiveConfig.advanced.temperature,
                    stream: true,
                };

                if (functions.length || effectiveConfig.advanced.continue) {
                    apiParams.functions = functions;
                    if (effectiveConfig.advanced.continue) {
                        apiParams.functions.push({
                            name: "complete",
                            description:
                                "Call this function to finish the chat.",
                            function: (_, runner) => {
                                runner.abort();
                            },
                            parse: JSON.parse,
                            parameters: {
                                type: "object",
                                properties: {
                                    reason: {
                                        type: "string",
                                    },
                                },
                            },
                        });
                    }
                }

                // Start the stream
                return new Observable((observer) => {
                    (async () => {
                        try {
                            await callOpenAi(
                                node,
                                effectiveConfig,
                                observer,
                                apiParams,
                                openai,
                                effectiveConfig.advanced.continue ? 4 : 0
                            );
                        } catch (e) {
                            console.warn(e);
                        }
                    })();

                    // Return the teardown logic for cancellation
                    return () => {
                        if (abortController?.controller) {
                            try {
                                // abortController.controller.abort();
                            } catch (e) {
                                console.warn(e);
                            }
                        }
                    };
                });
            }),
            catchError((error) => {
                // Emit error status
                console.error(error);
                node.status$.next({
                    status: "error",
                    error: error.message || "An error occurred",
                });
                return throwError(
                    () => new Error(error.message || "An error occurred")
                );
            })
        );
    };

const callOpenAi = async (
    node,
    effectiveConfig,
    observer,
    apiParams,
    openai,
    _continue = 0
) => {
    try {
        if (observer.closed) {
            return;
        }

        let apiCall = openai.beta.chat.completions.stream.bind(
            openai.beta.chat.completions
        );

        console.log("CALLING OPENAI", apiParams.functions);
        if (apiParams.functions?.length) {
            apiCall = openai.beta.chat.completions.runFunctions.bind(
                openai.beta.chat.completions
            );
        }

        const stream = await apiCall(apiParams, { maxChatCompletions: 100 });

        [
            "connect",
            "chunk",
            "chatCompletion",
            "message",
            "content",
            "functionCall",
            "functionCallResult",
            "finalChatCompletion",
            "finalContent",
            "finalMessage",
            "finalFunctionCall",
            "finalFunctionCallResult",
            "error",
            "abort",
            "totalUsage",
            "end",
        ].forEach((eventType) => {
            stream.on(eventType, async (data, snapshot) => {
                const progressEvent = {
                    status: eventType,
                    message: snapshot || `Event of type ${eventType} received`,
                    detail: data,
                };
                node.status$.next(progressEvent);

                if (eventType === "error") {
                    observer.error(data);
                }

                if (eventType === "abort") {
                    observer.error(data);
                }

                if (eventType === "finalMessage") {
                    console.log("FINALMESSAGE", data);

                    if (_continue) {
                        console.log("CONTINUE", apiParams.messages);
                        apiParams.messages = stream.messages;
                        return await callOpenAi(
                            node,
                            effectiveConfig,
                            observer,
                            apiParams,
                            openai,
                            _continue - 1
                        );
                    }

                    const code = extractLastCodeBlock(data.content);
                    const output = {
                        messages: apiParams.messages
                            .concat(data)
                            .filter((message) => {
                                if (
                                    effectiveConfig.advanced.cleanup === "none"
                                ) {
                                    return true;
                                }

                                if (
                                    effectiveConfig.advanced.cleanup ===
                                        "all" &&
                                    message.role !== "assistant"
                                ) {
                                    return false;
                                }

                                if (
                                    effectiveConfig.advanced.cleanup ===
                                    "system"
                                ) {
                                    return message.role !== "system";
                                }

                                if (
                                    effectiveConfig.advanced.cleanup === "user"
                                ) {
                                    return message.role !== "user";
                                }

                                return true;
                            }),
                        response: data.content,
                        model: apiParams.model,
                    };

                    if (code.raw) {
                        output.code = code.raw;
                        if (code.parsed) {
                            output.json = code.parsed;
                        }
                    }
                    // Emit the final output
                    observer.next(output);
                }
            });
        });

        // abortController = stream; // Store the AbortController

        // observer.complete();
    } catch (error) {
        // Handle errors
        observer.error(error);
    }
};

export default chatGPTOperator;
