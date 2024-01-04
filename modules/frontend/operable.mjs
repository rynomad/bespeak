import "./flipper.mjs";
import { LitElement, html, css } from "https://esm.sh/lit@2.8.0";

import "./tabs.mjs";
import "./yaml.mjs";
import "./form.mjs";
import "https://esm.sh/@dile/dile-pages/dile-pages.js";
import "https://esm.sh/@dile/dile-tabs/dile-tabs.js";
import { deepEqual } from "https://esm.sh/fast-equals";
import { PropagationStopper } from "./mixins.mjs";
class LitOperable extends LitElement {
    static properties = {
        operable: { type: Object },
    };

    static styles = css`
        :host {
            display: block;
            width: 100%;
            height: 100%;
            position: relative;
            transition: transform 1s 0s; // Added 0s delay
        }

        .container {
            width: 100%;
            height: 100%;
            overflow-y: auto; /* Add overflow-y to the content to create a scrollbar within the sidebar */
        }

        .inner {
            width: 100%;
            height: 100%;
            padding-left: 2rem;
            padding-right: 2rem;
        }
    `;

    updated(changedProperties) {
        if (
            changedProperties.has("operable") &&
            this.operable &&
            !this.subsciptions
        ) {
            this.subscriptions = [
                // this.operable.log$.subscribe((log) => {
                //     // console.log("log", log);
                // }),
                // this.operable.status$.subscribe((status) => {
                //     console.log("status", status);
                // }),
                this.operable.error$.subscribe((error) => {
                    this.error = error;
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
        return html`<bespeak-flipper class="front">
            <div class="inner" class="container" slot="front">
                <slot></slot>
            </div>
            <div class="inner" slot="back">
                <bespeak-operable-back
                    .operable=${this.operable}></bespeak-operable-back>
            </div>
        </bespeak-flipper>`;
    }
}

customElements.define("bespeak-operable", LitOperable);

class LitOperableBack extends PropagationStopper(LitElement) {
    static properties = {
        operable: { type: Object },
    };

    static styles = css`
        :host {
            height: 100%;
            display: block;
            position: relative;
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

    tabs = ["Meta", "Input", "Config", "Keys", "Output", "Status", "Log"];

    render() {
        return html`
            <div class="content">
                <dile-tabs
                    id="select2"
                    attrForSelected="name"
                    selectorId="selector"
                    style="flex-flow: row wrap;"
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
        basic: { type: Boolean },
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
        console.log(
            "updated",
            this.operable,
            this.label,
            this.basic,
            this.subscriptions
        );
        if (this.operable && this.label && !this.subscriptions) {
            console.log("subscribing to", `${this.label.toLowerCase()}$`);
            const role = this.label.toLowerCase();
            this.subscriptions = [
                this.operable.schema[`${role}$`].subscribe((schema) => {
                    console.log("schema", schema);
                    this.schema = schema;
                }),
                this.operable.read[`${role}$`].subscribe((data) => {
                    // console.log("log", log);
                    this.data = data;
                }),
            ];
        }
    }

    get doBasic() {
        return this.basic && this.schema.properties.basic;
    }

    get formData() {
        return this.doBasic ? this.data?.basic : this.data;
    }

    set formData(data) {
        if (this.doBasic) {
            this.data = {
                ...this.data,
                basic: data,
            };
        } else {
            this.data = data;
        }
    }

    get formSchema() {
        return this.doBasic ? this.schema.properties.basic : this.schema;
    }

    render() {
        return this.schema
            ? html`<bespeak-form
                  .props=${{
                      schema: this.formSchema,
                      uiSchema: {
                          "ui:widget": "textarea",
                      },
                      formData: this.formData,
                  }}
                  .onChange=${(e) => {
                      if (!this.formData) {
                          this.formData = e.formData;
                      }
                      if (deepEqual(e.formData, this.formData)) {
                          return;
                      }
                      this.formData = e.formData;
                      if (["Input", "Output"].includes(this.label)) {
                          console.log(
                              "writing",
                              this.label,
                              e.formData,
                              this.formData
                          );
                          this.operable[`${this.label.toLowerCase()}$`].next(
                              this.data
                          );
                      } else if (this.label === "Ingress") {
                          this.operable.write$$(`ingress:config`, e.formData);
                      } else {
                          this.operable
                              .write$$(
                                  `process:${this.label.toLowerCase()}`,
                                  this.data
                              )
                              .subscribe(() => {
                                  console.log("wrote", this.label);
                              });
                      }
                  }}></bespeak-form>`
            : html``;
    }
}

customElements.define("bespeak-operable-form", LitOperableForm);
