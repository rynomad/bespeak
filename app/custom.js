import { LitElement, html, css } from "https://esm.sh/lit";
import { ComponentMixin } from "./component.js";
import * as monaco from "https://esm.sh/monaco-editor";
import { monacoStyles } from "./monaco-styles.js";
import { ChatGPT } from "./gpt.js";
import * as TYPES from "./types/index.js";
import { ReteNode } from "./node.js";

const defaultComponent = `${Object.keys(TYPES).reduce(
    (acc, key) => {
        acc += `export const ${key} = ${JSON.stringify(
            TYPES[key],
            null,
            4
        )};\n`;
        return acc;
    },
    `import { LitElement, html, css } from "https://esm.sh/lit";
import OpenAI from "https://esm.sh/openai";
`
)}
export default ${ChatGPT.toString()}
`;

export const COMPONENT = {
    label: "Component",
    type: "component",
    schema: {
        type: "object",
        properties: {
            source: {
                type: "string",
                default: defaultComponent,
            },
        },
    },
};

export const MODULE = {
    label: "Module",
    type: "module",
    schema: {
        type: "object",
        properties: {
            url: {
                type: "string",
            },
        },
    },
};

export const Custom = ComponentMixin(
    class Custom extends LitElement {
        static get properties() {
            return {
                component: { type: COMPONENT },
            };
        }

        firstUpdated() {
            this.initEditor();
        }

        updated(changedProperties) {
            if (
                changedProperties.has("component") &&
                this.editor &&
                this.component.source
            ) {
                this.editor.setValue(this.component?.source || "");
                this.deploy();
            }
        }

        async initEditor() {
            await this.updateComplete;
            const container = this.shadowRoot.getElementById("editor");
            this.editor = monaco.editor.create(container, {
                language: "javascript",
                "semanticHighlighting.enabled": true,
                automaticLayout: true,
                readOnly: false,
                minimap: {
                    enabled: false,
                    showSlider: "always",
                    autohide: true,
                },
                value: this.value,
                wordWrap: "on",
                renderWhitespace: "boundary",
                bracketPairColorization: {
                    enabled: true,
                },
                scrollbar: {
                    alwaysConsumeMouseWheel: false,
                },
                fontLigatures: true,
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                wrappingStrategy: "advanced",
                cursorSmoothCaretAnimation: "on",
            });
        }

        deploy() {
            const blob = new Blob([this.component.source], {
                type: "text/javascript",
            });
            this.module = {
                url: URL.createObjectURL(blob),
            };

            import(this.module.url).then((module) => {
                this.subscriptions ||= [];
                for (const sub of this.subscriptions) {
                    sub.unsubscribe();
                }
                if (this.customElement) {
                    // unregister the custom element
                    customElements.delete(
                        `bespeak-custom-${this.customElement.tagName}`
                    );
                }

                this.customElement = ComponentMixin(module.default);

                customElements.define(
                    `bespeak-custom-${this.customElement.tagName}`,
                    this.customElement
                );

                this.customNode = ReteNode.deserialize(
                    this._node.ide,
                    this._node.editor,
                    {
                        Component: this.customElement,
                        id: this._node.id,
                    }
                );
                this._node.inputs$.subscribe(this.customNode.inputs$);
                this.customNode.outputs$.subscribe(this._node.outputs$);
                this.customNode.parameters$.subscribe(this._node.parameters$);
                this.replaceChildren(this.customNode.component);
            });
        }

        render() {
            return html`
                <div id="editor"></div>
                <button
                    @click="${() =>
                        (this.component = {
                            source: this.editor.getValue(),
                        })}">
                    Deploy
                </button>
                <slot></slot>
            `;
        }

        static styles = css`
            :host {
                display: block;
            }
            #editor {
                height: 500px;
                border: 1px solid black;
            }
            button {
                margin-top: 10px;
            }

            ${monacoStyles}
        `;
    }
);
customElements.define("bespeak-custom-node", Custom);
