import { LitElement, html, css } from "https://esm.sh/lit@2.8.0";

class GPTPrompt extends LitElement {
    static reactivePaths = ["$.input.messages"];
    static properties = {
        input: { type: Object },
        output: { type: Object },
        prompt: { type: Object },
    };
    static outputSchema = {
        type: "object",
        properties: {
            messages: {
                items: {
                    type: "object",
                    properties: {
                        role: { type: "string" },
                        content: { type: "string" },
                    },
                },
            },
            prompt: {
                type: "object",
                properties: {
                    role: { type: "string" },
                    content: { type: "string" },
                },
            },
        },
    };

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
                enum: ["sequential", "zipper"],
                default: "sequential",
            },
        },
    };

    static styles = css`
        :host {
            display: block;
            color: var(--my-element-text-color, black);
            width: 50rem;
        }
        .content-editable {
            border: 1px solid #ccc;
            padding: 10px;
            min-height: 50px;
            width: 100%;
            resize: none;
            overflow: hidden;
            outline: none;
            font-size: 1rem;
            line-height: 1.5;
            color: #495057;
            background-color: #fff;
            background-clip: padding-box;
            border-radius: 0.25rem;
            transition: border-color 0.15s ease-in-out,
                box-shadow 0.15s ease-in-out;
        }
        select {
            width: 100%;
            height: calc(1.5em + 0.75rem + 2px);
            padding: 0.375rem 0.75rem;
            font-size: 1rem;
            font-weight: 400;
            line-height: 1.5;
            color: #495057;
            vertical-align: middle;
            background: #fff;
            border: 1px solid #ced4da;
            border-radius: 0.25rem;
        }
    `;

    constructor() {
        super();
        this.input = {};
        this.output = {
            messages: [],
            prompt: {},
        };
    }
    updated(changedProperties) {
        if (changedProperties.has("input") || changedProperties.has("config")) {
            this.makeOutput(this.output.prompt);
        }
    }

    makeOutput(prompt) {
        if (!this.config) return;
        const { placement, history, join } = this.config;

        const messages =
            this.input.messages instanceof Set
                ? new Set(this.input.messages)
                : new Set([this.input.messages || []]);

        const threads = [];
        for (let thread of messages) {
            if (history > 0) {
                thread = thread.slice(-history);
            }

            threads.push(thread);
        }

        const messagesOut = [];

        if (join === "sequential") {
            for (let thread of threads) {
                messagesOut.push(...thread);
            }
        } else {
            const maxLength = Math.max(
                ...threads.map((thread) => thread.length)
            );
            for (let i = 0; i < maxLength; i++) {
                for (let thread of threads) {
                    if (thread[i]) {
                        messagesOut.push(thread[i]);
                    }
                }
            }
        }

        if (placement === "append") {
            messagesOut.push(prompt);
        } else {
            messagesOut.unshift(prompt);
        }

        this.output = {
            messages: messagesOut,
            prompt,
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
                .onChange=${(e) => {
                    this.makeOutput(e.formData);
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
