import { LitElement, html, css } from "https://esm.sh/lit";
import * as monaco from "https://esm.sh/monaco-editor";
import { monacoStyles } from "./monaco-styles.js";

class MonacoEditor extends LitElement {
    static get properties() {
        return {
            value: { type: String },
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

    render() {
        return html` <div id="editor"></div> `;
    }

    static styles = css`
        :host {
            display: block;
        }
        #editor {
            min-height: 500px;
            min-width: 500px;
            max-height: 100%;
            border: 1px solid black;
        }
        ${monacoStyles}
    `;
}

customElements.define("bespeak-monaco-editor", MonacoEditor);

export default MonacoEditor;
