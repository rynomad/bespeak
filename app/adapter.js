import BespeakComponent from "./component.js";
import { hashObject } from "./util.js";
import * as yaml from "https://esm.sh/js-yaml";
import SubFlow from "./subflow.js";
import localForage from "https://esm.sh/localforage";
import { combineLatest, map } from "https://esm.sh/rxjs";
import { extractCodeBlocks } from "./util.js";
export default class Adapter extends BespeakComponent {
    static adapterStore = localForage.createInstance({
        name: "bespeak-adapterStore",
    });

    static modules = new Map();
    static config = {
        type: "object",
        properties: {
            subflow: {
                type: "string",
                title: "Subflow",
                description: "The subflow to use to create the adapter",
            },
            format: {
                type: "string",
                title: "Format",
                description: "The format to use",
                enum: ["yaml", "json"],
                default: "yaml",
            },
        },
    };

    get inputSchema() {
        if (!this.pipedFrom?.size) {
            return null;
        }
        return {
            type: "array",
            items: Array.from(this.pipedFrom).map((node) => ({
                type: "object",
                properties: {
                    schema: {
                        $ref: "http://json-schema.org/draft-07/schema#",
                        description: "The literal schema for the value",
                    },
                    value: node.outputSchema,
                },
            })),
        };
    }

    get outputSchema() {
        if (!this.pipedTo?.size) {
            return null;
        }

        if (Array.from(this.pipedTo).some((node) => node instanceof Adapter)) {
            return this.inputSchema;
        }

        if (Array.from(this.pipedTo).every((node) => !node.inputSchema)) {
            return null;
        }

        return {
            type: "array",
            items: Array.from(this.pipedTo)
                .map((node) => ({
                    type: "object",
                    properties: {
                        schema: {
                            $ref: "http://json-schema.org/draft-07/schema#",
                            description: "The literal schema for the value",
                        },
                        value: node.inputSchema,
                    },
                }))
                .pop(),
        };
    }

    get adapterFlow() {
        return new SubFlow(this.reteId);
    }

    onPipe(changedProperties) {
        if (this.pipeSubscription) {
            this.pipeSubscription.unsubscribe();
        }

        this.pipeSubscription = combineLatest(
            Array.from(this.pipedFrom).map((component) => component.output$)
        ).subscribe((outputs) => {
            this.input = outputs.flat();
        });

        if (this.pipedFrom.size == 0) {
            this.input = [];
        }
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has("config") && this.config) {
            if (
                this.config.subflow !== changedProperties.get("config")?.subflow
            ) {
                this.subflow = new SubFlow(this.reteId);
                this.subflow.ide = this.ide;
                this.subflow.config = {
                    workspace: this.config.subflow,
                };
            }
        }

        if (changedProperties.has("ide")) {
            this.ide.workspaces$
                .pipe(
                    map((workspaces) =>
                        workspaces.filter(({ nodes }) =>
                            nodes.some((node) =>
                                [
                                    "flow-input",
                                    "flow-output",
                                    "flow-owners",
                                    "flow-assets",
                                ].some((name) => name === node.key)
                            )
                        )
                    )
                )
                .subscribe((workspaces) => {
                    this.constructor.config = {
                        ...this.constructor.config,
                        properties: {
                            ...this.constructor.config.properties,
                            subflow: {
                                ...this.constructor.config.properties.subflow,
                                oneOf: workspaces.map(({ id, name }) => ({
                                    title: name,
                                    const: id,
                                })),
                            },
                        },
                    };

                    this.requestUpdate();
                });
        }
    }

    async _process(input, config) {
        if (Array.isArray(this.outputSchema) || !this.outputSchema) {
            // we're just a passthrough;
            return input;
        }

        const inputSchema = this.inputSchema;
        const outputSchema = this.outputSchema;

        const processorHash = await hashObject({
            inputSchema,
            outputSchema,
            config,
        });

        const module =
            Adapter.modules.get(processorHash) ||
            (await this.createAdapter(config));

        if (!module) {
            return;
        }

        return await module.default(input);
    }

    async createAdapter(config) {
        const inputSchema = this.inputSchema;
        const outputSchema = this.outputSchema;

        if (!inputSchema || !outputSchema) {
            return;
        }

        let message = `# Input Schemas:\n\n`;
        for (const item of inputSchema.items) {
            const schema = item.properties.schema;
            message += `\`\`\`${
                config.format === "yaml"
                    ? `yaml\n${yaml.dump(schema)}\n`
                    : `json\n${JSON.stringify(schema, null, 2)}\n`
            }\`\`\`\n\n`;
        }

        message += `# Output Schema:\n\n`;
        const outputSchemaItem = outputSchema.items;
        message += `\`\`\`${
            config.format === "yaml"
                ? `yaml\n${yaml.dump(outputSchemaItem)}\n\`\`\``
                : `json\n${JSON.stringify(outputSchemaItem, null, 2)}\n`
        }\`\`\`\n\n`;

        // TODO: change this to schemas directly when we have proper prompt templating

        const [
            {
                value: { response },
            },
        ] = await this.subflow.call({
            input: [
                { value: { threads: [[{ role: "user", content: message }]] } },
            ],
            config: {
                workspace: this.config.subflow,
            },
        });

        const source = extractCodeBlocks(response).pop();

        const blob = new Blob([source], { type: "text/javascript" });
        const url = URL.createObjectURL(blob);
        const module = await import(url);
        Adapter.modules.set(key, module);

        return module;
    }
}

(async () => {
    const keys = await Adapter.adapterStore.keys();

    for (const key of keys) {
        const source = await Adapter.adapterStore.getItem(key);
        const blob = new Blob([source], { type: "text/javascript" });
        const url = URL.createObjectURL(blob);
        const module = await import(url);
        Adapter.modules.set(key, module);
    }
})();

if (!customElements.get("bespeak-adapter-hard-code")) {
    customElements.define("bespeak-adapter-hard-code", Adapter);
}
