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

    const ls = new Node("ls");

    ls.write$$("system", {
        process: `logseq@0.0.1`,
        description: [
            `This tool gives you access to a logseq plugin object.`,
            `You can provide a function string that will be executed and returned to you`,
            `You can use any of the interfaces provided by logseq`,
            `functionString MUST end with a return statement or you will get no output`,
        ].join("\n"),
    }).subscribe(() => {
        console.log("ls wrote system");
    });

    const scaffold = new Node("scaffold");
    scaffold.write$$("process:keys", keys).subscribe(() => {
        console.log("scaffold wrote keys");
    });

    scaffold
        .write$$("process:config", {
            basic: {
                prompt: [
                    `you are a developer attempting to understand an open source software project`,
                    `you are reading the documentation for that project`,
                    `you have access to a logseq knowledge graph via the ls tool`,
                    `you can use the ls tool to get the project documentation`,
                    `you can use the ls tool to modify the project documentation`,
                    `When using the ls tool, you must return a value or you will get no output`,
                    `the string you give is executed via the Function constructor`,
                ].join("\n"),
            },
            advanced: {
                model: "gpt-4-1106-preview",
                role: "system",
                continue: true,
            },
        })
        .subscribe(() => {
            console.log("scaffold wrote config");
            scaffold.input$.next({
                messages: [
                    {
                        role: "user",
                        content: [
                            `start by reading the [[instructions]] page, follow those instructions.`,
                            `DO NOT RESPOND TO ME, JUST MANIPULATE THE DOCUMENTATION`,
                        ].join("\n"),
                    },
                ],
            });
        });

    scaffold.flowTools$.next([ls]);
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
