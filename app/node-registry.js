import BespeakComponent from "./component.js";
import Swal from "https://esm.sh/sweetalert2";
import localForage from "https://esm.sh/localforage";
import { baseUrl as _baseUrl } from "./util.js";

String.prototype.replaceAsync = async function (regexp, replacer) {
    const matches = Array.from(this.matchAll(regexp));
    let lastIndex = 0;
    let result = "";

    for (const match of matches) {
        result += this.slice(lastIndex, match.index);
        result += await replacer(...match);
        lastIndex = match.index + match[0].length;
    }

    result += this.slice(lastIndex);
    return result;
};

export default class NodeRegistry extends BespeakComponent {
    static force = true;
    static config = {
        type: "object",
        properties: {
            overwrite: {
                type: "string",
                enum: ["always", "ask", "never"],
                default: "ask",
            },
        },
    };
    static input = {
        type: "object",
        properties: {
            source: { type: "string" },
        },
    };
    static output = {
        type: "array",
        items: {
            type: "object",
            properties: {
                file: { type: "string" },
                source: { type: "string" },
            },
        },
    };
    static api = {
        type: "object",
        properties: {
            file: { type: "string" },
        },
    };

    constructor(id) {
        super(id);
        this.nodesDB = localForage.createInstance({
            name: `bespeak-nodes`,
        });
        this.blobCache = new Map();

        this.pipe(window.NodeList);
    }

    async _call(parameters) {
        const file = parameters.file;
        const source = await this.nodesDB.getItem(file);
        const transformedSource = await this.transformSource(source);
        const blob = new Blob([transformedSource], { type: "text/javascript" });
        const blobUrl = URL.createObjectURL(blob);

        if (!this.blobCache.has(file)) {
            this.blobCache.set(file, blobUrl);
        }

        return this.blobCache.get(file);
    }

    async _process(input, config) {
        const source = input.source;
        if (source) {
            const transformedSource = await this.transformSource(source);
            const blob = new Blob([transformedSource], {
                type: "text/javascript",
            });
            const blobUrl = URL.createObjectURL(blob);

            const module = await import(blobUrl);
            const filename = `./nodes/${module.default.name}.js`;
            URL.revokeObjectURL(blobUrl);

            const existingSource = await this.nodesDB.getItem(filename);
            if (existingSource && config.overwrite === "ask") {
                const result = await Swal.fire({
                    title: "File already exists",
                    text: "Do you want to overwrite it?",
                    icon: "warning",
                    showCancelButton: true,
                    confirmButtonText: "Yes, overwrite it!",
                    cancelButtonText: "No, keep it",
                });

                if (result.isConfirmed) {
                    await this.saveComponent(filename, source);
                }
            } else if (!existingSource || config.overwrite === "always") {
                await this.saveComponent(filename, source);
            }
        }
        const keys = await this.nodesDB.keys();
        const output = [];
        for (const key of keys) {
            const source = await this.nodesDB.getItem(key);
            output.push({ file: key, source });
        }

        return output;
    }

    async saveComponent(filename, source) {
        await this.nodesDB.setItem(filename, source);
        const old = this.blobCache.get(filename);
        if (old) {
            URL.revokeObjectURL(old);
            this.blobCache.delete(filename);
        }
    }

    async transformSource(source) {
        const baseUrl = _baseUrl();
        return await source?.replaceAsync(
            /import\s+(.*?)?\s+from\s+['"](.*?)['"]/g,
            async (match, importList, importPath) => {
                if (importPath.startsWith(".")) {
                    if (importPath.startsWith("./nodes/")) {
                        const blobUrl = await this.call({ file: importPath });
                        if (importList) {
                            return `import ${importList} from "${blobUrl}"`;
                        } else {
                            return `import "${blobUrl}"`;
                        }
                    } else {
                        const absoluteUrl = new URL(importPath, baseUrl).href;
                        if (importList) {
                            return `import ${importList} from "${absoluteUrl}"`;
                        } else {
                            return `import "${absoluteUrl}"`;
                        }
                    }
                }
                return match;
            }
        );
    }
}
