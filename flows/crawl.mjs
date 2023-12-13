import Node from "../modules/node.mjs";
import "../modules/bootload.mjs";

const crawler = new Node("crawler");

const readability = new Node("readability");
const fs = new Node("fs");

fs.write$$("system", {
    process: `fs@0.0.1`,
    description: [
        `This fs operator gives access to a directory containing markdown files.`,
        `you can read any file by giving only it's name: i.e. file: "readme.md" will get you the proper readme file without needing to worry about its path prefix`,
        `the files contain double bracket [[links]]. These links are used to navigate the documentation.`,
        `so if you encounter [[something interesting]], you can reinvoke the function to read that file with file: "something interesting.md"`,
        `do NOT worry about the path prefix, the fs operator will handle that for you.`,
        `do NOT worry about spaces, the fs operator will handle that for you.`,
        `DO include the .md extension, the fs operator will not add that for you.`,
        `the documents are markdown from a logseq project`,
        `you do not need to provide the path prefix, the fs tool will handle that for you`,
        `you do need to provide the .md extension, the fs tool will not add that for you`,
        `spaces are allowed in file names, the fs tool will handle that for you`,
        `you can read any file by giving only it's name: i.e. file: "readme.md" will get you the proper readme file without needing to worry about its path prefix`,
        `the user just gave you an entry point, you must follow links to find the information you need`,
    ].join("\n"),
}).subscribe(() => {
    console.log("fs wrote system");
});

const opSource = new Node("operatorSource");
opSource
    .write$$("system", {
        process: `fs@0.0.1`,
        description: [
            `This fs operator gives access to a directory containing process operator modules.`,
            `use it to read source files`,
        ].join("\n"),
    })
    .subscribe(() => {
        console.log("opSource wrote system");
    });

opSource
    .write$$("process:config", {
        directory: "./modules",
    })
    .subscribe(() => {
        console.log("opSource wrote config");
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

const keys = {
    apiKey: KEY,
};

crawler.flowTools$.next([fs, opSource]);

crawler.write$$("process:keys", keys).subscribe(() => {
    console.log("crawler wrote keys");
});

crawler
    .write$$("process:config", {
        basic: {
            prompt: [
                `you are a developer attempting to understand an open source software project`,
                `you are reading the documentation for that project`,
                `you have access to two fs tools, one that gives access to documentation, and one that gives access to source`,
            ].join("\n"),
        },
        advanced: {
            model: "gpt-4-1106-preview",
            role: "system",
        },
    })
    .subscribe(() => {
        console.log("crawler wrote config");

        crawler.input$.next({
            messages: [
                {
                    role: "user",
                    content: [
                        `entry points:`,
                        `Templates.md`,
                        `fs.mjs`,
                        `Please provide a requirements document based on the template as it would look for the given source file. this is a reverse engineering exercise, your goal is to provide the requirements document that could be used to rewrite the source code`, //`please augment the db process operator file to match the template. don't lose any information, but feel free to reorganize it as you see fit`,
                        // `The file above constitute a logseq knowledge base that is in progress for an isomorphic javascript framework. the files have been concatenated for convenience. Please analyze the project and provide an introduction page to the documentation that would be useful for a new user.`,
                    ].join("\n"),
                },
            ],
        });
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
