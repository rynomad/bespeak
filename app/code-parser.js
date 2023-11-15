import BespeakComponent from "./component.js";
import { html, css } from "https://esm.sh/lit";
import { getMarkdownCodeBlocks, generateSchemaFromValue } from "./util.js";

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
            parse: {
                type: "boolean",
                default: false,
            },
        },
    };

    static output = {
        title: "code",
        type: "string",
    };

    icon = "code";

    get outputSchema() {
        if (this.config?.parse) {
            return generateSchemaFromValue(this.output);
        }
        return this.constructor.output;
    }

    async _process(input, config, keys) {
        const gptInput = input
            .filter((schema) => schema.schema.title === "GPT")
            .map((schema) => schema.value)
            .flat()
            .shift()
            ?.concat?.([])
            ?.pop?.()?.content;

        if (!gptInput) {
            return this.output;
        }

        const codeBlocks = getMarkdownCodeBlocks(gptInput);
        const matchingBlocks = codeBlocks.filter(
            (block) => block.language === config.language
        );

        let codeString = matchingBlocks.pop()?.code || "";

        if (!codeString && config.language === "json") {
            try {
                codeString = JSON.stringify(JSON.parse(gptInput), null, 2);
            } catch (e) {
                return "";
            }
        }

        if (config.language == "json" && config.parse) {
            try {
                const json = JSON.parse(codeString);
                return json;
            } catch (e) {
                return "";
            }
        }

        return codeString;
    }
}
