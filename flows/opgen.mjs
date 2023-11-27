import NodeWrapper from "../modules/node.mjs";
import "../modules/bootload.mjs";
import schinquirer from "https://esm.sh/@luismayo/schinquirer";
import { take } from "npm:rxjs@^7.8.1";
import { key, version } from "../modules/importModuleFromCode.mjs";

const importModuleFromCode = new NodeWrapper("importModuleFromCode");

importModuleFromCode
    .write$$("system", {
        operator: `${key}@${version}`,
    })
    .subscribe(() => {
        console.log("importModuleFromCode wrote system");
    });

const KEY = Deno.env.get("OPENAI_KEY");

if (!KEY) {
    throw new Error("OPENAI_KEY environment variable not set");
}

const keys = {
    apiKey: KEY,
};

const requirements = new NodeWrapper("requirements");

requirements.write$$("operator:keys", keys).subscribe(() => {
    console.log("requirements wrote keys");
});

requirements
    .schema$$("operator:config")
    .pipe(take(1))
    .subscribe(async (schema) => {
        // schinquirer
        //     .prompt(schema.properties.basic.properties)
        //     .then((config) => {
        requirements
            .write$$("operator:config", {
                basic: {
                    prompt: (await import("../modules/readability.mjs"))
                        .description,
                },
                advanced: { model: "gpt-4" },
            })
            .pipe(take(1))
            .subscribe(() => {
                requirements.input$.next({
                    messages: [
                        {
                            role: "system",
                            content: [
                                "The user will provide you with some requirements for an rxjs operator, you will respond with draft code for the operator. Make it as complete as possible",
                                "The operator should be presumed to be long-lived, handling many events over its lifetime.",
                                "Your code should target a browser/deno environment, not node.",
                                "Your code should use es6 modules, not commonjs.",
                                "Your code should prefer web standards over node standards.",
                                "Your code should import all rxjs dependencies from https://esm.sh/rxjs",
                                "Your code should import dependencies from https://esm.sh",
                                "Your code should be written with vanilla es6 modules, and should not require the use any bundlers or transpilers.",
                                "Your code should not use any typescript features.",
                                "Your code should prefer using the pipe operator to compose operators, rather than constructing a new Observable.",
                            ].join("\n"),
                        },
                    ],
                });
                console.log("requirements wrote config");
            });
    });
// });

const signature = new NodeWrapper("signature");

signature
    .write$$("operator:config", {
        basic: {
            prompt: [
                "please make the operator factory signature match the following:",
                `({node, config, keys}) => (input$) => output$`,
                `where node is a NodeWrapper instance, config is the operator config, keys is the operator keys, input$ is an rxjs observable of input messages, and output$ is an rxjs observable of output messages`,
                `Config and Keys are optional, it is up to you to decide how to use them.`,
                `Keys should be used if there are any api keys that should be shared by all instances of this operator.`,
                `Config should be used if there are any config values that should be applied to each invokation of this operator within a given pipeline.`,
                `Input and Output schemas should be objects, not primitive types.`,
                `input and output should be objects, not primitive values.`,
                `The NodeWrapper instance provides the following properties and methods:`,
                `node.log(): a custom logging operator, it can be inserted directly into a pipeline, it does not need to be wrapped in a tap:`,
                `pipe(operator1(...), node.log('operator1 done'), operator2(...))`,
            ].join("\n"),
        },
        advanced: {
            model: "gpt-4",
        },
    })
    .subscribe(() => {
        console.log("signature wrote config");
    });

signature.upstream$.next([requirements]);

const schemas = new NodeWrapper("schemas");

schemas
    .write$$("operator:config", {
        basic: {
            prompt: [
                "Please provide the schemas for the following, as necessary:",
                "input",
                "config",
                "keys",
                "output",
                "Please provide each of them in the form of an creation operator that takes the same factory signature as the operator you are writing, and returns an observable of the schema.",
                "example: ({node, config, keys}) => of({...schema...})",
                "If any of the schemas are not applicable to your operator, you may omit the generator for that schema.",
            ].join("\n"),
        },
        advanced: {
            model: "gpt-4",
        },
    })
    .subscribe(() => {});

schemas.upstream$.next([signature]);

const test = new NodeWrapper("test");

test.upstream$.next([schemas]);

test.write$$("operator:config", {
    basic: {
        prompt: [
            "Please provide a few test cases for your operator.",
            "Each test case should be an input object, config object, and a matching output object.",
            "The test runner will run each test case through the operator, and compare the output to the expected output.",
            "you should also provide any setup or teardown functions for the tests (for example, creating and cleaning up test files).",
            "The test runner will handle setting up the observable pipeline, your test case input and expected output must be provided as POJOs.",
        ].join("\n"),
    },
    advanced: {
        model: "gpt-4",
    },
}).subscribe(() => {});

const finalize = new NodeWrapper("finalize");
finalize.upstream$.next([test]);

finalize
    .write$$("operator:config", {
        basic: {
            prompt: [
                "Please bring everything together:",
                "give me a complete es6 module that includes everything you've written so far",
                "it should return an observable that completes with success or failure, including any error messages",
                "it MUST have the following signature:",
                "export const version = '0.0.1'",
                "export const description = 'a description of your operator'",
                "export const configSchema = ({node, config, keys}) => (input$) => output$ OR null",
                "export const keysSchema = ({node, config, keys}) => (input$) => output$ OR null",
                "export const inputSchema = ({node, config, keys}) => (input$) => output$",
                "export const outputSchema = ({node, config, keys}) => (input$) => output$",
                "export const test = async () => {...perform setup... return {cases, teardown}}",
                "default export: ({node, config, keys}) => (input$) => output$",
                "It MUST import any dependencies from https://esm.sh",
                "It MUST import any rxjs dependencies from https://esm.sh/rxjs",
                "It MUST NOT import any dependencies from rxjs/operators: all operators should be imported from https://esm.sh/rxjs",
                "It MUST NOT omit any code or tests that were provided earlier.",
            ].join("\n"),
        },
        advanced: {
            model: "gpt-4",
        },
    })
    .subscribe(() => {});

const review = new NodeWrapper("review");
review.upstream$.next([finalize]);

review
    .write$$("ingress:config", {
        unsafelyBypassSchemaValidation: true,
    })
    .subscribe(() => {});

review
    .write$$("operator:config", {
        basic: {
            prompt: [
                "Please review the code, and make any changes you see fit:",
                "If you see any errors, please fix them.",
                "If you see any opportunities for improvement, please make them.",
                "If you see any opportunities for optimization, please make them.",
                "If you see any opportunities for refactoring, please make them.",
                "If you see any opportunities for simplification, please make them.",
                "If you see any opportunities for clarification, please make them.",
                "\n",
                "Please do not change the signature of the operator.",
                "Please do not change the schemas of the operator.",
                "Please do not change the test of the operator.",
                "Please do not change the description of the operator.",
                "Please do not change the version of the operator.",
                "Please do not change the key of the operator.",
                "Please do not change the default export of the operator.",
                "\n",
                "Please output the entire source code, not just the changes you made.",
            ].join("\n"),
        },
        advanced: {
            model: "gpt-4",
        },
    })
    .subscribe(() => {});

importModuleFromCode.upstream$.next([review]);

const testRunner = new NodeWrapper("testRunner");

testRunner
    .write$$("ingress:config", {
        unsafelyBypassSchemaValidation: true,
    })
    .subscribe(() => {});

testRunner
    .write$$("system", {
        operator: "testRunner@0.0.1",
    })
    .subscribe(() => {});

const filterImportFailed = new NodeWrapper("filterImportFailed");
filterImportFailed.upstream$.next([importModuleFromCode]);

filterImportFailed
    .write$$("system", {
        operator: "configurableOperator@0.0.1",
    })
    .subscribe(() => {});

filterImportFailed
    .write$$("ingress:config", {
        unsafelyBypassSchemaValidation: true,
    })
    .subscribe(() => {});

filterImportFailed
    .write$$("operator:config", {
        operatorName: "filter",
        funcString: "value.error",
    })
    .subscribe(() => {});

const filterImportPassed = new NodeWrapper("filterImportPassed");
filterImportPassed.upstream$.next([importModuleFromCode]);

filterImportPassed
    .write$$("system", {
        operator: "configurableOperator@0.0.1",
    })
    .subscribe(() => {});

filterImportPassed
    .write$$("ingress:config", {
        unsafelyBypassSchemaValidation: true,
    })
    .subscribe(() => {});

filterImportPassed
    .write$$("operator:config", {
        operatorName: "filter",
        funcString: "console.log('FILTER IMPORT PASSED',value) || !value.error",
    })
    .subscribe(() => {});

const filterFailed = new NodeWrapper("filterFailed");

testRunner.upstream$.next([filterImportPassed]);

filterFailed
    .write$$("system", {
        operator: "configurableOperator@0.0.1",
    })
    .subscribe(() => {});

filterFailed
    .write$$("ingress:config", {
        unsafelyBypassSchemaValidation: true,
    })
    .subscribe(() => {});

filterFailed
    .write$$("operator:config", {
        operatorName: "filter",
        funcString: "value.results.some(result => !result.passed)",
    })
    .subscribe(() => {});

const filterPassed = new NodeWrapper("filterPassed");

filterPassed
    .write$$("system", {
        operator: "configurableOperator@0.0.1",
    })
    .subscribe(() => {});

filterPassed
    .write$$("ingress:config", {
        unsafelyBypassSchemaValidation: true,
    })
    .subscribe(() => {});

filterPassed
    .write$$("operator:config", {
        operatorName: "filter",
        funcString: "value.results.every(result => result.passed)",
    })
    .subscribe(() => {});

filterFailed.upstream$.next([testRunner]);
filterPassed.upstream$.next([testRunner]);

const normalizeError = new NodeWrapper("normalizeError");

normalizeError
    .write$$("system", {
        operator: "configurableOperator@0.0.1",
    })
    .subscribe(() => {});

normalizeError
    .write$$("ingress:config", {
        unsafelyBypassSchemaValidation: true,
    })
    .subscribe(() => {});

normalizeError
    .write$$("operator:config", {
        operatorName: "map",
        funcString:
            "{error: `Error: \n${value.error?.message || value.results.find(r => r.error)?.error?.message || ''}\n\n${value.error?.stack || value.results.find(r => r.error).error.stack || ''}`}",
    })
    .subscribe(() => {});

normalizeError.upstream$.next([filterFailed, filterImportFailed]);

const recurseError = new NodeWrapper("recurseError");

recurseError
    .write$$("system", {
        operator: "configurableOperator@0.0.1",
    })
    .subscribe(() => {});

recurseError
    .write$$("ingress:config", {
        unsafelyBypassSchemaValidation: true,
        joinOperator: "zip",
    })
    .subscribe(() => {});

recurseError
    .write$$("operator:config", {
        operatorName: "map",
        funcString:
            "{ messages: [{ role: 'user', content: `Source:\n\n${value[0].code}` }, {role: 'user', content: value[1].error}] }",
    })
    .subscribe(() => {});

recurseError.upstream$.next([review, normalizeError]);

review.upstream$.next([finalize, recurseError]);

[
    requirements,
    signature,
    schemas,
    test,
    finalize,
    review,
    importModuleFromCode,
    testRunner,
    filterFailed,
    filterPassed,
    filterImportFailed,
    filterImportPassed,
    normalizeError,
    recurseError,
].forEach((node) => {
    node.status$.subscribe((status) => {
        const text = new TextEncoder().encode(status.detail?.chunk || "\n");
        Deno.writeAllSync(Deno.stdout, text);
    });
    node.output$.subscribe((output) => {
        console.log(node.id, "output", output.messages || output);
    });
    node.input$.subscribe((input) => {
        console.log(node.id, "input", input.messages || input);
    });
    node.error$.subscribe((error) => {
        console.error(node.id, "error", error);
    });
});

filterImportPassed.log$.subscribe(({ message, value, callSite }) => {
    // const DEBUG = Deno.env.get("DEBUG");
    // if (!DEBUG) return;
    // if (DEBUG === "dots") {
    //     const text = new TextEncoder().encode(".");
    //     Deno.writeAllSync(Deno.stdout, text);
    // } else if (DEBUG === "log") {
    // console.log("review log", message, callSite);
    // }
});
