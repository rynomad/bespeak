import Node from "../modules/node.mjs";
import "../modules/bootload.mjs";
import schinquirer from "https://esm.sh/@luismayo/schinquirer";
import { take } from "npm:rxjs@^7.8.1";
import { key, version } from "../modules/importModuleFromCode.mjs";
import * as _readability from "../modules/readability.mjs";
import { withLatestFrom } from "npm:rxjs@^7.8.1";
import { getText } from "../modules/util.mjs";

const importModuleFromCode = new Node("importModuleFromCode");

const fs = new Node("fs");

fs.write$$("system", {
    process: `fs@0.0.1`,
}).subscribe(() => {
    console.log("fs wrote system");
});

fs.write$$("process:config", {
    directory: "./pages",
}).subscribe(() => {
    console.log("fs wrote config");
});

const readability = new Node("readability");
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
// const cwd = Deno.realPathSync(".");
const path = Deno.args[0];
// const absolutePath = `${cwd}/${path}`;

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

const requirements = new Node("requirements");

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
            prompt: [
                "You will invoke the readability function to read any documentation referenced in the requirements.",
                "You will report the portion of relevant documentation back.",
                "You will include all relevant interfaces and code samples or examples you find.",
                "You MUST follow every provided link before beginning your response.",
                "You MAY follow links you find within the documentation.",
                "You SHOULD research thoroughly before responding.",
                "If there are no links provided, simply acknowledge that there is no research to be done.",
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
        advanced: {
            model: "gpt-4-1106-preview",
            cleanup: "system",
            role: "system",
        },
    })
    .subscribe(() => {
        console.log("requirements wrote config");
    });

const docs = new Node("docs");

requirements.upstream$.next([docs]);

docs.write$$("process:config", {
    basic: {
        prompt: [
            "You are tasked with developing an rxjs operator for the user.",
            "The user has provided the requirements above.",
            "You will invoke the provided fs function to read documentation about the system the operator will be used in.",
            "You will report the portion of relevant documentation back.",
            "You MUST include all relevant interfaces and function signatures.",
            "You MUST include all relevant examples and code snippets.",
            "Note: sometimes the code snippets will be indented, don't miss them.",
            "You MUST begin by reading `operators.md` and `nodes.md`.",
            "You SHOULD continually follow links you find within the documentation that look relevant to the requirements.",
            "(links are identified by [[double bracket]] syntax. e.g. [[operators]] is a link to operators.md and [[schema roles]] is a linke to 'schema roles.md' (do not replace spaces with dashes))",
            "You MUST research thoroughly before responding.",
            "You MUST be detailed and thorough in your response.",
            "If in doubt about somethings relevance, include it anyway.",
        ].join("\n"),
    },
    advanced: {
        model: "gpt-4-1106-preview",
        cleanup: "system",
        role: "system",
    },
}).subscribe(async () => {
    console.log("docs wrote config");
    docs.input$.next({
        messages: [
            {
                role: "user",
                content: await getText(path),
            },
        ],
    });
});

docs.flowTools$.next([fs]);

const signature = new Node("signature");

signature
    .write$$("process:config", {
        basic: {
            prompt: [
                "You are working on developing an rxjs operator for the user.",
                "Based on the requirements, documentation, and schemas you provided above, you will write a complete implementation of the operator factory:",
                "here's  a reminder of the requirements:",
                await getText(path),
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

const schemas = new Node("schemas");

schemas
    .write$$("process:config", {
        basic: {
            prompt: [
                "Based on the documentation you provided above, implement the operator acoording to the requirements:",
                "Your output MUST obey the conventions of the system you are working in.",
                "Your output MUST fulfill all the requirements.",
                "here's  a reminder of the requirements:",
                await getText(path),
            ].join("\n"),
        },
        advanced: {
            model: "gpt-4",
            role: "user",
        },
    })
    .subscribe(() => {});

schemas.upstream$.next([requirements]);

const test = new Node("test");

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

const finalize = new Node("finalize");
finalize.upstream$.next([schemas]);

finalize
    .write$$("process:config", {
        basic: {
            prompt: [
                "Please review the operator you have written, and ensure that it meets the following requirements.",
                "If it does not, please make the necessary changes and provide the full operator module.",
                "Be sure to include all exports appropriate for an operator according to the documentation above",
                await getText(path),
            ].join("\n"),
        },
        advanced: {
            model: "gpt-4",
        },
    })
    .subscribe(() => {});

const review = new Node("review");
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

const testRunner = new Node("testRunner");

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

const filterImportFailed = new Node("filterImportFailed");
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

const filterImportPassed = new Node("filterImportPassed");
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

const filterFailed = new Node("filterFailed");

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

const filterPassed = new Node("filterPassed");

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

const normalizeError = new Node("normalizeError");

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

const recurseError = new Node("recurseError");

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
    docs,
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
        console.log("finalizeOutput\n", finalizeOutput);
    });
