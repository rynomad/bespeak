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
                input: { type: Object },
                output: { type: Object },
                owners: { type: Array },
                assets: { type: Array },
                error: { type: Error },
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

        constructor() {
            super();
            this.__wrapMethods();
        }

        updated(changedProperties) {
            if (
                changedProperties.has("error") ||
                changedProperties.has("output")
            ) {
                node.error = this.error;
                node.output = this.output;
            }

            super.updated(changedProperties);
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
