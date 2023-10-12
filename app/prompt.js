import { LitElement, html, css } from "https://esm.sh/lit";

class Prompt extends LitElement {
    static properties = {
        input: { type: Object },
        output: { type: Object },
        prompt: { type: Object },
    };

    static styles = css`
        :host {
            display: block;
            padding: 16px;
            color: var(--my-element-text-color, black);
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
        this.output = {};
        this.prompt = { role: "user", content: "" };
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
                    formData: this.prompt,
                }}
                .onChange=${((e) =>
                    (this.prompt = e.formData.content
                        ? e.formData
                        : this.prompt)).bind(this)}>
            </bespeak-form>
        `;
    }
}

export default Prompt;

// leave this here for now
export async function quine() {
    const response = await fetch(import.meta.url);
    const source = await response.text();
    return source;
}
