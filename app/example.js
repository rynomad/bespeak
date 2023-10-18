import { LitElement, html, css } from "https://esm.sh/lit@2.8.0";
import { Types } from "./types.js";
const CUSTOM_TYPE = {
    type: "custom-type",
    schema: {
        type: "object",
        properties: {
            text: {
                type: "string",
            },
            number: {
                type: "number",
            },
        },
    },
};
export default class ExampleComponent extends LitElement {
    static get properties() {
        return {
            example_input: { type: Types.get("example") },
            example_output: { type: CUSTOM_TYPE },
        };
    }

    async connectedCallback() {
        super.connectedCallback();
        // all this component does is open the src editor so you can change it.
        await this.updateComplete;
        if (!this.initialized) {
            this.initialized = true;
            this.toggleSrc();
        }
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has("example_input")) {
            this.updateExampleOutput();
        }
    }

    updateExampleOutput() {
        // Your implementation here
    }

    static styles = css`
        :host {
            display: block;
        }
    `;

    render() {
        return html`
            <div>
                <!-- Your HTML here -->
            </div>
        `;
    }
}

// leave this here for now
export async function quine() {
    const response = await fetch(import.meta.url);
    const source = await response.text();
    return source;
}
