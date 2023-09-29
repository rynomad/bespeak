import {
    Subject,
    ReplaySubject,
    withLatestFrom,
    filter,
    distinctUntilChanged,
    concatMap,
    catchError,
    takeUntil,
    mergeMap,
    BehaviorSubject,
    skip,
    map,
    take,
    tap,
} from "https://esm.sh/rxjs";
import Ajv from "https://esm.sh/ajv@8.6.3";
import { openDB } from "https://esm.sh/idb@6.0.0";
import { deepEqual } from "https://esm.sh/fast-equals";
import { addDefaultValuesToSchema } from "./util.js";
import { debug } from "./operators.js";
function createSchema(name, type) {
    let schema;

    switch (type) {
        case String:
            schema = { type: "string" };
            break;
        case Number:
            schema = { type: "number" };
            break;
        case Boolean:
            schema = { type: "boolean" };
            break;
        case Object:
            schema = { type: "object", additionalProperties: true };
            break;
        case Array:
            schema = { type: "array", items: {} };
            break;
        default:
            return {
                ...type,
                name: name,
            };
    }

    return {
        label: name,
        name: name,
        type: type.type || schema.type,
        schema: schema,
    };
}
export class Stream {
    static storage = new Set();
    constructor(node, definition, name) {
        definition = createSchema(name || definition.name, definition);
        const uiSchema = definition.uiSchema || {};
        delete definition.uiSchema;
        Object.assign(this, definition);
        this.node = node;
        this.id = `${this.node.id}-${(definition.name || definition.label)
            .toLowerCase()
            .replace(/ /g, "-")}`;
        this.socket = node.socket;
        this.name = name || definition.name;
        this.description = definition.description;
        this.schema = definition.schema;
        this.type = definition.type;
        this.snapshot = definition.snapshot;
        this._uiSchema = uiSchema;
        this.subject = new ReplaySubject(1);

        this.init();
    }

    get read() {
        return this.subject.pipe(filter((value) => value !== undefined));
    }

    get db() {
        return this.node.db;
    }

    async init() {
        let initialValue = (await this.db?.get("streams", this.id))?.data;
        this.dataFromStorage = this.formData = initialValue;
        try {
            Stream.storage.add(initialValue);
            this.node.component.__locals.add(initialValue);
        } catch (error) {
            console.warn("error adding fromStorage to initialValue", error);
        }
        if (!initialValue) {
            const defaultValue = this.getDefaultValue();
            initialValue = defaultValue;
            Stream.storage.add(initialValue);
        }

        this.subject
            .pipe(
                filter((value) =>
                    this.node?.component?.__locals
                        ? this.node?.component?.__locals.has(value)
                        : true
                ),
                filter((value) => !Stream.storage.has(value))
            )
            .subscribe((value) => {
                // console.log(this.id, "saving to db", value);
                this.db
                    ?.put("streams", {
                        id: this.id,
                        data: value,
                    })
                    .catch((error) => {
                        console.warn("error saving stream to db", error);
                    });
            });

        const timeout = setTimeout(() => {
            console.log("PUBLISH INITIAL VALUE", initialValue);
            this.subject.next(initialValue);
        }, 100);

        this.subject
            .pipe(debug(this.id, "spy on subject"), take(1))
            .subscribe(() => clearTimeout(timeout));
    }

    wrapMap() {
        return map((data) => ({
            id: this.id,
            data: data,
        }));
    }

    unwrapMap() {
        return map(({ data }) => data);
    }

    async destroy() {
        this.subject.complete();
    }

    getDefaultValue() {
        const { schema } = this;

        // Otherwise, generate default object based on schema
        if (schema) {
            const ajv = new Ajv({ strict: false, useDefaults: true });
            const augmentedSchema = addDefaultValuesToSchema(schema);
            const validate = ajv.compile(augmentedSchema);

            // Create an object that will be populated with default values
            const defaultData = {};

            // Apply default values to the object based on schema
            validate(defaultData);

            return defaultData;
        }

        throw new Error("No schema provided.");
    }

    toPromptString() {
        // return markdown of the stream
        // include: name, description, schema (in code block), id, node.id
        return `## ${this.name}\n\n${this.description}\n\n\n\nStream id: ${
            this.id
        }\n\nNode id:${this.node?.id}\`\`\`json\n${JSON.stringify(
            this.schema,
            null,
            4
        )}\n\`\`\``;
    }
}
