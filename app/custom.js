import { LitElement, html, css } from "https://esm.sh/lit@2.8.0";
import { ComponentMixin } from "./component.old.js";
import * as monaco from "https://esm.sh/monaco-editor";
import { monacoStyles } from "./monaco-styles.js";
import { ReteNode } from "./node.js";
import Swal from "https://esm.sh/sweetalert2";
import { Types } from "./types.js";
import { withLatestFrom, map } from "https://esm.sh/rxjs";
export const COMPONENT = {
    label: "Component",
    type: "component",
    schema: {
        type: "object",
        properties: {
            source: {
                type: "string",
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

function transformSource(source) {
    const baseUrl = new URL(".", import.meta.url).href;
    return source.replace(
        /import\s+(.*?)?\s+from\s+['"](.*?)['"]/g,
        (match, importList, importPath) => {
            if (importPath.startsWith(".")) {
                const absoluteUrl = new URL(importPath, baseUrl).href;
                if (importList) {
                    return `import ${importList} from "${absoluteUrl}"`;
                } else {
                    return `import "${absoluteUrl}"`;
                }
            }
            return match;
        }
    );
}
export const OVERWRITE_OPTIONS = {
    label: "Overwrite Options",
    type: "overwrite_options",
    schema: {
        type: "object",
        properties: {
            overwrite: {
                type: "boolean",
            },
        },
    },
};
class Custom extends LitElement {
    static get properties() {
        return {
            component_input: { type: COMPONENT },
            overwrite_input: { type: OVERWRITE_OPTIONS },
        };
    }

    constructor() {
        super();
        this.customElementVersion = 0;
    }

    async connectedCallback() {
        super.connectedCallback();
        await this.updateComplete;
        if (!this.editor) {
            await this.initEditor();
        }
        if (this.customElement && !this.customNode) {
            this.attach();
            if (this.customElement?.quine) {
                this.editor.setValue((await this.customElement?.quine()) || "");
            }
        }

        this.__propagationException = this.shadowRoot.querySelector("#editor");
    }

    async updated(changedProperties) {
        if (
            changedProperties.has("component_input") &&
            this.editor &&
            this.component_input.source &&
            this.component_input.source !== (await this.customElement?.quine())
        ) {
            this.editor.setValue(this.component_input?.source || "");
            this.deploy();
        } else if (changedProperties.has("customElement")) {
            this.attach();
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
                alwaysConsumeMouseWheel: true,
            },
            fontLigatures: true,
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            wrappingStrategy: "advanced",
            cursorSmoothCaretAnimation: "on",
        });
    }

    deploy() {
        const transformedSource = transformSource(this.component_input.source);
        const blob = new Blob([transformedSource], {
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

            try {
                this.customElement = ComponentMixin(
                    module.default,
                    undefined,
                    module.quine,
                    false,
                    this._node.id
                );
                this.customElementVersion++;
                customElements.define(
                    `bespeak-custom-${this.customElement.tagName}-${this._node.id}-${this.customElementVersion}`,
                    this.customElement
                );

                try {
                    ReteNode.registerComponent(this.customElement);
                    this.attach();
                } catch (e) {
                    if (e.message.startsWith("You cannot")) {
                        if (!this.isFromCache) {
                            Swal.fire({
                                title: "Cannot Overwrite Built-In Node",
                                text: e.message,
                                icon: "warning",
                                showConfirmButton: true,
                                confirmButtonText: "OK",
                            }).then(() => {
                                this.toggleIcon?.();
                            });
                        } else {
                            this.attach();
                        }
                    } else if (this.overwrite_input?.overwrite) {
                        try {
                            ReteNode.registerComponent(
                                this.customElement,
                                true
                            );
                            this.attach();
                        } catch (e) {
                            Swal.fire({
                                title: "Cannot Overwrite Built-In Node",
                                text: e.message,
                                icon: "warning",
                                showConfirmButton: true,
                                confirmButtonText: "OK",
                            }).then(() => {
                                this.toggleIcon?.();
                            });
                        }
                    } else {
                        if (!this.isFromCache) {
                            Swal.fire({
                                title: "A node with this name already exists",
                                text: e.message,
                                icon: "warning",
                                showCancelButton: true,
                                confirmButtonText: "Yes, overwrite it!",
                                cancelButtonText: "No, keep it",
                                input: "checkbox",
                                inputValue: this.overwrite_input?.overwrite,
                                inputPlaceholder:
                                    "Don't ask me again for this node",
                            }).then((result) => {
                                if (result.isConfirmed) {
                                    this.overwrite_input = {
                                        overwrite: !!result.value,
                                    };
                                    ReteNode.registerComponent(
                                        this.customElement,
                                        true
                                    );
                                    this.attach();
                                } else {
                                    this.toggleIcon?.();
                                }
                            });
                        } else {
                            this.attach();
                        }
                    }
                }
            } catch (e) {
                Swal.fire({
                    title: "Error",
                    text: e.message + e.stack,
                    icon: "warning",
                    showConfirmButton: true,
                    confirmButtonText: "OK",
                }).then(() => {
                    this.toggleIcon?.();
                });
            }
        });
    }

    attach() {
        this.customNode = ReteNode.deserialize(
            this._node.ide,
            this._node.editor,
            {
                Component: this.customElement,
                id: this._node.id,
            }
        );
        this.customNode.component.toggleIcon = this.toggleIcon.bind(this);
        this._node.inputs$.subscribe(this.customNode.inputs$);
        this.customNode.outputs$.subscribe(this._node.outputs$);
        this.customNode.parameters$
            .pipe(
                withLatestFrom(this._node.parameters$),
                map(([customNodeParams, existsParams]) => {
                    return [
                        ...existsParams.filter((p) => p.node === this._node),
                        ...customNodeParams,
                    ];
                })
            )
            .subscribe(this._node.parameters$);
        this.replaceChildren(this.customNode.component);
    }

    render() {
        return html`
            <div class="flip-card">
                <div class="flip-card-inner">
                    <div class="flip-card-front">
                        <slot></slot>
                    </div>
                    <div class="flip-card-back">
                        <div id="editor"></div>
                        <button
                            @click="${() => {
                                this.component_input = {
                                    source: this.editor.getValue(),
                                };
                                this.toggleIcon?.();
                            }}">
                            Save
                        </button>
                    </div>
                </div>
            </div>
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
        /* Add these styles for the flip card effect */
        .flip-card {
            perspective: 1000px;
        }
        .flip-card-inner {
            display: flex;
            flex-direction: column;
            width: 100%;
            height: 100%;
            transform-style: preserve-3d;
        }
        :host([iconvisible]) .flip-card-front {
            height: 0;
            overflow: hidden;
            transition: none;
        }
        :host([iconvisible]) .flip-card-back {
            height: 100%;
            transition: height 0.8s;
        }

        .flip-card-front {
            height: 100%;
            transition: height 0.8s;
        }

        .flip-card-front,
        .flip-card-back {
            width: 100%;
            overflow: hidden;
        }
        .flip-card-back {
            height: 0;
            transform: rotateY(180deg);
            /* Style for the back of the node goes here */
        }
        ${monacoStyles}
    `;
}
export const CustomWrapped = ComponentMixin(Custom, undefined, async () => {
    return `import { LitElement, html, css } from "https://esm.sh/lit@2.8.0";
import { Types } from "./types.js";
const CUSTOM_TYPE = {
    label: "Example",
    type: "example",
    schema: {
        type: "object",
        properties: {
            text: {
                type: "string",
            },
            number: {
                type: "number",
            },
        },
    },
},
export default class ExampleComponent extends LitElement {
    static get properties() {
        return {
            example_input: { type: Types.get("example") },
            example_output: { type: CUSTOM_TYPE },
        };
    }

    connectedCallback() {
        super.connectedCallback();
        // all this component does is open the src editor so you can change it.
        this.toggleSrc();
    }

    toggleSrc() {
        // Your implementation here
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has("example_input")) {
            this.updateExampleOutput();
        }
    }

    updateExampleOutput() {
        // Your implementation here
    }

    static styles = css\`
        :host {
            display: block;
        }
    \`;

    render() {
        return html\`
            <div>
                <!-- Your HTML here -->
            </div>
        \`;
    }
};
    
// leave this here for now
export async function quine() {
    const response = await fetch(import.meta.url);
    const source = await response.text();
    return source;
}`;
});
customElements.define("bespeak-custom-node", CustomWrapped);

export { CustomWrapped as Custom };

export default Custom;
