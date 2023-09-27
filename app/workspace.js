import { LitElement, html, css } from "https://esm.sh/lit@2.0.1";
import { tap } from "https://esm.sh/rxjs";
import { debug } from "./operators.js";
import "./chat.js";
import "./sidebar.js";
import "./canvas.js";

class BespeakWorkspace extends LitElement {
    static get properties() {
        return {
            id: { type: String },
            ide: { type: Object },
        };
    }

    static get styles() {
        return css`
            :host {
                display: flex;
                height: 100%;
                width: 100%;
            }
            #main {
                display: flex;
                flex-direction: column;
                flex-grow: 1;
                height: 100%;
            }
            bespeak-canvas {
                flex-grow: 1;
                overflow: auto;
            }
            bespeak-chat {
                flex-shrink: 0;
            }
            bespeak-sidebar {
                min-width: 27rem; /* adjust as needed */
                height: 100%;
                overflow: auto;
            }
        `;
    }

    updated(changedProperties) {
        if (changedProperties.has("id")) {
            this.requestUpdate();
        }
    }

    async connectedCallback() {
        super.connectedCallback();
        await this.updateComplete;

        const sidebar = this.shadowRoot.querySelector("bespeak-sidebar");

        this.editorSubscription = this.shadowRoot
            .querySelector("bespeak-canvas")
            .editor$.pipe(debug(this, "workspace editor spy"))
            .subscribe(sidebar.editor$);
    }

    handleFocus() {
        this.shadowRoot.querySelector("bespeak-canvas").chatFocus$.next();
    }

    handleBlur() {
        this.shadowRoot.querySelector("bespeak-canvas").chatBlur$.next();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.chatSubscription.unsubscribe();
    }

    render() {
        return html`
            <div id="main">
                <bespeak-canvas id=${this.id} .ide=${this.ide}></bespeak-canvas>
            </div>
            <bespeak-sidebar id=${this.id} .ide=${this.ide}></bespeak-sidebar>
        `;
    }
}

customElements.define("bespeak-workspace", BespeakWorkspace);
