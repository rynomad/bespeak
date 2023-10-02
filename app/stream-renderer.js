import { LitElement, css, html } from "https://esm.sh/lit";
import { filter, switchMap, tap } from "https://esm.sh/rxjs@7.3.0";
import { PropagationStopper } from "./mixins.js";

import { unsafeHTML } from "https://esm.sh/lit/directives/unsafe-html";

import { marked } from "https://esm.sh/marked";
const StreamRenderer = class extends PropagationStopper(LitElement) {
    static styles = css`
        :host {
            display: block;
            // padding: 16px;
            // color: var(--stream-renderer-text-color, black);

            user-select: text;
            cursor: text;
            // display: block;
            background-color: #f5f5f5;
            border-radius: 10px;
            box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.1);
            margin: 15px;
            // margin: 15px;
            // padding: 15px;
            // max-width: 80vw;
            // cursor: auto;
        }

        .content {
            color: var(--stream-renderer-text-color, black);
        }

        // p:last-of-type {
        //     margin-bottom: -45px;
        // }

        // p:first-of-type {
        //     margin-top: -25px;
        // }
        .content.show {
            padding: 15px;
            // white-space: pre-wrap;
            user-select: text;
        }
    `;

    static properties = {
        subject: { type: Object },
        content: { type: String },
    };

    constructor() {
        super();
        this.renderContent = this.renderContent.bind(this);
    }

    updated(changedProperties) {
        if (changedProperties.has("subject")) {
            this.subscription?.unsubscribe();
            this.subscription = this.subject
                .pipe(
                    filter((e) => e),
                    switchMap((content) => {
                        if (typeof content === "string") {
                            return Promise.resolve(content);
                        } else return content;
                    }),
                    tap(this.renderContent.bind(this))
                )
                .subscribe();
        } else if (changedProperties.has("content")) {
            this.renderContent(this.content);
        }
    }

    renderContent(content) {
        this.html = content ? marked(content.trim()) : "";
        this.requestUpdate();
    }

    render() {
        return html`<div class="content ${this.html ? "show" : "hide"}">
            ${unsafeHTML(this.html)}
        </div> `;
    }
};

customElements.define("bespeak-stream-renderer", StreamRenderer);
export default 42;
