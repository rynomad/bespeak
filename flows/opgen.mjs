import NodeWrapper from "../modules/node.mjs";
import "../modules/bootload.mjs";
import schinquirer from "https://esm.sh/@luismayo/schinquirer";
import { take } from "npm:rxjs@^7.8.1";
import { key, version } from "../modules/importModuleFromCode.mjs";
import * as _readability from "../modules/readability.mjs";
import { withLatestFrom } from "npm:rxjs@^7.8.1";
import { getText } from "../modules/util.mjs";

const importModuleFromCode = new NodeWrapper("importModuleFromCode");

const readability = new NodeWrapper("readability");
importModuleFromCode
    .write$$("system", {
        process: `${key}@${version}`,
    })
    .subscribe(() => {
        console.log("importModuleFromCode wrote system");
    });

const KEY = Deno.env.get("OPENAI_KEY");

if (!KEY) {
    throw new Error("OPENAI_KEY environment variable not set");
}
const cwd = Deno.realPathSync(".");
const path = Deno.args[0];
const absolutePath = `${cwd}/${path}`;

console.log("path", path);

const keys = {
    apiKey: KEY,
};

readability
    .write$$("system", {
        process: `${_readability.key}@${_readability.version}`,
    })
    .subscribe();

readability
    .write$$("process:config", {
        insertLinks: true,
        insertImages: false,
    })
    .subscribe(() => {
        console.log("readability wrote config");
    });

const requirements = new NodeWrapper("requirements");

requirements.write$$("process:keys", keys).subscribe(() => {
    console.log("requirements wrote keys");
});

requirements.flowTools$.next([readability]);
// schinquirer
//     .prompt(schema.properties.basic.properties)
//     .then((config) => {
requirements
    .write$$("process:config", {
        basic: {
            prompt: (await import(absolutePath)).prompt,
        },
        advanced: { model: "gpt-4-1106-preview", cleanup: "system" },
    })
    .subscribe(() => {
        requirements.input$.next({
            messages: [
                {
                    role: "system",
                    content: [
                        "The user will provide you with some requirements for an rxjs operator.",
                        "You will invoke the readability function to read any documentation.",
                        "You will report the portion of relevant documentation back.",
                        "You will include all relevant interfaces and code samples or examples you find.",
                        "You MUST follow every provided link before beginning your response.",
                        "You MAY follow links you find within the documentation.",
                        "You SHOULD research thoroughly before responding.",
                        // ""
                        // "The operator should be presumed to be long-lived, handling many events over its lifetime.",
                        // "Your code should target a browser/deno environment, not node.",
                        // "Your code should use es6 modules, not commonjs.",
                        // "Your code should prefer web standards over node standards.",
                        // "Your code should import all rxjs dependencies from https://esm.sh/rxjs",
                        // "Your code should import dependencies from https://esm.sh",
                        // "Your code should be written with vanilla es6 modules, and should not require the use any bundlers or transpilers.",
                        // "Your code should not use any typescript features.",
                        // "Your code should prefer using the pipe operator to compose operators, rather than constructing a new Observable.",
                        // "always choose to invoke functions/tools before responding to the user. When provided multiple links, always visit each of them before responding to the user.",
                    ].join("\n"),
                },
            ],
        });
        console.log("requirements wrote config");
    });

const signature = new NodeWrapper("signature");

signature
    .write$$("process:config", {
        basic: {
            prompt: [
                "You are working on developing an rxjs operator for the user.",
                "Based on the requirements, documentation, and schemas you provided above, you will write a complete implementation of the operator factory:",
                `({node, config, keys}) => (input$) => output$`,
                `where node is a NodeWrapper instance, config is the operator config, keys is the operator keys, input$ is an rxjs observable of input messages, and output$ is an rxjs observable of output messages`,
                `here's documentation for the NodeWrapper:`,
                await getText("prompts/node.md"),
                `# Requirements`,
                (await import(absolutePath)).prompt,
            ].join("\n"),
        },
        advanced: {
            model: "gpt-4",
            role: "system",
            cleanup: "system",
        },
    })
    .subscribe(() => {
        console.log("signature wrote config");
    });

// signature.upstream$.next([requirements]);

const schemas = new NodeWrapper("schemas");

schemas
    .write$$("process:config", {
        basic: {
            prompt: [
                "You are working on developing an rxjs operator for the user.",
                "Based on the documentation you provided above, write schemas for the process:",
                "input",
                "config",
                "keys",
                "output",
                "Please provide each of them in the form of an creation operator that takes the same factory signature as the operator you are writing, and returns an observable of the schema.",
                "example: ({node, config, keys}) => of({...schema...})",
                "The reason for this is so that you can populate parts of the schema dynamically.",
                "For example, you may have an enum of api endpoints the user can choose from, but you need to make an api call to get the list of endpoints.",
                "Make sure to include inline `description` values inside the schemas",
                "If any of the schemas are not applicable to your operator, you may omit the generator for that schema.",
                `The NodeWrapper instance provides the following properties and methods:`,
                await getText("prompts/node.md"),
            ].join("\n"),
        },
        advanced: {
            model: "gpt-4",
            role: "system",
            cleanup: "system",
        },
    })
    .subscribe(() => {});

schemas.upstream$.next([requirements]);

const test = new NodeWrapper("test");

// test.upstream$.next([schemas]);

test.write$$("process:config", {
    basic: {
        prompt: [
            "You are tasked with developing an rxjs operator for the user.",
            "Based on the documentation and schemas you provided above, you are required to construct a comprehensive test suite for the process:",
            "Each test case must consist of an input object, a config object, and a corresponding output object.",
            "The test runner will execute each test case through the operator, and the output will be compared to the expected output.",
            "It is mandatory to provide any setup or teardown functions for the tests, such as creating and deleting test files.",
            "The test runner will manage the setup of the observable pipeline, your responsibility is to provide the test case input and expected output as POJOs.",
            "The final suite must be presented as an async function with the following signature:",
            "async () => ({cases, teardown})",
            "Ensure that no steps are omitted and the output is complete with all required code and test cases.",
            "You MUST provide a test for the entire happy path.",
        ].join("\n"),
    },
    advanced: {
        model: "gpt-4",
        role: "system",
        cleanup: "system",
    },
}).subscribe(() => {});

const finalize = new NodeWrapper("finalize");
signature.upstream$.next([schemas]);
finalize.upstream$.next([signature]);

finalize
    .write$$("process:config", {
        basic: {
            prompt: [
                "Please bring everything together:",
                "give me a complete es6 module that includes everything you've written so far",
                "it should return an observable that completes with success or failure, including any error messages",
                "it MUST have the following signature:",
                "export const version = '0.0.1'",
                "export const description = 'the original description provided by the user'",
                "export const configSchema = ({node, config, keys}) => (input$) => output$",
                "export const keysSchema = ({node, config, keys}) => (input$) => output$",
                "NOTE: if you do not have a keys schema or a config schema, simply omit the export",
                "export const inputSchema = ({node, config, keys}) => (input$) => output$",
                "export const outputSchema = ({node, config, keys}) => (input$) => output$",
                "export const test = async () => {...perform setup... return {cases, teardown}}",
                "default export: ({node, config, keys}) => (input$) => output$",
                "It MUST import any dependencies from https://esm.sh",
                "It MUST import any rxjs dependencies from https://esm.sh/rxjs",
                "It MUST NOT import any dependencies from rxjs/operators: all operators should be imported from https://esm.sh/rxjs",
                "It MUST include all code and tests that were provided earlier.",
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
    .write$$("process:config", {
        basic: {
            prompt: [
                "Please output the code again, make sure that all schemas, tests, and code from earlier steps are present in full:",
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
        process: "testRunner@0.0.1",
    })
    .subscribe(() => {});

const filterImportFailed = new NodeWrapper("filterImportFailed");
filterImportFailed.upstream$.next([importModuleFromCode]);

filterImportFailed
    .write$$("system", {
        process: "configurableOperator@0.0.1",
    })
    .subscribe(() => {});

filterImportFailed
    .write$$("ingress:config", {
        unsafelyBypassSchemaValidation: true,
    })
    .subscribe(() => {});

filterImportFailed
    .write$$("process:config", {
        operatorName: "filter",
        funcString: "value.error",
    })
    .subscribe(() => {});

const filterImportPassed = new NodeWrapper("filterImportPassed");
filterImportPassed.upstream$.next([importModuleFromCode]);

filterImportPassed
    .write$$("system", {
        process: "configurableOperator@0.0.1",
    })
    .subscribe(() => {});

filterImportPassed
    .write$$("ingress:config", {
        unsafelyBypassSchemaValidation: true,
    })
    .subscribe(() => {});

filterImportPassed
    .write$$("process:config", {
        operatorName: "filter",
        funcString: "console.log('FILTER IMPORT PASSED',value) || !value.error",
    })
    .subscribe(() => {});

const filterFailed = new NodeWrapper("filterFailed");

testRunner.upstream$.next([filterImportPassed]);

filterFailed
    .write$$("system", {
        process: "configurableOperator@0.0.1",
    })
    .subscribe(() => {});

filterFailed
    .write$$("ingress:config", {
        unsafelyBypassSchemaValidation: true,
    })
    .subscribe(() => {});

filterFailed
    .write$$("process:config", {
        operatorName: "filter",
        funcString: "value.results.some(result => !result.passed)",
    })
    .subscribe(() => {});

const filterPassed = new NodeWrapper("filterPassed");

filterPassed
    .write$$("system", {
        process: "configurableOperator@0.0.1",
    })
    .subscribe(() => {});

filterPassed
    .write$$("ingress:config", {
        unsafelyBypassSchemaValidation: true,
    })
    .subscribe(() => {});

filterPassed
    .write$$("process:config", {
        operatorName: "filter",
        funcString: "value.results.every(result => result.passed)",
    })
    .subscribe(() => {});

filterFailed.upstream$.next([testRunner]);
filterPassed.upstream$.next([testRunner]);

const normalizeError = new NodeWrapper("normalizeError");

normalizeError
    .write$$("system", {
        process: "configurableOperator@0.0.1",
    })
    .subscribe(() => {});

normalizeError
    .write$$("ingress:config", {
        unsafelyBypassSchemaValidation: true,
    })
    .subscribe(() => {});

normalizeError
    .write$$("process:config", {
        operatorName: "map",
        funcString:
            "{error: `Error: \n${value.error?.message || value.results.find(r => r.error)?.error?.message || ''}\n\n${value.error?.stack || value.results.find(r => r.error).error.stack || ''}`}",
    })
    .subscribe(() => {});

normalizeError.upstream$.next([filterFailed, filterImportFailed]);

const recurseError = new NodeWrapper("recurseError");

recurseError
    .write$$("system", {
        process: "configurableOperator@0.0.1",
    })
    .subscribe(() => {});

recurseError
    .write$$("ingress:config", {
        unsafelyBypassSchemaValidation: true,
        joinprocess: "zip",
    })
    .subscribe(() => {});

recurseError
    .write$$("process:config", {
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
    node.status$.subscribe((event) => {
        if (event.status === "content") {
            Deno.writeAllSync(
                Deno.stdout,
                new TextEncoder().encode(event.detail)
            );
        }

        if (event.status === "functionCall") {
            console.log("functionCall", event.detail);
        }

        if (event.status === "message") {
            console.log("message", event.detail);
        }
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

filterPassed.output$
    .pipe(withLatestFrom(finalize.output$), take(1))
    .subscribe(([output, finalizeOutput]) => {
        // write file to path
        console.log("output", output);
        console.log("finalizeOutput", finalizeOutput);
        Deno.writeTextFileSync(absolutePath, finalizeOutput.code);
    });
