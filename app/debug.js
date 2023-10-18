import { LitElement, html, css } from "https://esm.sh/lit@2.8.0";
import { sanitizeAndRenderYaml } from "./util.js";

class Debug extends LitElement {
    static properties = {
        input: { type: Object },
        inputSchema: { type: Object },
    };

    static styles = css`
        :host {
            display: block;
            padding: 16px;
            color: var(--my-element-text-color, black);
        }
        pre {
            background-color: #f5f5f5;
            padding: 10px;
            border-radius: 5px;
        }
    `;

    constructor() {
        super();
        this.input = {};
        this.inputSchema = {};
    }

    render() {
        return html`
            <h2>Input</h2>
            <pre>${sanitizeAndRenderYaml(this.input)}</pre>
            <h2>Input Schema</h2>
            <pre>${sanitizeAndRenderYaml(this.inputSchema)}</pre>
        `;
    }
}

export default Debug;

export async function quine() {
    const response = await fetch(import.meta.url);
    const text = await response.text();
    return text;
}
