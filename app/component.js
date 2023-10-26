import { LitElement, html, css } from "https://esm.sh/lit";
import {
    validateAgainstSchema,
    hashObject,
    getDefaultValue,
    generateSchemaFromValue,
} from "./util.js";
import { v4 as uuid } from "https://esm.sh/uuid";
import { ReplaySubject, combineLatest } from "https://esm.sh/rxjs";
import { PropagationStopper } from "./mixins.js";
import localForage from "https://esm.sh/localforage";
export default class BespeakComponent extends PropagationStopper(LitElement) {
    static get properties() {
        return {
            input: { type: Object },
            output: { type: Object },
            config: { type: Object },
            keys: { type: Object },
            error: { type: Object },
            piped: { type: Set },
            processing: { type: Boolean },
        };
    }

    static styles = css``;

    used = new Set();
    processing = false;
    shouldProcessAgain = false;

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

    constructor(id) {
        super();

        this.reteId = id;

        this.cache = localForage.createInstance({
            name: `bespeak-cache-${this.name}-${this.id}`,
        });

        this.output = getDefaultValue(this.outputSchema);
        this.config = getDefaultValue(this.configSchema);
        this.keys = getDefaultValue(this.keysSchema);

        this.output$ = new ReplaySubject(1);
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

        if (changedProperties.has("output")) {
            await this.save();
            this.output$.next({
                name: this.outputName,
                value: this.output,
            });
        }

        if (changedProperties.has("error")) {
            this.onError();
        }

        if (changedProperties.has("piped")) {
            this.onPipe();
        }
    }

    async call(parameters) {
        parameters = validateAgainstSchema(parameters, this.apiSchema);
        return this._call(parameters).catch((e) => {
            this.error = e;
        });
    }

    async _call() {
        console.warn("API not implemented for", this.name);
    }

    async process(force = false) {
        if (this.processing) {
            this.shouldProcessAgain = true;
            return;
        }

        this.processing = true;
        let output = this.output;
        try {
            const input = validateAgainstSchema(this.input, this.inputSchema);
            const config = validateAgainstSchema(
                this.config,
                this.configSchema
            );
            const keys = validateAgainstSchema(this.keys, this.keysSchema);

            const cachedOutput = await this.cache.getItem(
                await hashObject([input, config])
            );

            if (!force && cachedOutput) {
                return cachedOutput;
            }

            output = await this._process(input, config, keys).catch((e) => {
                this.error = e;
                return null;
            });
        } catch (e) {
            console.warn("failed to validate process", e);
        } finally {
            this.processing = false;
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
        return this.input;
    }

    async save() {
        if (this.output) {
            await this.cache.setItem("output", this.output);
            await this.cache.setItem(
                await hashObject([
                    validateAgainstSchema(this.input, this.inputSchema),
                    validateAgainstSchema(this.config, this.configSchema),
                ]),
                this.output
            );
        }

        if (this.config) {
            await this.cache.setItem("config", this.config);
        }
    }

    async load() {
        this.output = await this.cache.getItem("output");
        this.config = await this.cache.getItem("config");
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
            this.input = outputs.reduce((input, output) => {
                const [name, value] = output;
                if (input[name]) {
                    input[name].add(value);
                } else {
                    input[name] = new Set([value]);
                }
            }, {});
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
