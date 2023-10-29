import { LitElement, html, css } from "https://esm.sh/lit@2.8.0";
import { NextReteNode } from "./node.js";
import { faBrands, faSolid } from "./icons/fa.index.js";
class FlowOutput extends LitElement {
    static properties = {
        input: { type: Object },
        output: { type: Object },
    };

    static config = {
        type: "object",
        properties: {
            icon: {
                type: "string",
                description:
                    "The icon to display when this flow is used as a node in another flow",
                enum: faBrands
                    .map((icon) => `brand-${icon.name}`)
                    .concat(faSolid.map((icon) => icon.name))
                    .concat(["openai"]),
            },
        },
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
