import {
    catchError,
    finalize,
    map,
    mergeMap,
    of,
    withLatestFrom,
    toArray,
} from "https://esm.sh/rxjs";
import { deepEqual } from "https://esm.sh/fast-equals";

// TestRunner Operator
const testRunner =
    ({ node, config = {}, keys = {} }) =>
    (source) =>
        source.pipe(
            mergeMap(async ({ module }) => {
                const testResults = [];
                const { cases, teardown } = await module.test();
                for (const testcase of cases) {
                    try {
                        await new Promise((resolve, reject) => {
                            of(testcase.input)
                                .pipe(
                                    module.default({
                                        node,
                                        config: {
                                            ...config,
                                            ...testcase.config,
                                        },
                                        keys,
                                    }),
                                    catchError((err) => {
                                        reject(err);
                                        return of();
                                    }),
                                    node.log(`Test ${node.id} done`),
                                    finalize(resolve)
                                )
                                .subscribe({
                                    next: (output) => {
                                        if (
                                            !deepEqual(
                                                testcase.expectedOutput,
                                                output
                                            )
                                        ) {
                                            reject(
                                                new Error(
                                                    `Test failed: expected ${JSON.stringify(
                                                        testcase.expectedOutput
                                                    )}, got ${JSON.stringify(
                                                        output
                                                    )}`
                                                )
                                            );
                                        }
                                    },
                                    error: reject,
                                });
                        });
                        testResults.push({ passed: true });
                    } catch (err) {
                        testResults.push({ passed: false, error: err });
                    }
                }
                return testResults;
            }),
            withLatestFrom(source),
            map(([results, module]) => ({ module, results }))
        );

// Schemas
const inputSchema = () =>
    of({
        type: "object",
        properties: {
            module: {
                type: "object",
                properties: {},
                additionalProperties: true,
                description: "Function: Operator factory function",
            },
            test: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        input: {
                            type: "object",
                            properties: {},
                            additionalProperties: true,
                            description: "Object: Input to the operator",
                        },
                        config: {
                            type: "object",
                            properties: {},
                            additionalProperties: true,
                            description: "Object: Config for the operator",
                        },
                        expectedOutput: {
                            type: "object",
                            properties: {},
                            additionalProperties: true,
                            description: "Object: Expected output",
                        },
                    },
                    required: ["input", "config", "expectedOutput"],
                },
                description: "Array: Test cases array",
            },
        },
    });

const outputSchema = () =>
    of({
        type: "object",
        properties: {
            module: {
                type: "object",
                properties: {},
                additionalProperties: true,
                description: "Function: Operator factory function",
            },
            results: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        passed: {
                            type: "boolean",
                            description: "Boolean: Whether the test passed",
                        },
                        error: {
                            type: "object",
                            properties: {},
                            additionalProperties: true,
                            description: "Object: Error object",
                        },
                    },
                    required: ["passed"],
                },
                description: "Array: Test results array",
            },
        },
    });

// Test cases
const test = [];

// Metadata
export const key = "testRunner";
export const version = "0.0.1";
export const description = "An operator that runs tests on other operators";

export { inputSchema, outputSchema, test };
export default testRunner;
