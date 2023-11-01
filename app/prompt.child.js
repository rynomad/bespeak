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
                    for (const input of this.input) {
                        for (let thread of input.value.threads) {
                            if (thread[i]) {
                                outputThreads[0].push(thread[i]);
                            }
                        }
                    }
                }
                break;
        }

        if (outputThreads.length === 0) {
            outputThreads.push([]);
        }

        for (const thread of outputThreads) {
            switch (placement) {
                case "append":
                    thread.push(this.output.prompt);
                    break;
                case "prepend":
                    thread.unshift(this.output.prompt);
                    break;
            }

            input
                .filter((input) => input.schema.title !== "GPT")
                .forEach((input) => {
                    if (input.value instanceof Error) {
                        input.value = `Error: ${input.value.message}\n\n${input.value.stack}`;
                    }
                    thread.push({
                        role: "system",
                        content: JSON.stringify(input.value, null, 2),
                    });
                });
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
