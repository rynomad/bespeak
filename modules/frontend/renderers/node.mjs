import { LitElement, html, css } from "https://esm.sh/lit@2.8.0";
import "../operable.mjs";
import "../markdown.mjs";

export class LitNode extends LitElement {
    static get properties() {
        return {
            operable: { type: Object },
            display: { type: String },
            status: { type: String },
        };
    }

    static styles = css`
        :host {
            display: block;
        }

        .flex-column {
            display: flex;
            flex-direction: column;
            min-width: 400px;
            min-height: 400px;
        }
        .item {
            margin-bottom: 10px;
        }
    `;

    updated(c) {
        console.log("operable changed", this.operable);
        super.updated(c);
        if (this.operable && !this.subscriptions) {
            console.log("subscribing to operable");
            this.subscriptions = [
                this.operable.read.state$.subscribe((status) => {
                    console.log("status", status);
                    this.display = status.message || this.display;
                    this.status = status.state;
                }),
                this.operable.read.output$.subscribe((output) => {
                    this.output = output;
                }),
                this.operable.read.input$.subscribe((input) => {
                    this.input = input;
                }),
            ];
        }
    }

    render() {
        return html`<bespeak-operable
            .operable=${this.operable}
            class="flex-column">
            <div>
                ${this.display
                    ? html`<bespeak-markdown
                          .content=${this.display}></bespeak-markdown>`
                    : ""}
                ${this.status ? html`<div>${this.status}</div>` : ""}
            </div>
        </bespeak-operable>`;
    }
}

customElements.define("bespeak-lit-node", LitNode);
