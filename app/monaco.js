import { LitElement, html, css } from "https://esm.sh/lit";
import * as monaco from "https://esm.sh/monaco-editor";
import { monacoStyles } from "./monaco-styles.js";

class MonacoEditor extends LitElement {
    static get properties() {
        return {
            value: { type: String },
            visible: { type: Boolean },
        };
    }

    constructor() {
        super();
        this.value = "";
    }

    async connectedCallback() {
        super.connectedCallback();
        await this.updateComplete;
        if (!this.editor) {
            await this.initEditor();
        }
    }

    updated(changedProperties) {
        if (this.visible) {
            this.shadowRoot.getElementById("editor").classList.remove("hidden");
        } else {
            this.shadowRoot.getElementById("editor").classList.add("hidden");
        }

        if (changedProperties.has("value") && this.value) {
            this.editor?.setValue(this.value);
        }
    }

    getValue() {
        return this.editor.getValue();
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

        // prevent rete from handling pointerdown events
        container.addEventListener("pointerdown", (e) => {
            if (this.visible) {
                e.stopPropagation();
            }
        });
    }

    render() {
        return html` <div id="editor"></div> `;
    }

    static styles = css`
        :host {
            display: block;
            min-height: 500px;
            min-width: 800px;
        }
        #editor {
            min-height: 500px;
            min-width: 800px;
            border: 1px solid black;
        }

        #editor.hidden {
            display: none;
        }
        ${monacoStyles}
    `;
}

customElements.define("bespeak-monaco-editor", MonacoEditor);

export default MonacoEditor;
