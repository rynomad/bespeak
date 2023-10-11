import { LitElement, html, css } from "https://esm.sh/lit";
import { CONFIG, API_KEY } from "./types/gpt.js";

function extractCodeBlocks(text) {
    // The '^' character asserts start of a line due to the 'm' flag
    const regex = /^```(\w*\n)?([\s\S]*?)```/gm;
    let match;
    const codeBlocks = [];

    while ((match = regex.exec(text)) !== null) {
        let language = match[1]?.trim() || "plaintext";
        let codeBlock = match[2];

        // Check if the code block is valid, e.g. not an empty string
        if (codeBlock.trim().length > 0) {
            codeBlocks.push(codeBlock);
        }
    }

    return codeBlocks;
}

export default class NodeMakerGPT extends LitElement {
    static config = CONFIG.schema;
    static keys = API_KEY.schema;
    static get properties() {
        return {
            assets: { type: Array },
            chat: { type: Array },
        };
    }

    static get styles() {
        return css`
            .chat-log {
                display: flex;
                flex-direction: column;
                max-height: 80vh;
                overflow-y: auto;
                padding: 10px;
                border: 1px solid #ccc;
                border-radius: 5px;
            }
            .message {
                margin-bottom: 10px;
                padding: 10px;
                border-radius: 5px;
            }
            .system {
                background-color: #f0f0f0;
                color: #333;
            }
            .user {
                background-color: #d9eefa;
                color: #333;
                align-self: flex-end;
            }
            .assistant {
                background-color: #fff3cd;
                color: #333;
            }
            .loading-spinner {
                display: flex;
                justify-content: center;
                padding: 10px;
            }
        `;
    }

    constructor() {
        super();
        this.chat = [];
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has("assets")) {
            if (this.assets[0]?.prompt?.content) {
                this.start(this.assets[0]?.prompt);
            }
            if (this.assets[0]?.error) {
                this.handleError(this.assets[0]?.error);
            }
        }

        if (
            changedProperties.has("chat") &&
            this.chat.length &&
            this.output?.chat !== this.chat &&
            this.keys.apiKey
        ) {
            this.doChat();
        }
    }

    async doChat() {
        this.chatInProgress = true;
        this.output = {
            chat: (
                await this.gpt(this.keys.apiKey, {
                    ...this.config,
                    messages: this.chat,
                })
            ).flat(),
        };
        this.chat = this.output.chat;
        this.chatInProgress = false;
    }

    /**
     * @param {Object} parameters - The parameters for the function.
     * @description {"name": "stop", "description": "A no-op function.", "parameters": {}}
     */
    stop({}) {}

    /**
     * @param {Object} parameters - The parameters for the function.
     * @description {"name": "build", "description": "Builds a plan based on the provided prompt.", "parameters": {"type": "object", "properties": {"prompt": {"type": "object", "properties": {"role": {"type": "string", "default": "assistant"}, "content": {"type": "string", "default": ""}}}}}}
     */
    build({ role = "assistant", content = "" } = {}) {
        this.setChat({ role, content });
    }

    /**
     * @param {Object} parameters - The parameters for the function.
     * @description {"name": "fix", "description": "Analyzes the cause of an error and plans a fix based on the provided prompt.", "parameters": {"type": "object", "properties": {"prompt": {"type": "object", "properties": {"role": {"type": "string", "default": "assistant"}, "content": {"type": "string", "default": ""}}}}}}
     */
    fix({ role = "assistant", content = "" } = {}) {
        this.setChat({ role, content });
    }

    /**
     * @param {Object} parameters - The parameters for the function.
     * @description {"name": "change", "description": "Analyzes how the code may be changed to fulfill the user's modified intent and plans the changes based on the provided prompt.", "parameters": {"type": "object", "properties": {"prompt": {"type": "object", "properties": {"role": {"type": "string", "default": "assistant"}, "content": {"type": "string", "default": ""}}}}}}
     */
    change({ role = "assistant", content = "" } = {}) {
        this.setChat({ role, content });
    }

    start(prompt) {
        if (
            this.prompt.content &&
            this.workingPrompt?.content !== prompt?.content
        ) {
            this.chat = [
                this.prompt,
                {
                    role: "user",
                    content: `# Current Code:\n\n\`\`\`javascript\n${this.assets[0]?.source}\n\`\`\``,
                },
                prompt,
            ];
        } else {
            console.warn("ignoring duplicate prompt");
        }
    }

    handleError(error) {}

    setChat(prompt) {
        this.output.chat = [];
        this.chat = [...this.chat, prompt];
    }

    render() {
        return html`
            <bespeak-form
                .props=${{
                    schema: {
                        type: "object",
                        properties: {
                            role: {
                                type: "string",
                                enum: ["user", "assistant", "system"],
                                default: "system",
                            },
                            content: { type: "string" },
                        },
                    },
                    uiSchema: {
                        content: {
                            "ui:widget": "textarea",
                            rows: 10,
                        },
                    },
                    formData: this.prompt,
                }}
                .onChange=${((e) =>
                    (this.prompt = e.formData.content
                        ? e.formData
                        : this.prompt)).bind(this)}>
            </bespeak-form>
            <div class="chat-log">
                ${this.chat.map(
                    (message) => html`
                        <div class="message ${message.role}">
                            <strong>${message.role}</strong>: ${message.content}
                        </div>
                    `
                )}
                ${this.chatInProgress
                    ? html`
                          <div class="loading-spinner">
                              <div class="spinner"></div>
                          </div>
                      `
                    : ""}
            </div>
        `;
    }
}

// leave this here for now
export async function quine() {
    const response = await fetch(import.meta.url);
    const source = await response.text();
    return source;
}
