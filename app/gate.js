import { LitElement, html, css } from "https://esm.sh/lit";
import BespeakComponent from "./component.js";

class Gate extends BespeakComponent {
    static config = {
        type: "object",
        properties: {
            stop: {
                type: "boolean",
                default: true,
                description:
                    "Stop propagation always? This takes precedent over expression",
            },
            expression: {
                type: "string",
                default: "true;",
                description:
                    "A javascript expression which has access to `input` and returns true or false whether to propagate the value.",
            },
        },
    };

    icon = "hand";

    async _process(input, config, keys) {
        if (config.stop) {
            return [];
        }

        const fn = new Function("input", "return " + config.expression);

        const result = fn(input);

        if (result) {
            return input;
        }

        return [];
    }
}

export default Gate;
