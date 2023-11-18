import { jsonPreset } from "https://esm.sh/json-schema-preset";
import empty from "https://esm.sh/json-schema-empty";
import Ajv from "https://esm.sh/ajv";

import {
    pipe,
    switchMap,
    withLatestFrom,
    filter,
    of,
    map,
    mergeMap,
    tap,
} from "rxjs";

export const key = "validator";
export const version = "0.0.1";
export const description =
    "The jsonPreset operator takes a schema key and data and returns a default object according to the associated schema on the given node. optionally configurable with an initial data object.";

export const configSchema = () => {
    return of({
        type: "object",
        properties: {
            strict: {
                type: "boolean",
                default: true,
                description:
                    "If true, will throw an error on invalid data. Otherwise the offending event will just be ignored",
            },
            role: {
                type: "string",
                description: "The schema key to use.",
            },
            data: {
                type: "object",
                description: "The initial data to use.",
            },
            skipValidation: {
                type: "boolean",
                default: false,
            },
            ajv: {
                type: "object",
                additionalProperties: true,
                description: "JSON schema validator options",
            },
        },
        required: ["schema"],
    });
};

export default function validator({
    node,
    config: {
        role = "operator:input",
        ajv: ajvConfig,
        strict,
        skipPresets,
        skipValidation,
    },
}) {
    return pipe(
        node.log(`validator: start ${role}`),
        mergeMap((doc) => {
            if (!doc) {
                if (role.endsWith(":keys")) {
                    return of(null);
                }
                return node.schema$$(role).pipe(
                    node.log(`validator: got schema for role: ${role}`),
                    map((schema) => {
                        return schema ? empty(schema) : {};
                    }),
                    node.log(
                        `validator: got empty data from schema for role: ${role}`
                    )
                );
            }

            return doc?.get$ ? doc.get$("data") : of(doc);
        }),
        filter((data) => !!data),
        tap((d) =>
            console.log("got data to validate, get schema", node.id, role, d)
        ),
        withLatestFrom(node.schema$$(role)),
        tap(([d, schema]) =>
            console.log("got schema to validate data", node.id, role, d)
        ),
        node.log("validator: got data"),
        map(([data, schema]) => [
            !schema || skipPresets ? data : jsonPreset(schema, data),
            schema,
        ]),
        filter(([data, schema]) => {
            console.log(
                "validator filter data",
                node.id,
                role,
                data,
                JSON.stringify(schema)
            );
            if (skipValidation || !schema) return true;
            if (!data) return false;

            const ajv = new Ajv(ajvConfig);
            const validate = ajv.compile(schema);
            const valid = validate(data);
            if (!valid && strict) {
                throw new Error(
                    `Input does not match schema: ${ajv.errorsText()}`
                );
            }
            return valid;
        }),
        map(([data]) => data),
        node.log("validator: validated data")
    );
}
