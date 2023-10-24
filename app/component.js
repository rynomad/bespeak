import { LitElement, html } from "lit-element";
import Ajv from "https://esm.sh/ajv@8.6.3";
import { addDefaultValuesToSchema } from "./util.js";

export default class BespeakComponent extends LitElement {
    static get properties() {
        return {
            input: { type: Object },
            output: { type: Object },
            config: { type: Object },
            keys: { type: Object },
            error: { type: Object },
        };
    }

    piped = new Set();
    used = new Set();

    get keysSchema() {
        return this.constructor.keys || null;
    }

    get configSchema() {
        return this.constructor.config || null;
    }

    get inputSchema() {
        return this.constructor.input || null;
    }

    get outputSchema() {
        return this.constructor.output || null;
    }

    get apiSchema() {
        return this.constructor.api || null;
    }

    get description() {
        return this.constructor.description || null;
    }

    get name() {
        const baseName = this.constructor.toString().match(/\w+/g)[1];

        return baseName !== "extends" ? baseName : "anonymous";
    }

    get title() {
        const words = this.name.split(
            /(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/
        );

        const titleCaseName = words
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");

        return titleCaseName;
    }

    async updated(changedProperties) {
        if (
            changedProperties.has("input") ||
            changedProperties.has("config") ||
            changedProperties.has("keys")
        ) {
            this.output = await this.process();
        }

        if (changedProperties.has("output")) {
            this.dispatch();
        }

        if (changedProperties.has("error")) {
            this.onError();
        }
    }

    async call(parameters) {
        parameters = this._validate(parameters, this.apiSchema);
        return this._api(parameters).catch((e) => {
            this.error = e;
        });
    }

    async _call() {
        console.warn("API not implemented for", this.name);
    }

    async process(force = false) {
        if (force || (await this.shouldProcess())) {
            try {
                const input = this._validate(this.input, this.inputSchema);
                const config = this._validate(this.config, this.configSchema);
                const keys = this._validate(this.keys, this.keysSchema);

                return this._process(input, config, keys).catch((e) => {
                    this.error = e;
                });
            } catch (e) {
                console.warn("failed to validate process", e);
            }
        }
    }

    async _process() {
        console.warn("process not implemented for", this.name);
    }

    _validate(data, schema) {
        if (!schema) {
            return data;
        }

        const ajv = new Ajv({
            useDefaults: true,
            additonalProperties: true,
            strict: false,
        });
        const validate = ajv.compile(schema);
        const valid = validate(data);

        if (!valid) {
            console.error(validate.errors);
            throw new Error("Invalid data");
        }

        return data;
    }
}
