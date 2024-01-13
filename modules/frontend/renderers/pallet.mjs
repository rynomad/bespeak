import { of } from "rxjs";
import { LitElement, html, css } from "https://esm.sh/lit@2.8.0";
import { repeat } from "https://esm.sh/lit/directives/repeat.js";
import "../pills.mjs";

class BespeakList extends LitElement {
    static styles = css`
        :host {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
        }
    `;

    render() {
        return html`<slot></slot>`;
    }
}

customElements.define("bespeak-list", BespeakList);

export class BespeakNodeList extends LitElement {
    static properties = {
        nodes: { type: Array },
    };

    constructor() {
        super();
        this.nodes = [];
    }

    render() {
        return html`
            <bespeak-list>
                <slot></slot>
                ${repeat(
                    this.nodes,
                    ({ key }) => key,
                    (definition) =>
                        html`<bespeak-node-pill
                            id=${definition.key}
                            .definition=${definition}></bespeak-node-pill>`
                )}
            </bespeak-list>
        `;
    }
}

customElements.define("bespeak-node-list", BespeakNodeList);

class Pallet extends LitElement {
    static get properties() {
        return {
            db: { type: Object },
            nodes: { type: Array },
        };
    }

    static styles = css`
        :host {
            width: 20rem;
            display: block;
            height: 100%;
        }
    `;

    constructor() {
        super();
        this.nodes = [];
    }

    async firstUpdated() {
        await this.updateComplete;
        console.log("first updated", this.db);
        of({
            collection: "modules",
            operation: "find",
            params: {
                selector: {
                    type: "process",
                },
            },
        })
            .pipe(this.db.asOperator())
            .subscribe((res) => (this.nodes = res));
    }

    render() {
        return html`
            <div class="container">
                <bespeak-node-list .nodes=${this.nodes}></bespeak-node-list>
            </div>
        `;
    }
}

customElements.define("bespeak-pallet", Pallet);
