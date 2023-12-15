import "./flipper.mjs";
import { LitElement, html, css } from "https://esm.sh/lit@2.8.0";

import "./tabs.mjs";
import "./yaml.mjs";
import "./form.mjs";
import "https://esm.sh/@dile/dile-pages/dile-pages.js";
import "https://esm.sh/@dile/dile-tabs/dile-tabs.js";
class LitOperable extends LitElement {
    static properties = {
        operable: { type: Object },
    };

    static styles = css`
        :host {
            display: block;
            position: relative;
            border: 2px solid black;
            transition: transform 1s 0s; // Added 0s delay
        }
    `;

    updated(changedProperties) {
        if (
            changedProperties.has("operable") &&
            this.operable &&
            !this.subsciption
        ) {
            this.subscriptions = [
                this.operable.log$.subscribe((log) => {
                    // console.log("log", log);
                }),
                this.operable.status$.subscribe((status) => {
                    console.log("status", status);
                }),
            ];
        }
    }

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

    render() {
        return html`<bespeak-flipper
            @click=${() => console.log("click node flipper")}
            class="front">
            <div
                class="container"
                slot="front"
                style="min-width: ${!this.component?.icon
                    ? "40rem"
                    : "20px"}; min-height: 20px; padding: 1.5rem; max-width: 50vw; max-height: 50vh; overflow: auto;"></div>
            <div slot="back" style="padding: 1.5rem">
                <bespeak-operable-back
                    .operable=${this.operable}></bespeak-operable-back>
            </div>
        </bespeak-flipper>`;
    }
}

customElements.define("bespeak-operable", LitOperable);

class LitOperableBack extends LitElement {
    static properties = {
        operable: { type: Object },
    };

    static styles = css`
        :host {
            display: block;
            position: relative;
            border: 2px solid black;
            transition: transform 1s 0s; // Added 0s delay
        }

        md-tabs {
            height: calc(
                100% - 4rem
            ); /* Subtract the height of the tabs from the sidebar height */
        }

        .content {
            height: 100%;
            overflow-y: auto; /* Add overflow-y to the content to create a scrollbar within the sidebar */
        }
    `;

    tabs = ["Input", "Config", "Keys", "Output", "Status", "Log"];

    render() {
        return html`
            <div class="content">
                <!-- Render the data as JSON for demonstration -->
                <dile-tabs
                    id="select2"
                    attrForSelected="name"
                    selectorId="selector"
                    selected="${this.openTab || "Config"}">
                    ${this.tabs.map(
                        (label, index) => html`
                            <dile-tab
                                icon="label_important"
                                name=${label}
                                ${this.activeTabIndex === index ? "active" : ""}
                                >${label}</dile-tab
                            >
                        `
                    )}
                </dile-tabs>
                ${this.tabs.map(
                    (label, index) => html`<dile-pages
                        attrForSelected="name"
                        selectorId="selector"
                        selected="${this.openTab}">
                        <div name=${label}>
                            ${["Status", "Log"].includes(label)
                                ? html`<bespeak-operable-log
                                      .label=${label}
                                      .operable=${this
                                          .operable}></bespeak-operable-log>`
                                : html`<bespeak-operable-form
                                      .label=${label}
                                      .operable=${this
                                          .operable}></bespeak-operable-form>`}
                        </div>
                    </dile-pages>`
                )}
            </div>
        </div>`;
    }
}

customElements.define("bespeak-operable-back", LitOperableBack);

class LitOperableLog extends LitElement {
    static properties = {
        operable: { type: Object },
        label: { type: String },
    };

    static styles = css`
        :host {
            display: block;
            position: relative;
            border: 2px solid black;
            transition: transform 1s 0s; // Added 0s delay
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
        if (this.operable && this.label && !this.subscriptions) {
            console.log("subscribing to", `${this.label.toLowerCase()}$`);
            this.subscriptions = [
                this.operable[`${this.label.toLowerCase()}$`].subscribe(
                    (log) => {
                        // console.log("log", log);
                        const el = document.createElement(
                            "bespeak-operable-log-entry"
                        );
                        el.log = log;
                        el.label = this.label;
                        this.appendChild(el);
                    }
                ),
            ];
        }
    }

    render() {
        return html`<slot></slot>`;
    }
}

customElements.define("bespeak-operable-log", LitOperableLog);

class LitOperableLogEntry extends LitElement {
    static properties = {
        log: { type: Object },
        label: { type: String },
    };

    static styles = css`
        :host {
            display: block;
            position: relative;
            border: 2px solid black;
            transition: transform 1s 0s; // Added 0s delay
        }
    `;

    render() {
        return this.label === "Status"
            ? html`
                  <details>
                      <summary>${this.log.message}</summary>
                      <yaml-renderer .data=${this.log.detail}></yaml-renderer>
                  </details>
              `
            : html`<pre>
${this.log.message}:
${this.log.callSite}</pre
              >`;
    }
}

customElements.define("bespeak-operable-log-entry", LitOperableLogEntry);

class LitOperableForm extends LitElement {
    static properties = {
        operable: { type: Object },
        label: { type: String },
        schema: { type: Object },
        data: { type: Object },
    };

    static styles = css`
        :host {
            display: block;
            position: relative;
            border: 2px solid black;
            transition: transform 1s 0s; // Added 0s delay
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
        if (this.operable && this.label && !this.subscriptions) {
            console.log("subscribing to", `${this.label.toLowerCase()}$`);
            const innerRole = this.label.toLowerCase();
            if (["input", "output"].includes(innerRole)) {
                this.subscriptions = [
                    this.operable
                        .schema$$(`process:${innerRole}`)
                        .subscribe((schema) => {
                            console.log("schema", schema);
                            this.schema = schema;
                        }),
                    this.operable[`${this.label.toLowerCase()}$`].subscribe(
                        (data) => {
                            // console.log("log", log);
                            this.data = data;
                        }
                    ),
                ];
            } else {
                const role =
                    this.label === "Ingress"
                        ? "ingress:config"
                        : `process:${innerRole}`;
                this.subscriptions = [
                    this.operable.schema$$(role).subscribe((schema) => {
                        console.log("schema", schema);
                        this.schema = schema;
                    }),
                    this.operable.read$$(role).subscribe(({ data }) => {
                        console.log("data", data);
                        this.data = data;
                    }),
                ];
            }
        }
    }

    render() {
        return this.schema
            ? html`<bespeak-form
                  .props=${{
                      schema: this.schema,
                      uiSchema: {
                          "ui:widget": "textarea",
                      },
                      formData: this.data,
                  }}
                  .onChange=${(e) => {
                      console.log("changed", e);
                  }}></bespeak-form>`
            : html``;
    }
}

customElements.define("bespeak-operable-form", LitOperableForm);
