import { LitElement, css, html } from "https://esm.sh/lit@2.8.0";
import validator from "https://esm.sh/@rjsf/validator-ajv8?alias=lodash:lodash-es";
import Form from "https://esm.sh/@rjsf/bootstrap-4?alias=lodash:lodash-es,deps=react@18.2.0,react-dom@18.2.0";

import { BehaviorSubject, filter } from "https://esm.sh/rxjs@7.3.0";
import { PropagationStopper, CardStyleMixin } from "./mixins.mjs";
import { bootstrapCss } from "./bootstrap.css.mjs";
import "./react.mjs";
import { TextAreaWidget } from "./form-textarea.mjs";
import { JsonTextAreaWidget } from "./form-json.mjs";
import { AutoCompleteWidget } from "./form-autocomplete.mjs";

export function setSubmitButtonOptions(uiSchema, options, schema) {
    // find any properties in the schema which have an enum with more than 10 options, and set it to use the autocomplete widget if so

    const newUiSchema = uiSchema || {};
    newUiSchema["ui:submitButtonOptions"] = {
        showSubmitButton: false, // Set default behavior to not show the submit button
        ...newUiSchema["ui:submitButtonOptions"], // Preserve existing options if they exist
        ...options, // Merge with new options
    };

    Object.keys(schema.properties ? schema.properties : {}).forEach((key) => {
        if (
            schema.properties[key].enum &&
            (schema.properties[key].enum?.length > 10 ||
                schema.properties[key].oneOf?.length > 10)
        ) {
            newUiSchema[key] = {
                "ui:widget": "autocomplete",
            };
        } else if (
            schema.properties[key].type === "string" &&
            !newUiSchema[key] &&
            !schema.properties[key].enum &&
            !schema.properties[key].oneOf
        ) {
            newUiSchema[key] = {
                "ui:widget": "textarea",
            };
        }
    });

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
                        margin: 0;
                        min-width: 35rem;
                    }
                `,
            ];

            static properties = {
                props: { type: Object },
                nodeId: { type: String },
                onChange: { type: Function },
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
                    onChange: (e) => {
                        // Ignore the event if a textarea is focused
                        this.formData = e.formData;
                        if (!this.focused) {
                            this.onChange(e);
                        }
                    },
                    widgets: {
                        textarea: TextAreaWidget,
                        json: JsonTextAreaWidget,
                        autocomplete: AutoCompleteWidget,
                    },
                    // Add onFocus and onBlur handlers
                    onFocus: (id, value) => {
                        this.focused = true;
                    },
                    onBlur: (id, value) => {
                        this.focused = false;
                        this.onChange({ formData: this.formData });
                    },
                    validator: validator,
                    children: true,
                };
                // console.log("props?", this.props);
            }

            updated(changedProperties) {
                if (this.reactWrapper && this.props && this.onChange) {
                    this.schema = this.props.schema?.userSchema
                        ? this.props.schema.schema
                        : this.props.schema;
                    this.uiSchema = this.props.schema?.uiSchema;
                    this.formData = this.props.formData;
                    this.reactWrapper.props = {
                        ...this._props,
                        ...this.reactWrapper.props,
                        ...this.props,
                        schema: this.schema,
                        uiSchema: setSubmitButtonOptions(
                            this.props.uiSchema || {},
                            {},
                            this.schema
                        ),
                        formData: this.formData,
                    };
                }
            }

            async firstUpdated() {
                const reactWrapper = (this.reactWrapper =
                    document.createElement("bespeak-react"));
                await this.updateComplete;
                reactWrapper.reactComponent = Form;
                reactWrapper.props = {
                    ...this._props,
                    ...this.props,
                };
                // console.log(reactWrapper.props);
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
