import { LitElement, html, css } from "https://esm.sh/lit@2.8.0";
import "../operable.mjs";
import "../markdown.mjs";

export class LitNode extends LitElement {
    static get properties() {
        return {
            operable: { type: Object },
            status: { type: Object },
            error: { type: Error },
            output: { type: Object },
        };
    }

    static styles = css`
        :host {
            display: block;
        }

        .flex-column {
            display: flex;
            flex-direction: column;
        }
        .item {
            margin-bottom: 10px;
        }
    `;

    connectedCallback() {
        super.connectedCallback();
        clearTimeout(this.unmountTimeout);
    }

    disconnectedCallback() {
        this.unmountTimeout = setTimeout(() => {
            this.subscriptions?.forEach((sub) => sub.unsubscribe());
        }, 1000);
        super.disconnectedCallback();
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has("operable")) {
            this.subscriptions = [
                this.operable.error$.subscribe((error) => {
                    this.error = error;
                }),
                this.operable.status$.subscribe((status) => {
                    if (status.status === "display") {
                        this.display = status;
                    } else {
                        this.status = status;
                    }
                }),
                this.operable.output$.subscribe((output) => {
                    this.output = output;
                }),
                this.operable.input$.subscribe((input) => {
                    this.input = input;
                }),
            ];
        }
    }

    render() {
        return html`<bespeak-operable
            .operable=${this.operable}
            class="flex-column">
            <bespeak-operable-form
                .label=${"Config"}
                .basic=${true}
                .operable=${this.operable}></bespeak-operable-form>
            ${this.display
                ? html`<bespeak-markdown
                      .content=${this.display.detail}></bespeak-markdown>`
                : ""}
            ${this.input
                ? html`<details class="item">
                      <summary>Input</summary>
                      <yaml-renderer .data=${this.input}></yaml-renderer>
                  </details>`
                : ""}
            ${this.output
                ? html`<details class="item">
                      <summary>Output</summary>
                      <yaml-renderer .data=${this.output}></yaml-renderer>
                  </details>`
                : ""}
            ${this.status
                ? html`<details class="item">
                      <summary>${this.status?.message}</summary>
                      <yaml-renderer
                          .data=${this.status?.detail}></yaml-renderer>
                  </details>`
                : ""}
            ${this.error
                ? html`<div class="item">Error: ${this.error}</div>`
                : ""}
        </bespeak-operable>`;
    }
}

customElements.define("bespeak-lit-node", LitNode);
