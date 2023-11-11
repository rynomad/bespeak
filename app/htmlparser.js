import { html, css } from "https://esm.sh/lit@2.8.0";
import { Readability as _Readability } from "https://esm.sh/@mozilla/readability";
import BespeakComponent from "./component.js";

export default class Readability extends BespeakComponent {
    static input = {
        title: "HTML Input",
        description: "The HTML content to be parsed by readability.js",
        type: "string",
        examples: [
            "<html><body><h1>My First Heading</h1><p>My first paragraph.</p></body></html>",
        ],
    };

    static config = {
        title: "Readability Configuration",
        description: "Options and settings for the readability.js parser",
        type: "object",
        properties: {
            maxChars: {
                type: "number",
                description:
                    "the maximum number of characters to return from the parsed content",
                default: false,
            },
            redact: {
                type: "string",
                description:
                    "a comma-separated list of strings to remove from the parsed content",
            },
        },
    };

    static output = {
        title: "Parsed Content",
        description: "The main body of content parsed by readability.js",
        type: "string",
    };

    static styles = css`
        :host {
            display: block;
            padding: 16px;
            color: var(--readability-element-text-color, black);
        }
    `;

    async _process(input, config, keys) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(input, "text/html");
        const reader = new _Readability(doc);
        const article = reader.parse();
        let textContent = article.textContent.substring(
            0,
            config.maxChars || undefined
        );
        if (config.redact) {
            const termsToRedact = config.redact.split(",");
            termsToRedact.forEach((term) => {
                const regex = new RegExp(term, "g");
                textContent = textContent.replace(regex, "[REDACTED]");
            });
        }
        return textContent;
    }

    render() {
        return html`
            <h1>Parsed Content</h1>
            <p>${this.output}</p>
        `;
    }
}
