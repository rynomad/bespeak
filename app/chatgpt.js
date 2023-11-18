import { html } from "https://esm.sh/lit";
import OpenAI from "https://cdn.jsdelivr.net/npm/openai@4.17.1/+esm";
import safeStringify from "https://esm.sh/json-stringify-safe";

import BespeakComponent from "./component.js";
import { CONFIG, API_KEY, PAYLOAD } from "./types/gpt.js";

export default class ChatGPT extends BespeakComponent {
    static properties = {
        ...BespeakComponent.properties,
        streamResponse: { type: String },
    };

    static config = {
        type: "object",
        properties: {
            prompt: {
                type: "string",
            },
            model: {
                type: "string",
                title: "Model",
                description: "which model should be used?",
                default: "gpt-3.5-turbo-1106",
                enum: [
                    "gpt-4",
                    "gpt-3.5-turbo-0613",
                    "gpt-4-1106-preview",
                    "gpt-3.5-turbo-1106",
                    "gpt-4-vision-preview",
                ],
            },
            role: {
                type: "string",
                enum: ["user", "system", "assistant"],
                default: "user",
            },
            placement: {
                type: "string",
                description:
                    "should the prompt be appended or prepended to the chat history?",
                enum: ["append", "prepend"],
                default: "append",
            },
            joinStrategy: {
                type: "string",
                description: "how should multiple incoming threads be handled?",
                enum: ["none", "zipper", "sequence"],
                default: "none",
            },
            n: {
                type: "number",
                title: "Quantity",
                description: "how many responses should be generated?",
                default: 1,
            },
            max_tokens: {
                type: "number",
                title: "Max Tokens",
                description:
                    "how many tokens should be generated for each response?",
            },
            temperature: {
                type: "number",
                title: "Temperature",
                description: "how creative should the responses be?",
                default: 0.3,
            },
            history: {
                type: "number",
                title: "History",
                description: "how many messages should be included? 0 for all.",
                default: 0,
            },
            chunking: {
                title: "chunking",
                type: "object",
                properties: {
                    enabled: {
                        type: "boolean",
                        default: false,
                    },
                    mode: {
                        type: "string",
                        enum: ["size", "separator"],
                        default: "size",
                    },
                    size: {
                        type: "number",
                        default: 1000,
                    },
                    separator: {
                        type: "string",
                    },
                },
            },
            filter: {
                type: "string",
                title: "Filter",
                description:
                    "a function that filters the generated responses. The function should return true if the response should be kept, and false otherwise. The function is passed a thread as an argument.",
                default: "return true",
            },
            map: {
                type: "string",
                title: "Map",
                description:
                    "a function that maps the generated responses. The function is passed a thread as an argument.",
                default: "return thread",
            },
            call: {
                type: "boolean",
                title: "Call",
                description:
                    "whether to call the API or not. If false, this node will simply add its prompt to the chat history.",
                default: true,
            },
            context: {
                type: "string",
                title: "Context",
                description:
                    "The input context to use for the prompt. Values will provide each unique input value.",
                enum: ["none", "values"],
                default: "none",
            },
        },
        dependencies: {
            model: {
                oneOf: [
                    {
                        properties: {
                            model: {
                                enum: [
                                    "gpt-4-1106-preview",
                                    "gpt-3.5-turbo-1106",
                                ],
                            },
                            response_format: {
                                type: "object",
                                properties: {
                                    type: { enum: ["json_object"] },
                                },
                            },
                        },
                    },
                    {
                        properties: {
                            model: { enum: ["gpt-4", "gpt-3.5-turbo-0613"] },
                            response_format: { type: "null" },
                        },
                    },
                ],
            },
        },
    };

    static output = {
        type: "array",
        title: "GPT",
        items: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    content: {
                        type: "string",
                    },
                    role: {
                        type: "string",
                        enum: ["user", "system", "assistant"],
                    },
                },
                required: ["content", "role"],
            },
        },
    };

    static keys = API_KEY.schema;

    updated(changes) {
        super.updated(changes);
        if (
            this.output &&
            this.output[0] &&
            this.output[0].length &&
            !this.streamResponse
        ) {
            this.streamResponse =
                this.output[0][this.output[0].length - 1].content;
            console.log("revive streamResponse", this.streamResponse);
            if (this.streamResponse) {
                this.requestUpdate();
            }
        }
    }

    async _process(input, config, keys) {
        const prompt = config.prompt;
        const role = config.role;
        const placement = config.placement;
        const joinStrategy = config.joinStrategy;
        const n = config.n;
        const temperature = config.temperature;
        const model = config.model;
        const history = config.history;
        const call = config.call;
        const context = config.context;
        const max_tokens = config.max_tokens;
        const response_format = config.response_format?.type
            ? config.response_format
            : undefined;

        let threads = input
            .filter(
                (e) =>
                    Array.isArray(e.value) &&
                    e.value.every((v) => Array.isArray(v))
            )
            .map((e) => e.value)
            .flat()
            .filter((e) => e)
            .map((thread) =>
                thread.every(
                    (msg) => msg.role && (msg.content || msg.tool_calls)
                )
                    ? thread
                    : thread.map((v) => ({
                          role: "user",
                          content: JSON.stringify(v),
                      }))
            );

        threads = threads.map((thread) => {
            if (!history) {
                return thread;
            } else if (history > 0) {
                return thread.slice(-history);
            }
        });

        if (
            threads.length === 0 &&
            Array.from(this.pipedFrom).some(
                (e) => e.outputSchema.title === "GPT"
            )
        ) {
            return [];
        }

        if (threads.length === 0 && !config.prompt) {
            return [];
        }

        if (threads.length === 0) {
            threads = [[]];
        }

        switch (joinStrategy) {
            case "none":
                break;
            case "zipper":
                const maxLength = Math.max(
                    ...threads.map((thread) => thread.length)
                );
                const outputThreads = [[]];
                for (let i = 0; i < maxLength; i++) {
                    for (let thread of threads) {
                        if (thread[i]) {
                            outputThreads[0].push(thread[i]);
                        }
                    }
                }
                threads = outputThreads;
                break;
            case "sequence":
                threads = [threads.map((thread) => thread).flat()];
                break;
        }

        threads = threads.map((thread) => {
            if (context === "values") {
                return thread.concat({
                    content: JSON.stringify(
                        input
                            .filter(({ schema }) => schema.title !== "GPT")
                            .map(({ value }) =>
                                value instanceof Error
                                    ? `Error: ${value.message}\n\nStack: ${value.stack}`
                                    : value
                            ),
                        null,
                        4
                    ),
                    role: "user",
                });
            }

            return thread;
        });

        if (
            threads.length === 1 &&
            threads[0].length &&
            config.chunking?.enabled
        ) {
            if (config.chunking.mode === "size") {
                threads = threads[0]
                    .pop()
                    .content.match(
                        new RegExp(`.{1,${config.chunking.size}}`, "g")
                    )
                    .map((e) => [{ role: "user", content: e }]);
            } else {
                threads = threads[0]
                    .pop()
                    .content.split(config.chunking.separator)
                    .filter((chunk) => chunk.split("\\n").length > 2)
                    .map((e) => [{ role: "user", content: e }]);
                console.log(threads);
            }
        }

        threads = threads.map((thread) => {
            if (placement === "append") {
                return thread.concat({ content: prompt, role });
            } else {
                return [{ content: prompt, role }].concat(thread);
            }
        });

        if (call) {
            threads = await Promise.all(
                threads.map((thread, i) => {
                    return new Promise((resolve) => {
                        setTimeout(() => {
                            const cb =
                                i === 0
                                    ? (response) =>
                                          (this.streamResponse = response)
                                    : undefined;

                            const t = setTimeout(
                                () =>
                                    resolve([
                                        { role: "system", content: `Timeout` },
                                    ]),
                                60000
                            );

                            this.callOpenAI(
                                {
                                    n,
                                    temperature,
                                    model,
                                    max_tokens,
                                    response_format,
                                    messages: thread,
                                    ...keys,
                                },
                                cb
                            )
                                .then(resolve)
                                .catch((e) =>
                                    resolve([
                                        {
                                            content: `Error: ${e.message}\n\nStack: ${e.stack}`,
                                            role: "system",
                                        },
                                    ])
                                )
                                .then(() => {
                                    clearTimeout(t);
                                });
                        }, i * (config.model === "gpt-4-vision-preview" ? 3000 : 100)); // Delay each call by .1 second
                    });
                })
            );
            threads = threads.flat();
        }

        if (config.filter) {
            const filter = new Function("thread", config.filter);
            for (const thread of threads) {
                try {
                    if (!filter(JSON.parse(JSON.stringify(thread)))) {
                        threads.splice(threads.indexOf(thread), 1);
                    }
                } catch (e) {
                    threads.splice(threads.indexOf(thread), 1);
                }
            }
        }

        if (config.map) {
            const map = new Function("thread", config.map);
            let flatten = false;
            threads = threads
                .map((thread) => {
                    try {
                        let newThread = map(thread);
                        if (
                            Array.isArray(newThread) &&
                            Array.isArray(newThread[0])
                        ) {
                            flatten = true;
                        }
                        console.log("newThread", newThread);
                        return newThread;
                    } catch (e) {
                        console.warn(e);
                        return null;
                    }
                })
                .filter((e) => e);
            if (flatten) {
                console.log("thread flat pre", threads);
                threads = threads.flat();
                console.log("thread flat post", threads);
            }
        }

        return threads;
    }

    async callOpenAI(options, cb) {
        if (this.used.size) {
            const tools = Array.from(this.used).map((n) => ({
                type: "function",
                function: {
                    name: n.name,
                    description: n.description,
                    parameters: {
                        type: "object",
                        properties: {
                            input: n.inputSchema,
                            config: n.configSchema,
                        },
                    },
                },
            }));
            options.tools = tools;
        }

        const openai = new OpenAI({
            apiKey: options.apiKey,
            dangerouslyAllowBrowser: true,
        });
        delete options.apiKey;

        const remainder = (options.n || 1) - (options.tools ? 0 : 1);
        const streamOptions = {
            ...options,
            stream: true,
            n: 1,
            user: `stream`,
        };

        const stream = options.tools
            ? [
                  {
                      choices: [
                          {
                              delta: {
                                  content:
                                      "no streaming response when using tools",
                              },
                          },
                      ],
                  },
              ]
            : await openai.chat.completions.create(streamOptions);

        let streamContent = "";

        const remainderResponses = [];
        for (let i = 0; i < remainder; i += 10) {
            const batchSize = Math.min(remainder - i, 10);
            const remainderOptions = {
                ...options,
                n: batchSize,
                user: `remainder-${i}`,
            };
            remainderResponses.push(
                openai.chat.completions.create(remainderOptions)
            );
        }

        let messagesOutput = (
            await Promise.all([
                (async () => {
                    for await (const part of stream) {
                        const delta = part.choices[0]?.delta?.content || "";
                        streamContent += delta;
                        cb?.(streamContent);
                    }
                    console.log("streamContent", streamContent);
                    return {
                        content: streamContent,
                        role: "assistant",
                    };
                })(),
                Promise.all(remainderResponses).then((responses) => {
                    return responses.flatMap((e) =>
                        e.choices.map((e) => e.message)
                    );
                }),
            ])
        )
            .flat()
            .map((msg) => options.messages.concat([msg]));

        messagesOutput = messagesOutput.slice(options.tools ? 1 : 0);

        if (options.tools) {
            cb?.(
                JSON.stringify(
                    messagesOutput[0][messagesOutput[0].length - 1],
                    null,
                    4
                )
            );
            let response = messagesOutput[0][messagesOutput[0].length - 1];
            if (response.tool_calls) {
                for (const toolCall of response.tool_calls) {
                    const functionName = toolCall.function.name;
                    const functionToCall = Array.from(this.used).find(
                        (n) => n.name === functionName
                    );

                    const functionArgs = JSON.parse(
                        toolCall.function.arguments
                    );
                    const functionResponse = await functionToCall.call(
                        functionArgs
                    );
                    messagesOutput[0].push({
                        tool_call_id: toolCall.id,
                        role: "tool",
                        name: functionName,
                        content: safeStringify(functionResponse),
                    }); // extend conversation with function response
                }

                cb?.(
                    JSON.stringify(
                        messagesOutput[0].slice(
                            0 - (response.tool_calls.length + 1)
                        ),
                        null,
                        4
                    )
                );
            }
        }

        return messagesOutput;
    }

    render() {
        return html`<bespeak-form
                .props=${{
                    schema: ChatGPT.config.properties.prompt,
                    uiSchema: {
                        "ui:widget": "textarea",
                    },
                    formData: this.config.prompt || "",
                }}
                .onChange=${(e) => {
                    this.config = {
                        ...this.config,
                        prompt: e.formData,
                    };
                }}></bespeak-form>
            ${this.config?.call
                ? html`<bespeak-stream-renderer
                      .content=${this
                          .streamResponse}></bespeak-stream-renderer>`
                : ""}`;
    }
}
