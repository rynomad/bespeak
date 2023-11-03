import BespeakComponent from "./component.js";
import { importFromString, transformSource } from "./util.js";
import { html, css } from "https://esm.sh/lit";
import { ReteNode } from "./node.child.js";

export default class NewNode extends BespeakComponent {
    static output = {
        type: "object",

        additionalProperties: true,
    };

    static styles = css`
        :host {
            display: flex;
            flex-direction: column;
        }
        ::slotted(*) {
            width: 100%;
        }
        button {
            margin-top: 1rem;
        }
    `;

    constructor(id) {
        super(id);
        this.slotComponent = null;
        this.subs = [];
    }

    render() {
        return html`
            ${this.slotComponent?.inputSchema
                ? html`<bespeak-form
                      .props=${{
                          schema: this.slotComponent.inputSchema,
                          formData: this.slotComponent.input,
                      }}
                      .onChange=${({ formData }) => {
                          this.slotComponent.input = formData;
                          this.requestUpdate();
                      }}></bespeak-form>`
                : ""}
            ${this.slotComponent
                ? html`<bespeak-form
                      .props=${{
                          schema: this.slotComponent.configSchema,
                          formData: this.slotComponent.config,
                      }}
                      .onChange=${({ formData }) => {
                          this.slotComponent.config = formData;
                          this.requestUpdate();
                      }}></bespeak-form>`
                : ""}
            <slot></slot>
            <button @click=${this.saveComponent}>Save</button>
        `;
    }

    saveComponent() {
        if (this.slotComponent) {
            const jsSchema = this.input.find(
                (schema) =>
                    schema.schema.title === "code" &&
                    schema.config.language === "javascript"
            );
            const sourceCode = jsSchema.value;
            const transformedSource = transformSource(sourceCode);
            ReteNode.registerComponent(
                this.slotComponent.constructor.tagName,
                transformedSource
            );
        }
    }

    async _process(input, config, keys) {
        // Unsubscribe from previous component if exists
        this.subs.forEach((sub) => sub.unsubscribe());

        // Find the schema with title 'javascript'
        const jsSchema = input.find(
            (schema) =>
                schema.schema.title === "code" &&
                schema.config.language === "javascript"
        );

        if (jsSchema) {
            // Import the component from the source code
            const Component = (await importFromString(jsSchema.value)).default;

            // Generate a valid custom element name
            const id = `custom-element-${Math.random()
                .toString(36)
                .substring(2, 8)}`;
            customElements.define(id, Component);

            // Construct the component and set its input
            this.slotComponent = new Component();
            this.slotComponent.input = input;

            this.subs = [
                this.slotComponent.output$.subscribe((outputEvent) => {
                    this.output = [outputEvent];
                }),
                this.slotComponent.error$.subscribe((error) => {
                    this.output = error;
                }),
            ]; // Subscribe to the component's output

            // Insert the component into the slot
            this.shadowRoot
                .querySelector("slot")
                .replaceChildren(this.slotComponent);
            this.requestUpdate();
        }

        return this.output;
    }
}
