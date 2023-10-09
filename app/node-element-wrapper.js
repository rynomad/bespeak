import jscodeshift from "https://esm.sh/jscodeshift";
import { importFromString } from "./util.js";
import { LitElement } from "https://esm.sh/lit";
import OpenAI from "https://esm.sh/openai";
import debounce from "https://esm.sh/lodash/debounce";

export const NextNodeElementWrapper = (
    node,
    Base,
    quine,
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
                error: { type: Error },
                config: { type: Object },
                keys: { type: Array },
                source: { type: String },
            };
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
            // this.__wrapMethods();
        }
        __accumulatedProperties = new Map();
        updated(changedProperties) {
            if (
                changedProperties.has("error") ||
                changedProperties.has("output") ||
                changedProperties.has("source")
            ) {
                node.error = this.error;
                node.output = this.output;
                node.source = this.source;
            }

            for (const [key, value] of changedProperties) {
                if (!this.__accumulatedProperties.has(key)) {
                    this.__accumulatedProperties.set(key, value);
                }
            }
            this.__debouncedSuperUpdate();
        }

        __debouncedSuperUpdate = debounce(() => {
            this.__lastChangedProperties = this.__accumulatedProperties;
            super.updated(this.__accumulatedProperties);
            this.__accumulatedProperties = new Map();
            // Clear the accumulated properties after they've been used
        }, 500); // Adjust the debounce time as needed

        async codeShift({ transformString }) {
            const { default: transform } = await importFromString(
                transformString
            );
            const source = this.source;
            this.source = await transform(jscodeshift, source);
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
            { model = "gpt-4", temperature = 0.4, n = 1, messages = [] } = {},
            cb = () => {}
        ) {
            const options = {
                model,
                temperature,
                n,
                // functions,
                // function_call,
                messages,
            };
            const openai = new OpenAI({
                apiKey,
                dangerouslyAllowBrowser: true,
            });
            const remainder = n - 1;

            const streamOptions = {
                ...options,
                stream: true,
                n: 1,
            };

            const stream = await openai.chat.completions.create(streamOptions);

            let streamContent = "";

            const remainderResponses = [];
            for (let i = 0; i < remainder; i += 10) {
                const batchSize = Math.min(remainder - i, 10);
                const remainderOptions = {
                    ...options,
                    n: batchSize,
                };
                remainderResponses.push(
                    openai.chat.completions.create(remainderOptions)
                );
            }

            const allResponses = (
                await Promise.all([
                    (async () => {
                        for await (const part of stream) {
                            const delta = part.choices[0]?.delta?.content || "";
                            streamContent += delta;
                            cb(streamContent);
                        }
                        return streamContent;
                    })(),
                    Promise.all(remainderResponses).then((responses) => {
                        return responses.flatMap((e) =>
                            e.choices.map((e) => e.message.content)
                        );
                    }),
                ])
            )
                .flat()
                .map((content) => ({
                    role: "assistant",
                    content,
                }));

            this.chat_output = {
                messages: [...messages, allResponses],
            };
        }

        __wrapMethods() {
            const methods = [
                ...Object.getOwnPropertyNames(Object.getPrototypeOf(this)),
                ...Object.getOwnPropertyNames(Base.prototype),
            ];
            methods.forEach((method) => {
                console.log("check method", method);
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
