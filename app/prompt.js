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
                    this.output = {
                        messages: (this.input.messages || []).concat(
                            e.formData
                        ),
                        prompt: e.formData,
                    };
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
