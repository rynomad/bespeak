import { LitElement, html, css } from "https://esm.sh/lit@2.8.0";
import BespeakComponent from "./component.js";
import { CONFIG, PAYLOAD } from "./types/gpt.js";
class GPTPrompt extends BespeakComponent {
    static output = PAYLOAD;
    static styles = css`
        :host {
            display: block;
            width: 40rem;
        }
    `;
    static config = {
        type: "object",
        properties: {
            placement: {
                type: "string",
                description: "Should the prompt be appended or prepended?",
                enum: ["append", "prepend"],
                default: "append",
            },
            history: {
                type: "number",
                description:
                    "How many messages should be included? When used with 'join', this is the number of messages per thread. Use 0 to include all messages.",
                default: 0,
            },
            join: {
                title: "Join Strategy",
                type: "string",
                description:
                    "When encountering multiple threads, how should they be joined?",
                enum: ["parallel", "sequential", "zipper"],
                default: "sequential",
            },
            context: {
                title: "Context",
                type: "string",
                description:
                    "The input context to use for the prompt. Schema will provide each unique input schema. Values will provide each unique input value.",
                enum: ["none", "schemas", "values", "input_schemas"],
                default: "none",
            },
            preamble: {
                title: "Context Preamble",
                type: "string",
                description:
                    "A custom message to be used as the preamble for the context.",
                default: "",
            },
        },
    };

    async _process(input, config) {
        if (!config) return this.output;
        const { placement, history, join } = config;

        const threads = input
            .filter((input) => input.schema.title === "GPT")
            .map((input) => input.value.threads)
            .flat();

        let outputThreads = [];

        switch (join) {
            case "sequential":
                outputThreads = [
                    threads.map((thread) => thread.slice(-history)).flat(),
                ];
                break;
            case "parallel":
                outputThreads = threads.map((thread) => thread.slice(-history));
                break;
            case "zipper":
                outputThreads = [[]];
                const maxLength = Math.max(
                    ...threads
                        .map((thread) => thread.slice(-history))
                        .map((thread) => thread.length)
                );
                for (let i = 0; i < maxLength; i++) {
                    for (let thread of threads.map((thread) =>
                        thread.slice(-history)
                    )) {
                        if (thread[i]) {
                            outputThreads[0].push(thread[i]);
                        }
                    }
                }
                break;
        }

        if (outputThreads.length === 0) {
            outputThreads.push([]);
        }

        let preamble = config.context !== "none" ? config.preamble : "";
        const seen = new Set();
        switch (config.context) {
            case "schemas":
                preamble +=
                    "\n\n" +
                    input
                        .filter((i) => {
                            if (seen.has(i.schema.title)) {
                                return false;
                            }
                            seen.add(i.schema.title);
                            return true;
                        })
                        .map((i) => JSON.stringify(i.schema, null, 2))
                        .join("\n");
                break;
            case "values":
                preamble +=
                    "\n\n" +
                    input
                        .map((i) => JSON.stringify(i.value, null, 2))
                        .join("\n");
                break;
            case "input_schemas":
                preamble +=
                    "\n\n" +
                    input
                        .filter((i) => {
                            if (!i.input_schema) {
                                return false;
                            }
                            if (seen.has(i.input_schema.title)) {
                                return false;
                            }
                            seen.add(i.input_schema.title);
                            return true;
                        })
                        .map((i) => JSON.stringify(i.input_schema, null, 2))
                        .join("\n");
                break;
            default:
        }

        for (const thread of outputThreads) {
            switch (placement) {
                case "append":
                    thread.push(this.output.prompt);
                    if (preamble) {
                        thread.push({
                            role: "user",
                            content: preamble,
                        });
                    }
                    break;
                case "prepend":
                    thread.unshift(this.output.prompt);
                    if (preamble) {
                        thread.unshift({
                            role: "user",
                            content: preamble,
                        });
                    }
                    break;
            }
        }

        return {
            threads: outputThreads,
            prompt: this.output.prompt,
        };
    }

    render() {
        return html`
            <bespeak-form
                .props=${{
                    schema: {
                        type: "object",
                        properties: {
                            role: {
                                type: "string",
                                enum: ["user", "assistant", "system"],
                                default: "user",
                            },
                            content: { type: "string" },
                        },
                    },
                    uiSchema: {
                        content: {
                            "ui:widget": "textarea",
                            rows: 10,
                        },
                    },
                    formData: this.output?.prompt,
                }}
                .onChange=${async (e) => {
                    this.output.prompt = e.formData;
                    this.output = await this.process(true /** force */);
                }}>
            </bespeak-form>
        `;
    }
}

export default GPTPrompt;

// leave this here for now
export async function quine() {
    const response = await fetch(import.meta.url);
    const source = await response.text();
    return source;
}
