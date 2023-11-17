import { jsonPreset } from "https://esm.sh/json-schema-preset";
import empty from "https://esm.sh/json-schema-empty";
import { pipe, switchMap, withLatestFrom, filter, of, map } from "rxjs";

export const key = "jsonPreset";
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
    config: { role = "operator:input", ajv: ajvConfig, strict, skipValidation },
}) {
    return pipe(
        node.log("validator: start"),
        switchMap((doc) => {
            if (!doc) {
                return node.schema$$(role).pipe(map((schema) => empty(schema)));
            }

            return doc.get$("data");
        }),
        withLatestFrom(node.schema$$(role)),
        node.log("validator: got data"),
        map(([data, schema]) => [
            skipPresets ? data : jsonPreset(schema, data),
            schema,
        ]),
        filter(([data, schema]) => {
            if (skipValidation) return true;
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
