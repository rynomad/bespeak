import safeStringify from "https://esm.sh/json-stringify-safe";
import * as yaml from "https://esm.sh/js-yaml";
import {
    Observable,
    timer,
    debounce,
    map,
    tap,
    timeInterval,
    bufferCount,
    switchMap,
} from "https://esm.sh/rxjs@7.3.0";
import Ajv from "https://esm.sh/ajv@8.6.3";

import { sha256 } from "https://esm.sh/sha-anything";
export async function getText(url) {
    const response = await fetch(url);
    return await response.text();
}
export const sanitizeAndRenderYaml = (object) => {
    if (Array.isArray(object)) {
        object = object.map((o) =>
            o.value instanceof Error
                ? {
                      ...o,
                      value: `Error: ${o.value.message}\n\nStack: ${e.value.stack}`,
                  }
                : o
        );
    }

    const sanitizedObject = safeStringify(object);
    if (!sanitizedObject) return;
    const parsedObject = JSON.parse(sanitizedObject);

    return yaml.dump(parsedObject);
};

export function baseUrl() {
    return new URL(".", import.meta.url).href;
}

export function getAbsoluteUrl(url) {
    const _baseUrl = baseUrl();
    return new URL(url, _baseUrl).href;
}

export async function getProjectSource(relativeUrl) {
    const _baseUrl = baseUrl();
    const absoluteUrl = new URL(relativeUrl, _baseUrl).href;
    const text = await fetch(absoluteUrl).then((response) => response.text());
    return transformSource(text);
}

export function transformSource(source) {
    const _baseUrl = baseUrl();
    return source.replace(
        /import\s+(.*?)?\s+from\s+['"](.*?)['"]/g,
        (match, importList, importPath) => {
            if (importPath.startsWith(".")) {
                const absoluteUrl = new URL(importPath, _baseUrl).href;
                if (importList) {
                    return `import ${importList} from "${absoluteUrl}"`;
                } else {
                    return `import "${absoluteUrl}"`;
                }
            }
            return match;
        }
    );
}

export function getDefaultValue(schema) {
    if (!schema) {
        return undefined;
    } else {
        const ajv = new Ajv({ strict: false, useDefaults: true });
        const augmentedSchema = addDefaultValuesToSchema(schema);
        const validate = ajv.compile(augmentedSchema);

        // Create an object that will be populated with default values
        let defaultData;

        switch (schema.type) {
            case "object":
                defaultData = {};
                break;
            case "array":
                defaultData = [];
                break;
            case "string":
                defaultData = "";
                break;
        }
        // Apply default values to the object based on schema
        validate(defaultData);

        return defaultData;
    }
}
export const adaptiveDebounce = (minTime, maxTime, increment) => {
    return (source) => {
        let debounceTimeMs = minTime;
        let lastEmit = Date.now();

        return new Observable((observer) => {
            return source
                .pipe(
                    tap((value) => {
                        const now = Date.now();
                        const diff = now - lastEmit;
                        lastEmit = now;

                        if (diff < minTime) {
                            debounceTimeMs = Math.min(
                                maxTime,
                                debounceTimeMs + increment
                            );
                        } else {
                            debounceTimeMs = minTime;
                        }
                        // console.log(
                        //     `Adaptive debounce time set to: ${debounceTimeMs} ms`
                        // );
                    }),
                    debounce(() => {
                        // console.log(
                        //     `Debounce triggered with duration: ${debounceTimeMs} ms`
                        // );
                        return timer(debounceTimeMs);
                    }),
                    tap(() => {
                        lastEmit = Date.now(); // Reset last emit time after debounce
                    })
                )
                .subscribe(observer);
        });
    };
};
export function extractCodeBlocks(text) {
    // The '^' character asserts start of a line due to the 'm' flag
    const regex = /^```(\w*\n)?([\s\S]*?)```/gm;
    let match;
    const codeBlocks = [];

    while ((match = regex.exec(text)) !== null) {
        let language = match[1]?.trim() || "plaintext";
        let codeBlock = match[2];

        // Check if the code block is valid, e.g. not an empty string
        if (codeBlock.trim().length > 0) {
            codeBlocks.push(codeBlock);
        }
    }

    return codeBlocks;
}

export async function hashObject(obj) {
    const hash = await sha256(obj, { deepSort: true });
    // console.log(hash, obj);
    return hash;
}

const switchMapToLatest = (asyncTask) => (source) => {
    let pending = false;
    let latestValue = null;
    let hasLatestValue = false;

    return new Observable((observer) => {
        const subject = new Subject();
        subject
            .pipe(
                switchMap((val) =>
                    of(val).pipe(
                        tap(() => {
                            pending = true;
                        }),
                        switchMap(asyncTask),
                        tap(() => {
                            pending = false;
                        })
                    )
                )
            )
            .subscribe(observer);

        return source.subscribe({
            next(value) {
                if (!pending) {
                    subject.next(value);
                } else {
                    latestValue = value;
                    hasLatestValue = true;
                }
            },
            complete() {
                if (hasLatestValue) {
                    subject.next(latestValue);
                }
                observer.complete();
            },
            error(err) {
                observer.error(err);
            },
        });
    });
};

export async function hashPOJO(obj) {
    // Sort object keys to ensure consistent hashing
    const sortedObj = JSON.stringify(sortObjectKeys(obj));

    // Convert JSON string to a buffer
    const msgBuffer = new TextEncoder().encode(sortedObj);

    // Hash the buffer using SHA-256
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);

    // Convert the hash to a string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    return hashHex;
}

function sortObjectKeys(obj) {
    if (obj === null || typeof obj !== "object") {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(sortObjectKeys);
    }
    return Object.keys(obj)
        .sort()
        .reduce((result, key) => {
            result[key] = sortObjectKeys(obj[key]);
            return result;
        }, {});
}

export function getUID() {
    if ("randomBytes" in crypto) {
        return crypto.randomBytes(8).toString("hex");
    }

    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const array = Array.from(bytes);
    const hexPairs = array.map((b) => b.toString(16).padStart(2, "0"));

    return hexPairs.join("");
}

export function addDefaultValuesToSchema(schema) {
    if (schema.type === "object") {
        schema.properties = schema.properties || {};
        schema.required = schema.required || [];

        schema.required.forEach((key) => {
            // console.log(key, schema);
            if (schema.properties[key].type === "object") {
                schema.properties[key].default =
                    schema.properties[key].default || {};
                addDefaultValuesToSchema(schema.properties[key]);
            } else if (schema.properties[key].type === "array") {
                schema.properties[key].default =
                    schema.properties[key].default || [];
                addDefaultValuesToSchema(schema.properties[key]);
            }
        });

        for (const key of Object.keys(schema.properties)) {
            if (
                schema.properties[key].type === "object" &&
                !schema.properties[key].default
            ) {
                addDefaultValuesToSchema(schema.properties[key]);
            }
        }
    } else if (schema.type === "array") {
        schema.default = schema.default || [];

        if (
            schema.items &&
            (schema.items.type === "object" || schema.items.type === "array")
        ) {
            addDefaultValuesToSchema(schema.items);
        }
    }

    return schema;
}

export function validateAgainstSchema(data, schema) {
    if (!schema) {
        return data;
    }

    const ajv = new Ajv({
        useDefaults: true,
        additonalProperties: true,
        strict: false,
    });
    const validate = ajv.compile(schema);
    const valid = validate(data);

    if (!valid) {
        console.error(validate.errors);
        throw new Error("Invalid data");
    }

    return data;
}

export function getSource(url) {
    return async () => {
        const response = await fetch(url);
        const source = await response.text();
        return source;
    };
}

export async function importFromString(source) {
    source = transformSource(source);
    const blob = new Blob([source], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const module = await import(url);
    URL.revokeObjectURL(url);
    return module;
}

export function generateSchemaFromValue(value) {
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
            return {};
    }

    return schema;
}

export function getMarkdownCodeBlocks(markdown) {
    const regex = /```(\w+)\n([\s\S]*?)```/g;
    let match;
    const codeBlocks = [];

    while ((match = regex.exec(markdown)) !== null) {
        codeBlocks.push({
            language: match[1],
            code: match[2].trim(),
        });
    }

    return codeBlocks;
}
