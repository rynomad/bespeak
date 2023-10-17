import { LitElement, html, css } from "https://esm.sh/lit";
import { NextReteNode } from "./node.js";

class FlowOutput extends LitElement {
    static properties = {
        input: { type: Object },
        output: { type: Object },
    };

    static ports = ["input"];

    get outputSchema() {
        return this.inputSchema;
    }

    static styles = css``;

    constructor() {
        super();
        this.input = {};
        this.output = {};
    }

    updated(changedProperties) {
        if (changedProperties.has("input")) {
            this.output = this.input;
        }
    }

    render() {
        return html``;
    }
}

export default FlowOutput;

// leave this here for now
export async function quine() {
    const response = await fetch(import.meta.url);
    const source = await response.text();
    return source;
}
