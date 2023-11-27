import { jsonPreset } from "https://esm.sh/json-schema-preset";
import empty from "https://esm.sh/json-schema-empty";
import Ajv from "https://esm.sh/ajv";
import {
    withLatestFrom,
    map,
    zip,
    pipe,
    switchMap,
    combineLatest,
    merge,
    of,
} from "rxjs";

export const role = "ingress";
export const key = "default-ingress";
export const version = "0.0.1";

export const configSchema = () =>
    of({
        type: "object",
        properties: {
            unsafelyBypassSchemaValidation: {
                type: "boolean",
                default: false,
                description:
                    "If true, will not validate the upstream output schema against the downstream input schema",
            },
            ajv: {
                type: "object",
                description:
                    "Ajv configuration for matching upstream output schema with downstream input schema",
                properties: {
                    strict: {
                        type: "boolean",
                        default: false,
                    },
                },
                required: ["strict"],
            },
            joinOperator: {
                type: "string",
                description:
                    "RxJS operator for joining upstream output streams",
                enum: ["merge", "zip"], //TODO: , "combineLatest", "forkJoin", "zip"],
                default: "merge",
            },
        },
        required: ["ajv"],
    });

const DefaultIngress =
    ({ config, node }) =>
    (source$) => {
        return combineLatest(source$, node.schema$$("operator:input")).pipe(
            node.log("DefaultIngress got upstream"),
            switchMap(([upstream, inputSchema]) => {
                return combineLatest(
                    ...upstream.map((node) => node.schema$$("operator:output"))
                ).pipe(
                    node.log(
                        "DefaultIngress got upstreams with schemas and self schema"
                    ),
                    switchMap((inputNodeSchemas) => {
                        const matchedInput = [];
                        const unmatchedInput = [];
                        inputNodeSchemas.forEach((outputSchema, i) => {
                            if (config.unsafelyBypassSchemaValidation) {
                                matchedInput.push(upstream[i]);
                                return;
                            }
                            const test = jsonPreset(
                                outputSchema,
                                empty(outputSchema)
                            );

                            const ajv = new Ajv(config.ajv);
                            const valid = ajv.validate(inputSchema, test);
                            if (valid) {
                                matchedInput.push(upstream[i]);
                            } else {
                                unmatchedInput.push(upstream[i]);
                            }
                        });

                        let joinOperator;
                        switch (config.joinOperator) {
                            // case "merge":
                            //     joinOperator = merge;
                            //     break;
                            // case "combineLatest":
                            //     joinOperator = combineLatest;
                            //     break;
                            // case "forkJoin":
                            //     joinOperator = forkJoin;
                            //     break;
                            case "zip":
                                joinOperator = zip;
                                break;
                            default:
                                joinOperator = merge;
                        }

                        return joinOperator(
                            ...matchedInput.map((node) => node.output$)
                        ).pipe(
                            node.log(
                                "DefaultIngress got matched upstream event"
                            ),
                            ...(unmatchedInput.length > 0
                                ? [
                                      withLatestFrom(
                                          ...unmatchedInput.map(
                                              ({ node }) => node.output$
                                          )
                                      ),
                                  ]
                                : []),
                            node.log(
                                "DefaultIngress got unmatched upstream event"
                            ),
                            map((args) => {
                                let matched, unmatched;
                                if (unmatchedInput.length === 0) {
                                    matched = args;
                                    unmatched = [];
                                } else {
                                    matched = args.slice(0, 1);
                                    unmatched = args.slice(matchedInput.length);
                                }
                                return {
                                    ...matched,
                                    context: unmatched.reduce(
                                        (acc, curr, index) => {
                                            return {
                                                ...acc,
                                                [unmatchedInput[index].node.id]:
                                                    curr,
                                            };
                                        },
                                        {}
                                    ),
                                };
                            })
                        );
                    })
                );
            })
        );
    };

export default DefaultIngress;
