import Node from "../modules/node.mjs";
import "../modules/bootload.mjs";
import { getText } from "../modules/util.mjs";

const header = new Node("header");

const readability = new Node("readability");
const fs = new Node("fs");

fs.write$$("system", {
    process: `fs@0.0.1`,
    description: [
        `This fs operator gives access to a directory containing markdown files.`,
        `you can read any file by giving only it's name: i.e. file: "readme.md" will get you the proper readme file without needing to worry about its path prefix`,
        `the documents are markdown from a logseq project`,
        `the files contain double bracket [[links]]. These links are used to navigate the documentation.`,
        `so if you encounter [[something interesting]], you can reinvoke the function to read that file with file: "something interesting.md"`,
        `you do not need to provide the path prefix, the fs tool will handle that for you`,
        `you do need to provide the .md extension, the fs tool will not add that for you`,
        `spaces are allowed in file names, the fs tool will handle that for you`,
        `you can read any file by giving only it's name: i.e. file: "readme.md" will get you the proper readme file without needing to worry about its path prefix`,
        `the user just gave you an entry point, you must follow links to find the information you need`,
    ].join("\n"),
}).subscribe(() => {
    console.log("fs wrote system");
});

fs.write$$("process:config", {
    directory: "./pages",
}).subscribe(() => {
    console.log("fs wrote config");
});

const KEY = Deno.env.get("OPENAI_KEY");

if (!KEY) {
    throw new Error("OPENAI_KEY environment variable not set");
}
const path = Deno.args[0];
const num = Deno.args[1];

const keys = {
    apiKey: KEY,
};

header.write$$("process:keys", keys).subscribe(() => {
    console.log("requirements wrote keys");
});

readability
    .write$$("system", {
        process: `readability@0.0.1`,
        description: [
            `This readability can be used to fetch urls and present them cleaned of most html.`,
            `It is configured to reinsert links back into the text`,
            `If you find a link that might be relevant, you can re-invoke the readability operator on that link to get the full text.`,
        ].join("\n"),
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

header.flowTools$.next([fs, readability]);

const schemas = new Node("schemas");

schemas
    .write$$("process:config", {
        basic: {
            prompt: [
                `Now write any schema operators`,
                `You should write all relevant schema operators.`,
                `always write schema operators for config, input, and output`,
                `if the process operator needs api keys, also provide a keys schema operator`,
                `Relevant docs to read with fs tool:`,
                `writing a process operator.md`,
                `schema operators.md`,
                `schema roles.md`,
                `schemas.md`,
                `process operators.md`,
                `remember to read all links provided in the requirements with the readability tool`,
                `remember to read all documentation provided above with the fs tool`,
                `remember to provide a complete and thorough implementation of the current step`,
                `remember to write code that matches the code you wrote earlier`,
            ].join("\n"),
        },
        advanced: {
            model: "gpt-4-1106-preview",
            role: "user",
        },
    })
    .subscribe(() => {
        console.log("schemas wrote config");
    });

schemas.flowTools$.next([fs, readability]);
const setup = new Node("setup");

setup
    .write$$("process:config", {
        basic: {
            prompt: [
                `Now, if applicable, write a setup operator`,
                `Relevant docs to read with fs tool:`,
                `writing a process operator.md`,
                `setup operator.md`,
                `remember to read all links provided in the requirements with the readability tool`,
                `remember to read all documentation provided above with the fs tool`,
                `remember to provide a complete and thorough implementation of the current step`,
                `remember to write code that matches the code you wrote earlier`,
            ].join("\n"),
        },
        advanced: {
            model: "gpt-4-1106-preview",
            role: "user",
        },
    })
    .subscribe(() => {
        console.log("schemas wrote config");
    });

setup.flowTools$.next([fs, readability]);
const tools = new Node("tools");

tools
    .write$$("process:config", {
        basic: {
            prompt: [
                `Now, if applicable, write a tool operator`,
                `Relevant docs to read with fs tool:`,
                `writing a process operator.md`,
                `tool operator.md`,
                `operable.md`,
                `schema roles.md`,
                `schemas.md`,
                `remember to read all links provided in the requirements with the readability tool`,
                `remember to read all documentation provided above with the fs tool`,
                `remember to provide a complete and thorough implementation of the current step`,
                `remember to write code that matches the code you wrote earlier`,
            ].join("\n"),
        },
        advanced: {
            model: "gpt-4-1106-preview",
            role: "user",
        },
    })
    .subscribe(() => {
        console.log("schemas wrote config");
    });

tools.flowTools$.next([fs, readability]);

const status = new Node("status");

status
    .write$$("process:config", {
        basic: {
            prompt: [
                `Now, if applicable, write a status operator`,
                `Before you begin, you should check the requirements and make sure to read any relevant web links with the readability tool`,
                `Relevant docs to read with fs tool:`,
                `writing a process operator.md`,
                `status operator.md`,
                `status messages.md`,
                `operable.md`,
                `remember to read all links provided in the requirements with the readability tool`,
                `remember to read all documentation provided above with the fs tool`,
                `remember to provide a complete and thorough implementation of the current step`,
                `remember to write code that matches the code you wrote earlier`,
            ].join("\n"),
        },
        advanced: {
            model: "gpt-4-1106-preview",
            role: "user",
        },
    })
    .subscribe(() => {
        console.log("schemas wrote config");
    });

status.flowTools$.next([fs, readability]);

const main = new Node("main");

main.write$$("process:config", {
    basic: {
        prompt: [
            `write the entire process operator, composing any setup, tool, and status operators to achieve the desired functionality.`,
            `Relevant docs to read with fs tool:`,
            `writing a process operator.md`,
            `process operators.md`,
            `setup operator.md`,
            `tool operator.md`,
            `status operator.md`,
            `remember to read all links provided in the original requirements with the readability tool`,
            `remember to read all documentation provided above with the fs tool`,
            `remember to provide a complete and thorough implementation of the current step`,
            `remember to write code that matches the code you wrote earlier`,
            `start by rewriting the header, schema operators, and any setup, tool, and status operators`,
            `then provide the default export that brings them all together`,
        ].join("\n"),
    },
    advanced: {
        model: "gpt-4-1106-preview",
        role: "user",
    },
}).subscribe(() => {
    console.log("schemas wrote config");
});

main.flowTools$.next([fs, readability]);

const unify = new Node("unify");

unify
    .write$$("process:config", {
        basic: {
            prompt: [
                `Now, it's time to get all the code in one place`,
                `After this step, your final message will be parsed and executed`,
                `It is imperative that you output a single markdown code block containing the entire process operator module.`,
                `You must include all required exports, with no comments.`,
                `You must read the entire process operator.md file with the fs tool to make sure you have all the required exports.`,
            ].join("\n"),
        },
        advanced: {
            model: "gpt-4-1106-preview",
            role: "user",
        },
    })
    .subscribe(() => {
        console.log("schemas wrote config");
    });

unify.flowTools$.next([fs, readability]);

const review = new Node("review");

review
    .write$$("process:config", {
        basic: {
            prompt: [
                `review the code against all relevant documentation, both web and local with fs and readability tools`,
                `make sure you have all the required exports`,
                `make sure the code properly implements all the required functionality`,
                `make sure there are no bugs`,
                `You must visit all links provided in the requirements with the readability tool before you begin your review`,
                `You must read all documentation provided above with the fs tool before you begin your review`,
                `After this step, your final message will be parsed and executed`,
                `It is imperative that you output a single markdown code block containing the entire process operator module.`,
                `You must include all required exports, with no comments.`,
                `You must read the entire process operator.md file with the fs tool to make sure you have all the required exports.`,
            ].join("\n"),
        },
        advanced: {
            model: "gpt-4-1106-preview",
            role: "user",
        },
    })
    .subscribe(() => {
        console.log("schemas wrote config");
    });

review.flowTools$.next([fs, readability]);

Node.$.subscribe((node) => {
    node.status$.subscribe((output) => {
        if (output.status === "content") {
            Deno.writeAllSync(
                Deno.stdout,
                new TextEncoder().encode(output.detail)
            );
        }

        if (output.status === "functionCall") {
            console.log("functionCall", output.detail.arguments);
        }

        if (output.status === "functionCallResult") {
            // console.log("functionCallResult", output.detail);
        }
    });

    node.input$.subscribe((input) => {
        console.log("input", input.messages && input);
    });

    node.output$.subscribe((output) => {
        console.log("output", output.messages && output);
    });
});

schemas.upstream$.next([header]);
setup.upstream$.next([schemas]);
tools.upstream$.next([setup]);
status.upstream$.next([tools]);
main.upstream$.next([status]);
unify.upstream$.next([main]);
review.upstream$.next([unify]);

review.output$.subscribe((output) => {
    const filename = `./modules/${
        path.split("/").pop().split(" ")[0]
    }.${num}.mjs`;
    Deno.writeTextFileSync(filename, output.code);
    Deno.exit();
});

header
    .write$$("process:config", {
        basic: {
            prompt: [
                `Start by writing the header`,
                `Relevant documents to read with the fs tool:`,
                `writing a process operator.md`,
                `process operators.md`,
            ].join("\n"),
        },
        advanced: {
            model: "gpt-4-1106-preview",
            role: "user",
        },
    })
    .subscribe(async () => {
        header.input$.next({
            messages: [
                {
                    role: "system",
                    content: [
                        "The user will privde you with a set of requirements for a process operator.",
                        "The user will then guide you step by step through the process of writing the operator.",
                        "The requirements may include web links, which you should read via the readability function if and only if they are relevant to the current step.",
                        "If you are uncertain whether a web link is relevant for a given step, you MUST read it.",
                        "The user will provide you with a set of local document links that are relevant to the current step.",
                        "You MUST invoke the fs tool to read these local documents BEFORE beginning work on the current step.",
                        "You MUST output a thorough and complete implementation of the current step.",
                        "You MUST read `process operators.md` with the fs tool before beginning work on the current step.",
                    ].join("\n"),
                },
                {
                    role: "user",
                    content: await getText(path),
                },
            ],
        });
    });
