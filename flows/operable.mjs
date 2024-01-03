import Node from "../modules/node.mjs";
import "../modules/bootload.mjs";
const KEY = Deno.env.get("OPENAI_KEY");
if (!KEY) {
    throw new Error("OPENAI_KEY environment variable not set");
}
const path = Deno.args[0];

const keys = {
    apiKey: KEY,
};

Node.ready$.subscribe(() => {
    console.log("READY");

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

    const scaffold = new Node("scaffold");
    scaffold.write$$("process:keys", keys).subscribe(() => {
        console.log("scaffold wrote keys");
    });

    scaffold
        .write$$("process:config", {
            basic: {
                prompt: [
                    `start by reading operable.md via the fs tool, then take a deep breath, think step by step, and draft an outline of the code`,
                    `You MUST use the fs function to read all relevant files BEFORE you respond to me`,
                ].join("\n"),
            },
            advanced: {
                model: "gpt-4-1106-preview",
                cleanup: "system",
            },
        })
        .subscribe(() => {
            console.log("scaffold wrote config");
            scaffold.input$.next({
                messages: [
                    {
                        role: "system",
                        content: [
                            `You are an expert in the field of software engineering. You are tasked with creating a new software project. You have been given a markdown file with a description of the project. You must create an outline of the code.`,
                            `The person you are working with is a software engineer. They are familiar with the project and can help you with any questions you have.`,
                            `Your responses should be thorough and comprehensive in substance, but concise in length.`,
                            `You MUST use the fs function to read all relevant files BEFORE you respond to the user`,
                            `You MUST target ES2017, not typescript`,
                            `You MUST use esm.sh for all third party dependencies`,
                            `files to read: operable.md, db schemas.md, db process operator.md, schemas.md`,
                        ].join("\n"),
                    },
                ],
            });
        });

    scaffold.flowTools$.next([fs]);

    const doer = new Node("doer");
    doer.write$$("process:config", {
        basic: {
            prompt: [
                `Now, implement each step of the outline you created in the previous step.`,
                `provide one block of code per response, and thoroughly explain your approach before beginning.`,
                `Use idiomatic rxjs patterns.`,
                `You MUST use the fs function to read all relevant files BEFORE you respond to me`,
                `files to read: operable.md, db schemas.md, db process operator.md, schemas.md`,
            ].join("\n"),
        },
        advanced: {
            model: "gpt-4",
            continue: true,
        },
    }).subscribe(() => {
        console.log("doer wrote config");
    });

    doer.flowTools$.next([fs]);

    doer.upstream$.next([scaffold]);
});

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
