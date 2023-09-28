import { BehaviorSubject } from "https://esm.sh/rxjs";
import { Stream } from "./stream.js";
import * as TYPES from "./types/index.js";
import { distinctUntilChanged, map } from "https://esm.sh/rxjs";

function typeToPrimitive(jsonSchema) {
    switch (jsonSchema.type) {
        case "string":
            return String;
        case "number":
            return Number;
        case "boolean":
            return Boolean;
        case "object":
            return Object;
        case "array":
            return Array;
        default:
            throw new Error(`Unsupported schema type: ${jsonSchema.type}`);
    }
}

function propertiesTransformer(props) {
    for (const key in props) {
        if (props.hasOwnProperty(key)) {
            const prop = props[key];
            if (prop.type && prop.type.schema) {
                prop.type = typeToPrimitive(prop.type.schema);
            }
        }
    }

    return {
        ...props,
        _node: { type: Object },
    };
}

function generateSchemaFromValue(value) {
    let schema;

    switch (typeof value) {
        case "string":
            schema = { type: "string" };
            break;
        case "number":
            schema = { type: "number" };
            break;
        case "boolean":
            schema = { type: "boolean" };
            break;
        case "object":
            if (Array.isArray(value)) {
                schema = {
                    type: "array",
                    items:
                        value.length > 0
                            ? generateSchemaFromValue(value[0])
                            : {},
                };
            } else {
                schema = {
                    type: "object",
                    properties: Object.fromEntries(
                        Object.entries(value).map(([key, val]) => [
                            key,
                            generateSchemaFromValue(val),
                        ])
                    ),
                };
            }
            break;
        default:
            throw new Error(`Unsupported value type: ${typeof value}`);
    }

    return schema;
}

export const ComponentMixin = (Base) => {
    return class extends Base {
        static get properties() {
            return propertiesTransformer(Base.properties);
        }

        __locals = new Set();
        __storage = new Set();

        __streams = new Map();
        __outputs = new Set();
        __parameters = new Set();
        __debounceTimeout = null;

        constructor() {
            super();
            this.errors$ = new BehaviorSubject(null);
        }

        updated(changedProperties) {
            if (changedProperties.has("_node")) {
                // this.__wrapMethods();
            }

            const shouldCallSuper = this.__shouldCallSuper(changedProperties);

            if (shouldCallSuper) {
                clearTimeout(this.__debounceTimeout);
                this.__debounceTimeout = setTimeout(() => {
                    super.updated(changedProperties);
                }, 100);
            }

            if (this.__isFirstCompleteUpdate()) {
                this.requestUpdate();
            }
            // this.requestUpdate();
        }

        __shouldCallSuper(changedProperties) {
            let shouldCallSuper = false;
            changedProperties.forEach((oldValue, propName) => {
                if (!Stream.storage.has(this[propName])) {
                    shouldCallSuper = true;
                }
            });
            return shouldCallSuper;
        }

        __isFirstCompleteUpdate() {
            if (this.__hasDoneFirstCompleteUpdate) {
                return false;
            }

            const ready = Object.keys(Base.properties).every(
                (key) => this[key]
            );
            if (ready) {
                this.__hasDoneFirstCompleteUpdate = true;
                return true;
            }

            return false;
        }

        __makeStreams() {
            for (const key in this.constructor.properties) {
                if (Base.properties.hasOwnProperty(key)) {
                    const prop = Base.properties[key];

                    const stream = new Stream(this._node, prop.type);
                    const streamWrapper = {
                        stream,
                        data: null,
                        subscription: stream.subject
                            .pipe(distinctUntilChanged())
                            .subscribe((data) => {
                                this.__setLock = true;
                                this[key] = data;
                                this.__setLock = false;
                            }),
                    };

                    this.__streams.set(key, streamWrapper);
                }
            }
        }

        __wrapMethods() {
            const methods = Object.getOwnPropertyNames(
                Object.getPrototypeOf(this)
            );
            methods.forEach((method) => {
                if (
                    typeof this[method] === "function" &&
                    method !== "constructor"
                ) {
                    const originalMethod = this[method];
                    this[method] = async (...args) => {
                        try {
                            await originalMethod.apply(this, args);
                        } catch (error) {
                            this.errors$.next(error);
                        }
                    };
                }
            });
        }

        __createStream(name, definition) {
            const stream = new Stream(this._node, definition, name);
            const streamWrapper = {
                stream,
                data: null,
                subscription: stream.subject
                    .pipe(distinctUntilChanged())
                    .subscribe((data) => {
                        this.__setFromSubject(name, data);
                    }),
            };

            this.__streams.set(name, streamWrapper);
        }

        __setFromSubject(name, value) {
            this.__setLock = true;
            this[name] = value;
            this.__setLock = false;
        }

        get __internalFunctions() {
            return [
                ...Object.getOwnPropertyNames(this),
                ...Object.getOwnPropertyNames(this.constructor),
                ...Object.getOwnPropertyNames(Object.getPrototypeOf(this)),
            ]
                .filter((name) => name.startsWith("__"))
                .filter((name) => name !== "__internalFunctions")
                .filter((name) => name !== "__isInternal")
                .map((name) => `.${name} (`);
        }

        get __isInternal() {
            const errorStack = new Error().stack;
            const stackLines = errorStack.split("\n").slice(0, 6);
            console.log(errorStack, this.__internalFunctions);
            return stackLines.some((line) =>
                [
                    ".render (",
                    ".requestUpdate (",
                    ...this.__internalFunctions,
                ].some((str) => line.includes(str))
            );
        }

        static getPropertyDescriptor(name, key, options) {
            const prop = Base.properties[name];

            if (!prop) {
                return super.getPropertyDescriptor(name, key, options);
            }

            key = name;

            return {
                get() {
                    if (!this.__streams.has(name)) {
                        this.__createStream(name, prop.type);
                    }
                    if (
                        !this.__parameters.has(this.__streams.get(name)) &&
                        !name.endsWith("_output")
                    ) {
                        this.__parameters.add(this.__streams.get(name));
                        this._node.parameters$.next(
                            Array.from(this.__parameters).map(
                                ({ stream }) => stream
                            )
                        );
                    }
                    return this.__streams.get(name).data;
                },
                set(value) {
                    if (!this.__streams.has(name)) {
                        this.__createStream(name, prop.type);
                    }
                    const oldValue = this.__streams.get(name).data;
                    this.__streams.get(name).data = value;

                    this.__streams.get(key).stream.schema ||=
                        generateSchemaFromValue(value);

                    if (!this.__setLock) {
                        this.__locals.add(value);

                        this.__streams.get(key).stream.subject.next(value);
                    }

                    if (!this.__outputs.has(this.__streams.get(key))) {
                        this.__outputs.add(this.__streams.get(key));
                        this._node.outputs$.next(
                            Array.from(this.__outputs).map(
                                ({ stream }) => stream
                            )
                        );
                    }
                    this.requestUpdate(name, oldValue, options);
                },
                configurable: true,
                enumerable: true,
            };
        }

        __processInput() {
            combineLatest(this._node.inputs$, this._node.parameters$)
                .pipe(
                    scan((subs, [inputs, parameters]) => {
                        for (const sub of subs) {
                            sub.unsubscribe();
                        }
                        const _subs = [];
                        for (const input of inputs) {
                            const parameter = parameters.find(
                                (p) =>
                                    deepEqual(p.schema, input.schema) &&
                                    p.type === input.type
                            );
                            if (parameter) {
                                __subs.push(
                                    input.subject
                                        .pipe(
                                            withLatestFrom(parameter.subject),
                                            filter(
                                                ([_, parameter]) =>
                                                    !this.__locals.has(
                                                        parameter
                                                    )
                                            ),
                                            map(([input]) => input)
                                        )
                                        .subscribe(parameter.subject)
                                );
                            }
                        }
                        return _subs;
                    })
                )
                .subscribe();
        }
    };
};
