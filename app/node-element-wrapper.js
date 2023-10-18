import jscodeshift from "https://esm.sh/jscodeshift";
import { importFromString } from "./util.js";
import { LitElement } from "https://esm.sh/lit@2.8.0";
import OpenAI from "https://esm.sh/openai@4.11.0";
import debounce from "https://esm.sh/lodash/debounce";
import { deepEqual } from "https://esm.sh/fast-equals";
import jsonpath from "https://esm.sh/jsonpath";
import localForage from "https://esm.sh/localforage";

export const NextNodeElementWrapper = (
    node,
    Base,
    quine,
    url,
    hardCoded = false,
    owner = "default"
) => {
    return class extends Base {
        static get properties() {
            return {
                ...Base.properties,
                input: { type: Object },
                output: { type: Object },
                owners: { type: Array },
                assets: { type: Array },
                specification: { type: String },
                chat: { type: Object },
                error: { type: Error },
                config: { type: Object },
                keys: { type: Array },
                source: { type: String },
            };
        }

        static get ouptutSchema() {
            return Base.outputSchema || {};
        }

        static get ports() {
            return Base.ports || ["input", "output", "owners", "assets"];
        }

        get ports() {
            return this.constructor.ports;
        }

        static get name() {
            // Get the name of the base class
            const baseName = Base.toString().match(/\w+/g)[1];

            if (baseName === "extends") {
                return "anonymous";
            }

            // Split the camel case string into separate words, respecting acronyms
            const words = baseName.split(
                /(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/
            );

            // Capitalize the first letter of each word and join them with a space
            const titleCaseName = words
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(" ");

            return titleCaseName;
        }

        static get tagName() {
            return this.name.toLowerCase().replace(/ /g, "-");
        }

        static async quine() {
            return quine ? quine() : Base.toString();
        }

        get __elementUrl() {
            return url;
        }

        static get hardCoded() {
            return hardCoded;
        }

        get name() {
            return this.constructor.name;
        }

        get id() {
            return node.id;
        }

        constructor() {
            super();
            this.__wrapMethods();
            this.__reactiveCache = localForage.createInstance({
                name: `reactiveCache-${this.id}`,
            });
        }

        async __shouldSuperUpdate() {
            const reactivePaths = this.constructor.reactivePaths;

            if (!reactivePaths || reactivePaths.length === 0) {
                return true;
            }

            let hasDifferences = false;

            await Promise.all(
                reactivePaths.map(async (path) => {
                    const newValues = jsonpath.query(this, path);
                    const newValue =
                        newValues.length > 0 ? newValues[0] : undefined;

                    const cachedValue = await this.__reactiveCache.getItem(
                        path
                    );

                    if (
                        !deepEqual(cachedValue, newValue) &&
                        (newValue || cachedValue)
                    ) {
                        hasDifferences = true;
                        this.__reactiveCache.setItem(path, newValue);
                    }
                })
            );

            return hasDifferences;
        }

        async __clearNetworkCache() {
            if (
                "serviceWorker" in navigator &&
                navigator.serviceWorker.controller
            ) {
                // Send a message to the service worker to clear the cache
                navigator.serviceWorker.controller.postMessage({
                    action: "clearCache",
                    cacheName: this.__url,
                });

                // Optional: Listen for a response from the service worker
                const onMessage = (event) => {
                    console.log(event.data); // Handle the service worker response here
                    navigator.serviceWorker.removeEventListener(
                        "message",
                        onMessage
                    );
                };
                navigator.serviceWorker.addEventListener("message", onMessage);
            } else {
                console.warn("Service worker is not available.");
            }
        }

        async quine() {
            return quine ? quine() : this.constructor.toString();
        }

        parseJSDocComments() {
            const classAsString = this.toString();
            const jsDocComments =
                classAsString.match(
                    /\/\*\*([^*]|[\r\n]|(\*+([^*/]|[\r\n])))*\*+\//g
                ) || [];
            const parsedComments = jsDocComments.map((comment) => {
                const jsonStart = comment.indexOf("{");
                const jsonEnd = comment.lastIndexOf("}") + 1;
                const jsonString = comment.slice(jsonStart, jsonEnd);
                try {
                    return JSON.parse(jsonString);
                } catch (error) {
                    console.warn(
                        "Failed to parse JSDoc comment as JSON:",
                        comment
                    );
                    return null;
                }
            });
            const parsed = parsedComments.filter((comment) => comment !== null);
            if (!parsed.length) return;
            return parsed;
        }

        __accumulatedProperties = new Map();

        async updated(changedProperties) {
            if (
                changedProperties.has("error") ||
                changedProperties.has("output") ||
                changedProperties.has("source") ||
                changedProperties.has("specification") ||
                changedProperties.has("chat")
            ) {
                node.error = this.error || node.error;
                node.output = this.output || node.output;
                node.source = this.source || node.source;
                node.specification = this.specification || node.specification;
                node.chat = this.chat || node.chat;
            }

            for (const [key, value] of changedProperties) {
                if (!this.__accumulatedProperties.has(key)) {
                    this.__accumulatedProperties.set(key, value);
                }
            }

            if (await this.__shouldSuperUpdate()) {
                this.__debouncedSuperUpdate();
            }
        }

        __debouncedSuperUpdate = debounce(() => {
            this.__lastChangedProperties = this.__accumulatedProperties;
            super.updated(this.__accumulatedProperties);
            this.__accumulatedProperties = new Map();
            // Clear the accumulated properties after they've been used
        }, 100); // Adjust the debounce time as needed

        async codeShift({ transform }) {
            const { default: transformFn } = await importFromString(transform);
            const source = this.source;
            const root = jscodeshift(source);
            this.source = await transformFn(root, jscodeshift);
        }

        get api() {
            const litElementMethods = Object.getOwnPropertyNames(
                LitElement.prototype
            );
            let proto = Object.getPrototypeOf(this);
            const api = [];

            // while (proto && proto.constructor.name !== "LitElement") {
            //     const methods = Object.getOwnPropertyNames(proto).filter(
            //         (name) =>
            //             !name.startsWith("__") &&
            //             typeof proto[name] === "function" &&
            //             !litElementMethods.includes(name)
            //     );

            //     for (const method of methods) {
            //         api.push({
            //             description: proto[method].toString(),
            //             name: method,
            //             parameters: {
            //                 type: "object",
            //                 properties: {
            //                     arguments: { type: "object" },
            //                 },
            //             },
            //         });
            //     }

            //     proto = Object.getPrototypeOf(proto);
            // }

            return api;
        }

        async gpt(
            apiKey,
            {
                model = "gpt-4",
                temperature = 0.4,
                n = 1,
                messages = [],
                functions,
                function_call,
            } = {},
            cb = () => {}
        ) {
            const options = {
                model,
                temperature,
                n,
                functions,
                function_call,
                messages,
            };

            const openai = new OpenAI({
                apiKey,
                dangerouslyAllowBrowser: true,
            });

            if (functions) {
                const responses = [];
                for (let i = 0; i < n; i += 10) {
                    const batchSize = Math.min(n - i, 10);
                    const batchOptions = {
                        ...options,
                        n: batchSize,
                        user: `batch-${i}`,
                    };
                    responses.push(
                        openai.chat.completions.create(batchOptions)
                    );
                }

                const allResponses = (await Promise.all(responses))
                    .flat()
                    .map((e) => e.choices.map((e) => e.message))
                    .flat();

                return [...messages, allResponses];
            } else {
                const remainder = n - 1;
                const streamOptions = {
                    ...options,
                    stream: true,
                    n: 1,
                    user: `stream`,
                };

                const stream = await openai.chat.completions.create(
                    streamOptions
                );

                let streamContent = "";

                const remainderResponses = [];
                for (let i = 0; i < remainder; i += 10) {
                    const batchSize = Math.min(remainder - i, 10);
                    const remainderOptions = {
                        ...options,
                        n: batchSize,
                        user: `remainder-${i}`,
                    };
                    remainderResponses.push(
                        openai.chat.completions.create(remainderOptions)
                    );
                }

                const allResponses = (
                    await Promise.all([
                        (async () => {
                            for await (const part of stream) {
                                const delta =
                                    part.choices[0]?.delta?.content || "";
                                streamContent += delta;
                                cb(streamContent);
                            }
                            return {
                                content: streamContent,
                                role: "assistant",
                            };
                        })(),
                        Promise.all(remainderResponses).then((responses) => {
                            return responses.flatMap((e) =>
                                e.choices.map((e) => e.message)
                            );
                        }),
                    ])
                ).flat();

                return [...messages, allResponses];
            }
        }
        __wrapMethods() {
            const methods = [
                ...Object.getOwnPropertyNames(Object.getPrototypeOf(this)),
                ...Object.getOwnPropertyNames(Base.prototype),
            ];
            methods.forEach((method) => {
                // console.log("check method", method);
                if (
                    typeof this[method] === "function" &&
                    method !== "constructor"
                ) {
                    const originalMethod = this[method];
                    this[method] = (...args) => {
                        try {
                            if (
                                originalMethod.constructor.name ===
                                "AsyncFunction"
                            ) {
                                return new Promise((resolve, reject) => {
                                    originalMethod
                                        .apply(this, args)
                                        .then(resolve)
                                        .catch((error) => {
                                            this.error = error;
                                        });
                                });
                            } else {
                                return originalMethod.apply(this, args);
                            }
                        } catch (error) {
                            this.error = error;
                        }
                    };
                }
            });
        }
    };
};
