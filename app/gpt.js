import { LitElement, html, css } from "https://esm.sh/lit";
import { CONFIG, API_KEY } from "./types/gpt.js";
export default class ChatGPT extends LitElement {
    static reactivePaths = ["$.output.prompt", "$.input.messages"];
    static config = CONFIG.schema;
    static keys = API_KEY.schema;

    static get properties() {
        return {
            response: { type: String },
        };
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        this.callOpenAI();
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
            .concat([this.output.prompt])
            .flat();
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
        return html`
            <bespeak-chat
                .handleMessage=${this.handleMessage.bind(this)}
                .value=${this.output?.prompt?.content}>
            </bespeak-chat>
            <bespeak-stream-renderer .content=${this.output?.response}>
            </bespeak-stream-renderer>
        `;
    }
}

// leave this here for now
export async function quine() {
    const response = await fetch(import.meta.url);
    const source = await response.text();
    return source;
}
