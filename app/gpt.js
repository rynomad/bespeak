import { LitElement, html, css } from "https://esm.sh/lit@2.8.0";
import { CONFIG, API_KEY } from "./types/gpt.js";
import { deepEqual } from "https://esm.sh/fast-equals";
export default class GPTCall extends LitElement {
    static reactivePaths = ["$.input.messages", "$.keys.apiKey"];
    static config = CONFIG.schema;
    static keys = API_KEY.schema;
    static outputSchema = {
        type: "object",
        title: "GPT Messages",
        properties: {
            response: { type: "string" },
            messages: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        role: { type: "string" },
                        content: { type: "string" },
                    },
                    required: ["role", "content"],
                },
            },
        },
        required: ["prompt", "response", "messages"],
    };

    static get properties() {
        return {
            response: { type: String },
            callInProgress: { type: Boolean },
        };
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        if (
            this.input.messages?.length &&
            !deepEqual(
                this.input.messages,
                this.output?.messages?.slice(0, -1)
            ) &&
            this.input.messages.find((message) => message.role === "user")
        ) {
            console.log(
                this.input.messages,
                this.output?.messages?.slice(0, -1)
            );
            this.callOpenAI();
        }
    }

    connectedCallback() {
        super.connectedCallback();
        this.start = Date.now();
    }

    async callOpenAI() {
        this.callInProgress = true;

        const {
            config,
            keys: { apiKey },
            input,
        } = this;
        const messages = (input.messages || [])
            .map((message) =>
                !Array.isArray(message) || config.chooser === "all"
                    ? message
                    : message[0]
            )
            .flat();

        if (!messages.length) {
            this.callInProgress = false;
            return;
        }

        const _messages = await this.gpt(
            apiKey,
            {
                ...config,
                messages,
            },
            (response) => {
                this.output = {
                    ...this.output,
                    response,
                };
            }
        );
        this.output = {
            ...this.output,
            messages: _messages,
        };

        this.callInProgress = false;
        if (this.callPending) {
            this.callPending = false;
            this.callOpenAI();
        }
    }

    static styles = css`
        :host {
            display: block;
        }
    `;

    handleMessage({ content }) {
        this.output = {
            ...this.output,
            prompt: {
                role: this.config.role || "user",
                content,
            },
        };
    }

    render() {
        return html`<fa-icon
            .size=${"5rem"}
            .icon=${"openai"}
            .animation=${this.callInProgress ? "spin-y" : ""}></fa-icon>`;
    }
}

// leave this here for now
export async function quine() {
    const response = await fetch(import.meta.url);
    const source = await response.text();
    return source;
}
