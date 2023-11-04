import BespeakComponent from "./component.js";
import { hashObject } from "./util.js";
import * as yaml from "https://esm.sh/js-yaml";
import SubFlow from "./subflow.js";

export default class Adapter extends BespeakComponent {
    static adapterStore = localForage.createInstance({
        name: "bespeak-adapterStore",
    });

    static modules = new Map();

    get inputSchema() {
        return Array.from(this.pipedFrom).map((node) => node.outputSchema);
    }

    get outputSchema() {
        if (!this.pipedTo.size === 0) {
            return null;
        }

        if (
            Array.from(this.pipedTo).some((node) => !(node instanceof Adapter))
        ) {
            return this.inputSchema;
        }

        return Array.from(this.pipedTo)
            .map((node) => node.inputSchema)
            .pop();
    }

    get configSchema() {}

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

    async _process(input, config) {
        if (Array.isArray(this.outputSchema)) {
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

        const module = Adapter.modules.get(processorHash);

        if (!module) {
            module = await this.createAdapter(config);
        }

        return await module.default(input);
    }

    async createAdapter(config) {
        const inputSchema = this.inputSchema;
        const outputSchema = this.outputSchema;

        let message = `# Input Schemas:\n\n`;
        for (const schema of inputSchema) {
            message += `\`\`\`${
                config.format === "yaml"
                    ? `yaml\n${yaml.dump(schema)}\n`
                    : `json\n${JSON.stringify(schema, null, 2)}\n`
            }\`\`\`\n\n`;
        }

        message += `# Output Schema:\n\n`;
        message += `\`\`\`${
            config.format === "yaml"
                ? `yaml\n${yaml.dump(outputSchema)}\n\`\`\``
                : `json\n${JSON.stringify(outputSchema, null, 2)}\n`
        }\`\`\`\n\n`;

        // TODO: change this to schemas directly when we have proper prompt templating

        const [
            {
                value: { response: source },
            },
        ] = await this.subflow.call({
            input: [
                { value: { threads: [[{ role: "user", content: message }]] } },
            ],
        });

        const blob = new Blob([source], { type: "text/javascript" });
        const url = URL.createObjectURL(blob);
        const module = await import(url);
        Adapter.modules.set(key, module);

        return module;
    }
}

(async () => {
    const keys = Adapter.adapterStore.keys();

    for (const key of keys) {
        const source = await Adapter.adapterStore.getItem(key);
        const blob = new Blob([source], { type: "text/javascript" });
        const url = URL.createObjectURL(blob);
        const module = await import(url);
        Adapter.modules.set(key, module);
    }
})();
