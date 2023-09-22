import { LitElement, css, html } from "https://esm.sh/lit";
import validator from "https://esm.sh/@rjsf/validator-ajv8?alias=lodash:lodash-es";
import Form from "https://esm.sh/@rjsf/bootstrap-4?alias=lodash:lodash-es,deps=react@18.2.0,react-dom@18.2.0";

import { BehaviorSubject, filter } from "https://esm.sh/rxjs@7.3.0";
import { PropagationStopper, CardStyleMixin } from "./mixins.js";
import { bootstrapCss } from "./bootstrap.css.js";
import "./react.js";
export function setSubmitButtonOptions(uiSchema, options) {
    const newUiSchema = uiSchema || {};
    newUiSchema["ui:submitButtonOptions"] = {
        ...newUiSchema["ui:submitButtonOptions"], // Preserve existing options if they exist
        ...options, // Merge with new options
    };
    return newUiSchema;
}
export const RJSFComponent = CardStyleMixin(
    PropagationStopper(
        class RJSFComponentBase extends LitElement {
            static styles = [
                bootstrapCss,
                css`
                    :host {
                        display: block;
                        overflow: auto;
                    }
                `,
            ];

            static properties = {
                props: { type: Object },
                nodeId: { type: String },
            };

            // Create a new Subject to receive change events
            subject = new BehaviorSubject();
            debounceTime = 5000;

            constructor() {
                super();
                this._props = {
                    schema: {},
                    uiSchema: {},
                    formData: {},
                    onSubmit: (e) => {
                        delete e.formData.fromStorage;
                        this.props.subject?.next(e.formData);
                    },
                    validator: validator,
                };
                // console.log("props?", this.props);
            }

            updated(changedProperties) {
                if (this.reactWrapper && changedProperties.has("props")) {
                    this.subscription?.unsubscribe();
                    this.subscription = this.props.subject
                        .pipe(filter((v) => Object.keys(v).length > 0))
                        .subscribe((value) => {
                            console.log(
                                this.props.node.id,
                                value,
                                this.props.subject
                            );
                            this.reactWrapper.props = {
                                ...this.reactWrapper.props,
                                formData: value,
                            };
                        });
                }

                if (changedProperties.has("nodeId")) {
                    console.log("changed node id");
                }
            }

            firstUpdated() {
                const reactWrapper = (this.reactWrapper =
                    document.createElement("bespeak-react"));
                reactWrapper.reactComponent = Form;
                reactWrapper.props = {
                    ...this._props,
                    ...this.props,
                    uiSchema: setSubmitButtonOptions(
                        this.props.uiSchema || {},
                        {
                            submitText: "Save",
                        }
                    ),
                };
                this.subscription = reactWrapper.props.subject?.subscribe(
                    (e) => {
                        console.log("form", e);
                        reactWrapper.props = {
                            ...reactWrapper.props,
                            formData: e,
                        };
                    }
                );
                console.log(reactWrapper.props);
                this.appendChild(reactWrapper);
            }

            render() {
                return html`<div style="font-size: 1.3rem; font-weight: bold;">
                        ${this.props.name || this.props.label}
                    </div>
                    <slot></slot>`; // Exposed slot for the React content
            }
        }
    )
);
customElements.define("bespeak-form", RJSFComponent);
