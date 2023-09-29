import { BehaviorSubject } from "https://esm.sh/rxjs";
import { Stream } from "./stream.js";
import * as TYPES from "./types/index.js";
import { distinctUntilChanged, map } from "https://esm.sh/rxjs";
import { PropagationStopper } from "./mixins.js";
import { debug } from "./operators.js";
import {
    combineLatest,
    scan,
    withLatestFrom,
    filter,
} from "https://esm.sh/rxjs";
import debounce from "https://esm.sh/lodash/debounce";
import { deepEqual } from "https://esm.sh/fast-equals";
import isPojo from "https://esm.sh/is-pojo";
import Ajv from "https://esm.sh/ajv";

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

            if (!prop.hasChanged) {
                prop.hasChanged = (newValue, oldValue) =>
                    isPojo(newValue)
                        ? !deepEqual(oldValue, newValue)
                        : oldValue !== newValue;
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

export const ComponentMixin = (
    Base,
    events = ["pointerdown", "wheel", "dblclick", "contextmenu"]
) => {
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

        static get name() {
            // Get the name of the base class
            const baseName = Base.toString().match(/\w+/g)[1];

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

        constructor() {
            super();
            this.errors$ = new BehaviorSubject(null);
        }

        __accumulatedProperties = new Map();

        updated(changedProperties) {
            if (changedProperties.has("_node")) {
                // this.__wrapMethods();
                if (this._node && !this.__initialized) {
                    this.__initialized = true;
                    // this.__wrapMethods();
                    this.__makeStreams();
                    this.__processInput();
                }
            } else {
                // Merge the changedProperties into the accumulatedProperties
                for (const [key, value] of changedProperties) {
                    if (!this.__accumulatedProperties.has(key)) {
                        this.__accumulatedProperties.set(key, value);
                    }
                }
                this.__debouncedSuperUpdate();
            }

            // this.requestUpdate();
        }

        __debouncedSuperUpdate = debounce(() => {
            this.__lastChangedProperties = this.__accumulatedProperties;
            super.updated(this.__accumulatedProperties);
            this.__accumulatedProperties = new Map();
            // Clear the accumulated properties after they've been used
        }, 300); // Adjust the debounce time as needed

        get isFromCache() {
            for (const key in this.constructor.properties) {
                if (Base.properties.hasOwnProperty(key)) {
                    const prop = Base.properties[key];
                    if (this[key] && !Stream.storage.has(this[key])) {
                        return false;
                    }
                }
            }

            return true;
        }

        get hasAllInputs() {
            for (const key in this.constructor.properties) {
                if (Base.properties.hasOwnProperty(key)) {
                    if (!key.endsWith("_output") && !this[key]) {
                        return false;
                    } else if (this[key] && Base.properties[key].type.schema) {
                        // Import AJV for schema validation
                        const ajv = new Ajv();

                        // Validate value against Base.properties[key].type.schema
                        const validate = ajv.compile(
                            Base.properties[key].type.schema
                        );
                        const valid = validate(this[key]);

                        if (!valid) {
                            return false;
                        }
                    }
                }
            }

            return true;
        }

        get didInputsChange() {
            for (const key in this.constructor.properties) {
                if (Base.properties.hasOwnProperty(key)) {
                    if (
                        !key.endsWith("_output") &&
                        this.__lastChangedProperties?.has(key)
                    ) {
                        return true;
                    }
                }
            }

            return false;
        }

        connectedCallback() {
            super.connectedCallback();

            events.forEach((name) =>
                this.addEventListener(name, this.__stopPropagation, {
                    capture: true, // Capture the event before it reaches other handlers
                })
            );
        }

        // Define the event handler
        __stopPropagation(event) {
            const rect = this.getBoundingClientRect();
            const computedStyle = window.getComputedStyle(this);

            // Fetch and parse the margins
            const marginLeft = parseFloat(computedStyle.marginLeft);
            const marginTop = parseFloat(computedStyle.marginTop);
            const marginRight = parseFloat(computedStyle.marginRight);
            const marginBottom = parseFloat(computedStyle.marginBottom);

            // Calculate the adjusted boundaries without the margins
            const adjustedLeft = rect.left + marginLeft;
            const adjustedRight = rect.right - marginRight;
            const adjustedTop = rect.top + marginTop;
            const adjustedBottom = rect.bottom - marginBottom;

            // Check if the event's coordinates are within the adjusted rectangle
            if (
                event.clientX >= adjustedLeft &&
                event.clientX <= adjustedRight &&
                event.clientY >= adjustedTop &&
                event.clientY <= adjustedBottom
            ) {
                // Prevent other handlers from stopping the default behavior
                event.stopPropagation();
            }
        }

        // Don't forget to clean up the event listener when the element is disconnected
        disconnectedCallback() {
            events.forEach((name) =>
                this.removeEventListener(name, this.stopPropagation, {
                    capture: true,
                })
            );
            super.disconnectedCallback();
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
                    if (!this.__streams.has(key)) {
                        this.__createStream(key, prop.type);
                    }
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
                    this.__streams ||= new Map();
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
                    this.__streams ||= new Map();
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

                    if (
                        !this.__outputs.has(this.__streams.get(key)) &&
                        !name.endsWith("_input")
                    ) {
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
            this._node.inputs$.pipe(debug(this, "got inputs")).subscribe();
            this._node.parameters$
                .pipe(debug(this, "got parameters"))
                .subscribe();
            combineLatest(this._node.inputs$, this._node.parameters$)
                .pipe(
                    debug(this, "inputs and parameters"),
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
                                _subs.push(
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
                    }, [])
                )
                .subscribe();
        }
    };
};
