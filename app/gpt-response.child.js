// bespeak/app/gpt-response.js
import { html, css } from "https://esm.sh/lit@2.8.0";
import BespeakComponent from "./component.js";
import { PAYLOAD } from "./types/gpt.js";

export default class GPTRender extends BespeakComponent {
    static output = PAYLOAD;

    static styles = css`
        :host {
            display: block;
            color: var(--my-element-text-color, black);
        }
    `;

    get outputMessages() {
        return this.output
            .filter(
                (output) =>
                    output.schema.title === "GPT" && output.value.threads.length
            )
            .map((output) => output.threads)
            .flat()
            .map((thread) => thread[thread.length - 1]);
    }

    get outputResponse() {
        return this.output.find(
            (output) => output.schema.title === "GPT" && output.value.response
        )?.value?.response;
    }

    render() {
        const outputMessages = this.outputMessages;
        return html`
            <bespeak-stream-renderer
                .content=${this.outputResponse}></bespeak-stream-renderer>
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
