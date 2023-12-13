import { jsonPreset } from "https://esm.sh/json-schema-preset";
import empty from "https://esm.sh/json-schema-empty";
import Ajv from "https://esm.sh/ajv";
import addFormats from "https://esm.sh/ajv-formats";

import {
    pipe,
    switchMap,
    withLatestFrom,
    filter,
    of,
    map,
    mergeMap,
    tap,
    combineLatest,
} from "rxjs";

const getText = async (path) => {
    try {
        const cwd = Deno.realPathSync(".");
        return await Deno.readTextFile(`${cwd}/${path}`);
    } catch (e) {
        return await fetch(path).then((res) => res.text());
    }
};

export const key = "validator";
export const version = "0.0.1";
export const prompt = await getText(`prompts/validator.md`);

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

export const validator =
    ({
        node,
        config: {
            role = "process:input",
            ajv: ajvConfig,
            strict,
            skipPresets,
            skipValidation,
        },
    }) =>
    (source$) => {
        return combineLatest(source$, node.schema$$(role)).pipe(
            node.log(`validator: start ${role}`),
            switchMap(([doc, schema]) => {
                if (!doc) {
                    if (role.endsWith(":keys")) {
                        return of(null).pipe(filter(() => !schema));
                    }
                    doc = schema ? empty(schema) : {};
                    // console.log("empty doc", doc);
                }

                const doc$ = doc?.get$ ? doc.get$("data") : of(doc);

                return doc$.pipe(
                    // tap((data) =>
                    //     // console.log(
                    //     //     "validator got data",
                    //     //     data,
                    //     //     JSON.stringify(schema, null, 4)
                    //     // )
                    // ),
                    map((data) =>
                        !schema || skipPresets ? data : jsonPreset(schema, data)
                    ),
                    map((data) => {
                        for (const key in data) {
                            if (data[key]?.items) {
                                delete data[key].items;
                            }
                        }
                        return data;
                    }),
                    filter((data) => {
                        // console.log("json preset?", data);
                        if (skipValidation || !schema) return true;
                        if (!data) return false;

                        const ajv = new Ajv(ajvConfig);
                        addFormats(ajv);
                        const validate = ajv.compile(schema);
                        const valid = validate(data);
                        if (!valid && strict) {
                            throw new Error(
                                `Input does not match schema: ${ajv.errorsText()}`
                            );
                        }
                        // console.log(
                        //     "Valid",
                        //     valid,
                        //     JSON.stringify(schema, null, 2),
                        //     ajv.errorsText()
                        // );
                        return valid;
                    })
                );
            }),
            node.log("validator: validated data")
        );
    };

export default validator;
