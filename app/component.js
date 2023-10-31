import { LitElement, html, css } from "https://esm.sh/lit";
import {
    validateAgainstSchema,
    hashObject,
    getDefaultValue,
    generateSchemaFromValue,
} from "./util.js";
import { v4 as uuid } from "https://esm.sh/uuid";
import { ReplaySubject, combineLatest, map } from "https://esm.sh/rxjs";
import { PropagationStopper } from "./mixins.js";
import localForage from "https://esm.sh/localforage";
import { deepEqual } from "https://esm.sh/fast-equals";
const hasChanged = (a, b) => !deepEqual(a, b);

export default class BespeakComponent extends PropagationStopper(LitElement) {
    static get properties() {
        return {
            input: { type: Object },
            output: { type: Object, hasChanged },
            config: { type: Object, hasChanged },
            keys: { type: Object, hasChanged },
            error: { type: Object },
            piped: { type: Set },
            processing: { type: Boolean },
        };
    }

    static styles = css``;

    static get name() {
        const baseName = this.toString().match(/\w+/g)[1];

        return baseName !== "extends" ? baseName : "anonymous";
    }

    static get title() {
        const words = this.name.split(
            /(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/
        );

        const titleCaseName = words
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");

        return titleCaseName;
    }

    static get tagName() {
        return this.title.toLowerCase().replace(/\s/g, "-");
    }

    processing = false;
    shouldProcessAgain = false;
    used = new Set();

    get keysSchema() {
        return this.constructor.keys || null;
    }

    get configSchema() {
        const base = this.constructor.config || {
            type: "object",
            properties: {},
        };
        return {
            ...base,
            properties: {
                description: {
                    type: "string",
                    description: "A description of this node.",
                },
                ...base.properties,
            },
        };
    }

    get outputSchema() {
        return this.constructor.output || null;
    }

    get outputName() {
        return this.outputSchema?.title
            ? this.outputSchema.title.toLowerCase().replace(/\s/g, "-")
            : null;
    }

    get apiSchema() {
        return this.constructor.api || null;
    }

    get description() {
        return this.constructor.description || null;
    }

    get name() {
        return this.constructor.name;
    }

    get title() {
        this.constructor.title;
    }

    constructor(id) {
        super();

        this.reteId = id;

        this.cache = localForage.createInstance({
            name: `bespeak-cache-${this.name}-${this.reteId}`,
        });

        this.input = [];
        this.output = getDefaultValue(this.outputSchema);
        this.config = getDefaultValue(this.configSchema);
        this.keys = getDefaultValue(this.keysSchema);

        this.output$ = new ReplaySubject(1);
        this.config$ = new ReplaySubject(1);
        this.load();
    }

    async updated(changedProperties) {
        if (
            changedProperties.has("input") ||
            changedProperties.has("config") ||
            changedProperties.has("keys")
        ) {
            this.output = await this.process();
        }

        if (changedProperties.has("config")) {
            await this.save();
            this.config$.next(this.config);
        }

        if (changedProperties.has("output")) {
            await this.save();
            this.output$.next({
                nodeId: this.reteId,
                nodeName: this.name,
                config: this.config,
                schema: this.outputSchema,
                value: this.output,
            });
        }

        if (changedProperties.has("error")) {
            console.warn("error", this.error);
            this.onError?.();
        }

        if (changedProperties.has("piped")) {
            this.onPipe();
        }

        if (changedProperties.has("processing")) {
            this.requestUpdate();
        }
    }

    async call({ input, config }) {
        try {
            return await this._process(
                input || this.input,
                { ...this.config, ...config },
                this.keys
            );
        } catch (e) {
            console.warn("failed to validate call", e);
        }
    }

    async _call() {
        console.warn("API not implemented for", this.name);
    }

    async process(force = !this.keysSchema) {
        if (this.processing) {
            this.shouldProcessAgain = true;
            return this.output;
        }

        this.processing = true;
        let output = this.output;
        try {
            const { input, config, keys } = this;

            const cachedOutput = await this.cache.getItem(
                await hashObject([input, config])
            );

            if (!force && cachedOutput) {
                output = cachedOutput;
            } else {
                output = await this._process(input, config, keys).catch((e) => {
                    this.error = e;
                    return this.output;
                });
            }
        } catch (e) {
            console.warn("failed to validate process", e);
        } finally {
            this.processing = false;
            this.requestUpdate();
            if (this.shouldProcessAgain) {
                this.shouldProcessAgain = false;
                return this.process(force);
            } else {
                return output;
            }
        }
    }

    async _process() {
        console.warn("process not implemented for", this.name);
        return this.outputSchema ? this.output : this.input;
    }

    async save() {
        if (this.output) {
            await this.cache.setItem("output", this.output);
            await this.cache.setItem(
                await hashObject([this.input, this.config]),
                this.output
            );
        }

        if (!deepEqual(this.config, getDefaultValue(this.configSchema))) {
            await this.cache.setItem("config", this.config);
        }
    }

    async load() {
        this.output =
            (await this.cache.getItem("output")) ||
            getDefaultValue(this.outputSchema);
        this.config =
            (await this.cache.getItem("config")) ||
            getDefaultValue(this.configSchema);
    }

    pipe(component) {
        const old = component.piped || new Set();

        old.add(this);

        component.piped = new Set(old);
    }

    unpipe(component) {
        const old = component.piped || new Set();

        old.delete(this);

        component.piped = new Set(old);
    }

    onPipe() {
        if (this.pipeSubscription) {
            this.pipeSubscription.unsubscribe();
        }

        this.pipeSubscription = combineLatest(
            Array.from(this.piped).map((component) => component.output$)
        ).subscribe((outputs) => {
            this.input = outputs;
        });
    }

    use(component) {
        this.used.add(component);
    }

    unuse(component) {
        this.used.delete(component);
    }

    render() {
        return this.icon
            ? html`
                  <fa-icon
                      .icon=${this.icon}
                      .size=${"5rem"}
                      .animation=${this.processing ? "ripple" : ""}></fa-icon>
              `
            : this.outputSchema
            ? html` <bespeak-form
                  .props=${{
                      schema: this.outputSchema,
                      formData: this.output,
                  }}
                  .onChange=${(e) => {
                      this.output = e.formData;
                  }}></bespeak-form>`
            : html`<yaml-renderer
                  .preamble=${`#${this.title}\n\n${this.description}`}
                  .data=${{
                      input: this.input,
                      config: this.config,
                      output: this.output,
                  }}></yaml-renderer>`;
    }
}
