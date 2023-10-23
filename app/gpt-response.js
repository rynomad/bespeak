// bespeak/app/gpt-response.js
import { LitElement, html, css } from "https://esm.sh/lit@2.8.0";

export default class GPTRender extends LitElement {
    static properties = {
        input: { type: Object },
        output: { type: Object },
    };

    static outputSchema = {
        type: "object",
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
                },
            },
        },
    };

    static styles = css`
        :host {
            display: block;
            color: var(--my-element-text-color, black);
        }
    `;

    constructor() {
        super();
        this.input = {};
        this.output = {
            response: "",
        };
    }

    updated(changedProperties) {
        if (changedProperties.has("input")) {
            this.output = {
                ...this.output,
                response: this.input.response,
                messages: this.input.messages,
            };
        }
    }

    render() {
        const outputMessages =
            this.output.messages?.[this.output.messages?.length - 1].slice(1);
        return html`
            <bespeak-stream-renderer
                .content=${this.output.response}></bespeak-stream-renderer>
            ${outputMessages && outputMessages.length > 0
                ? html`
                      <details>
                          <summary>All Messages</summary>
                          ${outputMessages.map(
                              (message) =>
                                  html`
                                      <div style="margin: 10px 0;">
                                          <bespeak-stream-renderer
                                              .content=${message.content}></bespeak-stream-renderer>
                                      </div>
                                  `
                          )}
                      </details>
                  `
                : ""}
        `;
    }
}

// leave this here for now
export async function quine() {
    const response = await fetch(import.meta.url);
    const source = await response.text();
    return source;
}
