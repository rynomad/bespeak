import { LitElement, html, css } from "https://esm.sh/lit@2.8.0";
import "./lists.js";

class Pallet extends LitElement {
    static get styles() {
        return css`
            :host {
                display: flex;
                flex-direction: column;
                height: 100%;
                width: 100%;
                box-shadow: 2px 0 4px rgba(0, 0, 0, 0.2); /* Subtle right hand shadow */
                background-color: ghostwhite; /* Beige background */
            }
            .workspace-list {
                height: 33%;
                overflow: auto;
                border-bottom: 1px solid #ccc;
            }

            .node-list {
                flex-grow: 2;
                overflow: auto;
            }

            .separator {
                height: 1px;
                background-color: #ccc;
                margin: 10px 0;
            }

            .plus-button {
                display: flex;
                justify-content: center;
                align-items: center;
                height: 30px;
                background-color: blue;
                color: white;
                cursor: pointer;
                margin: 10px;
            }
        `;
    }

    static get properties() {
        return {
            ide: { type: Object },
        };
    }

    updated(changedProperties) {
        if (changedProperties.has("ide")) {
            this.ide = this.ide;
            this.requestUpdate();
        }
    }

    render() {
        return html`
            <div class="plus-button" @click=${this.ide?.newWorkspace}>+</div>

            <bespeak-workspace-list
                class="workspace-list"
                .ide=${this.ide}></bespeak-workspace-list>
            <div class="separator"></div>
            <bespeak-node-list
                class="node-list"
                .ide=${this.ide}></bespeak-node-list>
        `;
    }
}

customElements.define("bespeak-pallet", Pallet);
