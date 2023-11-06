import { LitElement, html, css } from "https://esm.sh/lit";
import {
    validateAgainstSchema,
    hashObject,
    getDefaultValue,
    generateSchemaFromValue,
} from "./util.js";
import { v4 as uuid } from "https://esm.sh/uuid";
import {
    ReplaySubject,
    combineLatest,
    debounceTime,
} from "https://esm.sh/rxjs";
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
            pipedTo: { type: Object },
            pipedFrom: { type: Object },
            processing: { type: Boolean },
            ide: { type: Object },
            removed$: { type: Object },
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

    get inputSchema() {
        return this.constructor.input || null;
    }

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

        this.isLoading = true;
        this.input = [];
        this.output = getDefaultValue(this.outputSchema);
        this.config = getDefaultValue(this.configSchema);
        this.keys = getDefaultValue(this.keysSchema);

        this.output$ = new ReplaySubject(1);
        this.config$ = new ReplaySubject(1);
        this.error$ = new ReplaySubject(1);
        this.process$ = new ReplaySubject(1);
        this.back$ = new ReplaySubject(1);

        this.pipedTo = new Set();
        this.pipedFrom = new Set();

        this.process$.pipe(debounceTime(1000)).subscribe(async () => {
            this.output = (await this.process()) || this.output;
            this.requestUpdate();
        });

        this.load().then(() => (this.isLoading = false));
    }

    async load() {
        const output = await this.cache.getItem("output");
        const config = await this.cache.getItem("config");

        if (output) this.output = output;
        if (config) this.config = config;
    }

    async updated(changedProperties) {
        if (
            changedProperties.has("input") ||
            changedProperties.has("config") ||
            changedProperties.has("keys")
        ) {
            this.process$.next();
        }

        if (changedProperties.has("config")) {
            await this.save();
            this.config$.next(this.config);
        }

        if (changedProperties.has("output")) {
            await this.save();
            if (
                Array.isArray(this.output) &&
                this.output.every((e) => e.nodeId)
            ) {
                this.output$.next(this.output);
            } else {
                this.output$.next({
                    nodeId: this.reteId,
                    nodeName: this.name,
                    config: this.config,
                    schema: this.outputSchema,
                    input_schema: this.inputSchema,
                    value: this.output,
                });
            }
        }

        if (changedProperties.has("error")) {
            console.warn("error", this.error);
            this.error$.next(this.error);
        }

        if (
            changedProperties.has("pipedTo") ||
            changedProperties.has("pipedFrom")
        ) {
            this.onPipe();
        }

        if (changedProperties.has("processing")) {
            this.requestUpdate();
        }

        this.back$.next(this.renderBack());
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
                output = await this._process(input, config, keys)
                    .then((r) => r || this.output)
                    .catch((e) => {
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
        if (this.isLoading) return;

        if (
            this.output &&
            !(this.output instanceof Error) &&
            !deepEqual(this.output, getDefaultValue(this.outputSchema))
        ) {
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

    pipe(component) {
        const oldTo = this.pipedTo || new Set();
        oldTo.add(component);
        this.pipedTo = new Set(oldTo);

        const oldFrom = component.pipedFrom || new Set();
        oldFrom.add(this);
        component.pipedFrom = new Set(oldFrom);
    }

    unpipe(component) {
        const old = this.pipedTo || new Set();
        old.delete(component);
        this.pipedTo = new Set(old);

        const oldFrom = component.pipedFrom || new Set();
        oldFrom.delete(this);
        component.pipedFrom = new Set(oldFrom);
    }

    async onPipe() {
        if (this.pipeSubscription) {
            this.pipeSubscription.unsubscribe();
        }

        if (!this.adapter) {
            const { default: Adapter } = await import("./adapter.js");
            this.adapter = new Adapter(this.reteId);
            this.adapter.pipedTo.add(this);
        }

        this.adapter.pipedFrom = this.pipedFrom;

        this.pipeSubscription = combineLatest(
            Array.from(this.pipedFrom).map((component) => component.output$)
        ).subscribe(async (outputs) => {
            outputs = outputs.flat();
            this.input = await this.adapter.call({ input: outputs });
        });

        if (this.pipedFrom.size == 0) {
            this.input = [];
        }
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
                      .size=${"5rem"}
                      .icon=${this.icon}
                      .animation=${this.processing ? "ripple" : ""}></fa-icon>
              `
            : html`<yaml-renderer .data=${this.output}></yaml-renderer>`;
    }

    renderBack() {
        return html`
            ${this.inputSchema
                ? html`<bespeak-form
                      .props=${{
                          schema: this.inputSchema,
                          formData: this.input,
                      }}
                      .onChange=${({ formData }) =>
                          (this.input = formData)}></bespeak-form>`
                : html``}
            ${this.configSchema
                ? html`<bespeak-form
                      .props=${{
                          schema: this.configSchema,
                          formData: this.config,
                      }}
                      .onChange=${({ formData }) =>
                          (this.config = formData)}></bespeak-form>`
                : html``}
        `;
    }
}
