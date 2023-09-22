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

export class Stream {
    constructor(node, definition) {
        const uiSchema = definition.uiSchema || {};
        delete definition.uiSchema;
        Object.assign(this, definition);
        this.node = node;
        this.id = `${this.node.id}-${(definition.name || definition.label)
            .toLowerCase()
            .replace(/ /g, "-")}`;
        this.socket = node.socket;
        this.name = definition.name;
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
        let initialValue = (await this.db.get("streams", this.id))?.data;
        this.dataFromStorage = this.formData = initialValue;
        try {
            // console.log(this.id, "got from db", initialValue);
            initialValue.fromStorage = true;
        } catch (error) {
            console.warn("error adding fromStorage to initialValue", error);
        }
        if (!initialValue) {
            const defaultValue = this.getDefaultValue();
            initialValue = defaultValue;
            await this.db.put("streams", { id: this.id, data: defaultValue });
        }

        this.subject
            .pipe(
                filter((value) => value !== initialValue && !value.fromStorage)
            )
            .subscribe((value) => {
                // console.log(this.id, "saving to db", value);
                this.db
                    .put("streams", { id: this.id, data: value })
                    .catch((error) => {
                        console.warn("error saving stream to db", error);
                    });
            });

        const timeout = setTimeout(() => {
            // console.log("PUBLISH INITIAL VALUE", initialValue);
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

    async getDB() {
        let db;

        // Open the database without specifying a version to get the current version
        db = await openDB(Stream.db + "-" + this.type);
        let dbVersion = db.version;

        if (!db.objectStoreNames.contains(this.id)) {
            await db.close();
            dbVersion++;

            // Add the operation to the queue
            Stream.dbOpenQueue = Stream.dbOpenQueue.then(async () => {
                db = await openDB(Stream.db + "-" + this.type, dbVersion, {
                    upgrade: (db) => {
                        if (!db.objectStoreNames.contains(this.id)) {
                            db.createObjectStore(this.id, {
                                autoIncrement: true,
                            });
                        }
                    },
                });
                return db;
            });

            // Wait for the queue to finish before returning the db
            db = await Stream.dbOpenQueue;
        }

        return db;
    }

    async getInitialValue(db) {
        const tx = db.transaction(this.id, "readonly");
        const store = tx.objectStore(this.id);
        const result = await store.get("value");

        if (!result || JSON.stringify(result) === "{}") {
            this.firstCreation.next(true);
        }

        this.queue.next(false);

        return result ? result : null;
    }

    async saveToDB(value) {
        try {
            const db = await this.getDB();
            const tx = db.transaction(this.id, "readwrite");
            const store = tx.objectStore(this.id);
            await store.put(value, "value");

            await tx.done;
            await db.close();

            return tx.done;
        } catch (error) {
            this.node.streamErrors$.next({ stream: this, error });
            // Handle or rethrow error
        }
    }

    toPromptString() {
        // return markdown of the stream
        // include: name, description, schema (in code block), id, node.id
        return `## ${this.name}\n\n${this.description}\n\n\n\nStream id: ${
            this.id
        }\n\nNode id:${this.node.id}\`\`\`json\n${JSON.stringify(
            this.schema,
            null,
            4
        )}\n\`\`\``;
    }
}
