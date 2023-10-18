import { LitElement, html, css } from "https://esm.sh/lit@2.8.0";
import { NextReteNode } from "./node.js";
import _ from "https://esm.sh/lodash";

class FlowInput extends LitElement {
    static properties = {
        components: { type: Array },
        dragOver: { type: Boolean },
        mergedSchema: { type: Object }, // New property to store the merged schema
    };

    static ports = ["output"];

    static styles = css`
        :host {
            display: block;
            padding: 16px;
            border: 2px dashed #ccc;
            text-align: center;
        }
        :host(.drag-over) {
            border-color: #000;
        }
        .drag-over {
            border-color: #000;
        }
        ul {
            list-style-type: none;
            padding: 0;
        }
        li {
            margin: 10px 0;
            padding: 10px;
            border: 1px solid #ccc;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        button {
            border: none;
            background: none;
            color: red;
            cursor: pointer;
        }
    `;

    constructor() {
        super();
        this.components = [];
        this.dragOver = false;
        this.output = {
            components: [],
            mergedSchema: {},
        };
    }

    handleDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        const componentName = event.dataTransfer.getData("text/plain");
        if (componentName) {
            const Component = NextReteNode.components.get(componentName);

            this.output = {
                ...this.output,
                components: [...this.components, componentName],
            };

            // If the component has an outputSchema, merge it with the current mergedSchema
            if (Component.outputSchema) {
                this.output = {
                    ...this.output,
                    mergedSchema: _.merge(
                        ...[
                            {},
                            ...this.output.components?.map(
                                (component) =>
                                    NextReteNode.components.get(component)
                                        .outputSchema
                            ),
                        ]
                    ),
                };
            }
        }
        this.dragOver = false;
    }
    handleDragOver(event) {
        event.preventDefault();
        event.stopPropagation();
        this.dragOver = true;
    }

    handleDragLeave(event) {
        event.preventDefault();
        event.stopPropagation();
        this.dragOver = false;
    }

    removeComponent(index) {
        this.output = {
            ...this.output,
            components: this.output.components.filter((_, i) => i !== index),
            mergedSchema: _.merge(
                ...[
                    {},
                    ...this.output.components
                        .filter((_, i) => i !== index)
                        .map(
                            (component) =>
                                NextReteNode.components.get(component)
                                    .outputSchema
                        ),
                ]
            ),
        };
    }

    render() {
        if (!this.output) {
            return html``;
        }
        return html`
            <div
                class=${this.dragOver ? "drag-over" : ""}
                @drop=${this.handleDrop}
                @dragover=${this.handleDragOver}
                @dragleave=${this.handleDragLeave}>
                Drop your components here
                <ul>
                    ${this.output.components?.map(
                        (component, index) => html`
                            <li>
                                <span>${component}</span>
                                <button
                                    @click=${() => this.removeComponent(index)}>
                                    x
                                </button>
                            </li>
                        `
                    )}
                </ul>
            </div>
            ${this.output.mergedSchema
                ? html`<bespeak-form
                      .props=${{
                          schema: this.output.mergedSchema,
                          formData: this.output,
                      }}
                      .onChange=${(e) => {
                          this.output = {
                              ...this.output,
                              ...e.formData,
                          };
                      }}></bespeak-form>`
                : ""}
        `;
    }
}

export default FlowInput;

// leave this here for now
export async function quine() {
    const response = await fetch(import.meta.url);
    const source = await response.text();
    return source;
}
