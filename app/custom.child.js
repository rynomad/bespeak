import BespeakComponent from "./component.js";
import { importFromString } from "./util.js";
import { html, css } from "https://esm.sh/lit";

export default class NewNode extends BespeakComponent {
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
        this.slotSubscription = null;
    }

    render() {
        return html`
            <slot></slot>
            <button>Save</button>
        `;
    }

    async _process(input, config, keys) {
        // Unsubscribe from previous component if exists
        if (this.slotSubscription) {
            this.slotSubscription.unsubscribe();
            this.slotSubscription = null;
        }

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

            // Subscribe to the component's output
            this.slotSubscription = this.slotComponent.output$.subscribe(
                (outputEvent) => {
                    this.output = outputEvent.value;
                }
            );

            // Insert the component into the slot
            this.shadowRoot
                .querySelector("slot")
                .replaceChildren(this.slotComponent);
        }

        return this.output;
    }
}
