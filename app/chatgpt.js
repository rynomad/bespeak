import { html } from "https://esm.sh/lit";
import OpenAI from "https://esm.sh/openai@4.11.0";

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
            temperature: {
                type: "number",
                title: "Temperature",
                description: "how creative should the responses be?",
                default: 0.3,
            },
            model: {
                type: "string",
                title: "Model",
                description: "which model should be used?",
                default: "gpt-3.5-turbo-0613",
                enum: ["gpt-4", "gpt-3.5-turbo-0613"],
            },
            history: {
                type: "number",
                title: "History",
                description: "how many messages should be included? 0 for all.",
                default: 0,
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
            this.requestUpdate();
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

        let threads = input
            .filter((e) => e.schema.title === "GPT")
            .map((e) => e.value)
            .filter((e) => e)
            .flat();

        threads = threads.map((thread) => {
            if (!history) {
                return thread;
            } else if (history > 0) {
                return thread.slice(-history);
            }
        });

        if (threads.length === 0 && this.pipedFrom.size) {
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
            if (placement === "append") {
                return thread.concat({ content: prompt, role });
            } else {
                return [{ content: prompt, role }].concat(thread);
            }
        });

        threads = threads.map((thread) => {
            if (context === "values") {
                return thread.concat({
                    content: JSON.stringify(
                        input
                            .filter(({ schema }) => schema.title !== "GPT")
                            .map(({ value }) => value),
                        null,
                        4
                    ),
                    role: "user",
                });
            }

            return thread;
        });

        if (!call) {
            return threads;
        }

        threads = await Promise.all(
            threads.map((thread, i) => {
                const cb =
                    i === 0
                        ? (response) => (this.streamResponse = response)
                        : undefined;
                return this.callOpenAI(
                    {
                        n,
                        temperature,
                        model,
                        messages: thread,
                        ...keys,
                    },
                    cb
                );
            })
        );

        threads = threads.flat();

        return threads;
    }

    async callOpenAI(options, cb) {
        const openai = new OpenAI({
            apiKey: options.apiKey,
            dangerouslyAllowBrowser: true,
        });
        delete options.apiKey;

        const remainder = (options.n || 1) - 1;
        const streamOptions = {
            ...options,
            stream: true,
            n: 1,
            user: `stream`,
        };

        const stream = await openai.chat.completions.create(streamOptions);

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

        const messagesOutput = (
            await Promise.all([
                (async () => {
                    for await (const part of stream) {
                        const delta = part.choices[0]?.delta?.content || "";
                        streamContent += delta;
                        cb?.(streamContent);
                    }
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
