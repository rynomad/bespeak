import { LitElement, html, css } from "https://esm.sh/lit";
import { ReteNode } from "./node.child.js";
import BespeakComponent from "./component.js";

export default class OutputTypes extends BespeakComponent {
    constructor(id) {
        super(id);
    }

    connectedCallback() {
        super.connectedCallback();
        this.subscription = ReteNode.components$.subscribe((components) => {
            console.log("COMPONENTS", components);
            this.output = components.map(({ Component }) => Component.output);
            this.requestUpdate();
        });
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.subscription?.unsubscribe();
    }

    icon = "list-alt";

    static get output() {
        return {
            type: "array",
            items: { type: "object" },
            title: "Collected Outputs",
            description:
                "Array of all static output properties from various components",
        };
    }
}
