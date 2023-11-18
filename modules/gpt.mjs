import {
    Observable,
    throwError,
    pipe,
    switchMap,
    catchError,
    of,
    map,
    from,
} from "https://esm.sh/rxjs";
import OpenAI from "openai";

export const key = "chat-gpt";
export const version = "0.0.1";

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
                        default: "gpt-3.5-turbo-1106",
                        description:
                            "The model to override the configured model.",
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

// Implementation of the custom RxJS operator
export const chatGPTOperator = ({ config, keys, node }) => {
    const openai = new OpenAI({
        apiKey: keys.apiKey,
        dangerouslyAllowBrowser: true,
    });

    let abortController; // Store the AbortController

    return pipe(
        switchMap((input) => {
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

            // Start the stream
            return new Observable((observer) => {
                (async () => {
                    try {
                        if (observer.closed) {
                            return;
                        }
                        const stream =
                            await openai.beta.chat.completions.stream(
                                apiParams
                            );

                        abortController = stream; // Store the AbortController
                        let accumulatedResponse = "";

                        for await (const chunk of stream) {
                            if (observer.closed) {
                                return;
                            }
                            const content =
                                chunk.choices[0]?.delta.content || "";
                            accumulatedResponse += content;

                            // Emit status update
                            node.status$.next({
                                status: "in-progress",
                                message: accumulatedResponse,
                                detail: {
                                    chunk: chunk.choices[0]?.delta.content,
                                    isFinalChunk: false,
                                },
                            });
                        }

                        // Once the stream is complete, get the final chat completion
                        const finalChatCompletion = await stream
                            .finalChatCompletion()
                            .catch((e) => {
                                console.warn(e);
                                return {
                                    choices: [
                                        {
                                            message: {
                                                content: "Error",
                                            },
                                        },
                                    ],
                                };
                            });
                        const finalMessages = apiParams.messages.concat(
                            finalChatCompletion.choices.map((choice) => ({
                                role: "assistant",
                                content: choice.message.content,
                            }))
                        );

                        // Emit the final status
                        node.status$.next({
                            status: "completed",
                            accumulatedResponse,
                            isFinalChunk: true,
                            messages: finalMessages,
                        });

                        // Emit the final output
                        observer.next({
                            messages: finalMessages,
                            model: apiParams.model,
                        });

                        // Complete the observable
                        observer.complete();
                    } catch (error) {
                        // Handle errors
                        observer.error(error);
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

export default chatGPTOperator;
