import { jsonPreset } from "https://esm.sh/json-schema-preset";
import empty from "https://esm.sh/json-schema-empty";
import Ajv from "https://esm.sh/ajv";
import {
    withLatestFrom,
    map,
    pipe,
    switchMap,
    combineLatest,
    tap,
    merge,
} from "rxjs";

export const type = "ingress";
export const key = "default-ingress";
export const version = "0.0.1";

export const configSchema = () =>
    map(() => {
        const schema = {
            type: "object",
            properties: {
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
                    enum: ["merge"], //TODO: , "combineLatest", "forkJoin", "zip"],
                    default: "merge",
                },
            },
            required: ["ajv"],
        };

        return schema;
    });

function log(node, message) {
    return tap((value) => node.log$.next({ message, value }));
}

const DefaultIngress = ({ config, node }) => {
    return pipe(
        log(node, "DefaultIngress got upstream"),
        switchMap((upstream) => {
            return combineLatest(
                upstream.map((node) =>
                    node.schemas$.pipe(map((schemas) => ({ node, schemas })))
                )
            ).pipe(
                log(node, "DefaultIngress got upstreams with schemas"),
                withLatestFrom(node.schemas$),
                log(
                    node,
                    "DefaultIngress got upstreams with schemas and self schema"
                ),
                switchMap(([inputNodeSchemas, { inputSchema }]) => {
                    const matchedInput = inputNodeSchemas.filter(
                        ({ schemas: { outputSchema } }) => {
                            const test = jsonPreset(
                                outputSchema,
                                empty(outputSchema)
                            );

                            const ajv = new Ajv(config.ajv);
                            const valid = ajv.validate(inputSchema, test);
                            return valid;
                        }
                    );

                    const unmatchedInput = inputNodeSchemas.filter((obj) => {
                        !matchedInput.includes(obj);
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
                        // case "zip":
                        //     joinOperator = zip;
                        //     break;
                        default:
                            joinOperator = merge;
                    }

                    console.log("matched", matchedInput.length);
                    console.log("unmatched", unmatchedInput.length);

                    return merge(
                        ...matchedInput.map(({ node }) => node.output$)
                    ).pipe(
                        log(node, "DefaultIngress got matched upstream event"),
                        ...(unmatchedInput.length > 0
                            ? [
                                  withLatestFrom(
                                      ...unmatchedInput.map(
                                          ({ node }) => node.output$
                                      )
                                  ),
                              ]
                            : []),
                        log(
                            node,
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
