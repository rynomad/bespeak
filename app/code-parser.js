import BespeakComponent from "./component.js";
import { html, css } from "https://esm.sh/lit";
import { getMarkdownCodeBlocks } from "./util.js";

export default class CodeParser extends BespeakComponent {
    static styles = css`
        :host {
            display: flex;
            flex-direction: column;
        }
        ::slotted(*) {
            width: 100%;
        }
        button {
            margin-top: 1rem;
        }
    `;

    static config = {
        type: "object",
        properties: {
            language: {
                type: "string",
                enum: ["javascript", "json"],
                default: "javascript",
            },
        },
    };

    static output = {
        title: "code",
        type: "string",
    };

    icon = "code";

    async _process(input, config, keys) {
        const gptInput = input
            .find((schema) => schema.schema.title === "GPT")
            .map((schema) => schema.value)
            .shift()
            ?.pop?.()?.content;

        if (!gptInput) {
            return this.output;
        }

        const codeBlocks = getMarkdownCodeBlocks(gptInput);
        const matchingBlocks = codeBlocks.filter(
            (block) => block.language === config.language
        );

        if (matchingBlocks.length === 0) {
            return "";
        }

        return matchingBlocks.pop().code;
    }
}
