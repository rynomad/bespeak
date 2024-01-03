import Node from "./node.mjs";
import "../modules/bootload.mjs";

const KEY = Deno.env.get("OPENAI_KEY");

if (!KEY) {
    throw new Error("OPENAI_KEY environment variable not set");
}
const path = Deno.args[0];

const keys = {
    apiKey: KEY,
};

const keySetter = new Node();
keySetter.write$$("process:keys", keys).subscribe(() => {
    console.log("keySetter wrote keys");
});

console.log("READY");

const config = {
    nodes: [
        {
            system: {
                name: "readability",
                process: "readability@0.0.1",
                description: "Readability node with insertLinks set to true",
            },
            processConfig: {
                insertLinks: true,
            },
            tools: [],
        },
        {
            system: {
                name: "getCitations",
                process: "chat-gpt@0.0.1",
                description: "Node to get citations from an article",
            },
            processConfig: {
                basic: {
                    prompt: "Read the article and list all citation links, as well as state the claim that they are supposed to support",
                },
                advanced: {
                    model: "gpt-4-1106-preview",
                },
            },
            tools: ["readability"],
        },
        {
            system: {
                name: "checkCitations",
                process: "chat-gpt@0.0.1",
                description:
                    "Node to check each citation and report whether it supports the claim",
            },
            processConfig: {
                basic: {
                    prompt: "Check each citation and report whether it supports the claim",
                },
                advanced: {
                    model: "gpt-4-1106-preview",
                },
            },
            tools: ["readability"],
        },
    ],
    connections: [
        {
            from: "getCitations",
            to: "checkCitations",
        },
    ],
};

const flow = new Node();

flow.write$$("system", {
    process: "flow@0.0.1",
}).subscribe(() => {
    console.log("flow wrote system");
});

flow.write$$("process:config", config).subscribe(() => {
    console.log("flow wrote config");
});

flow.schema$$("process:config").subscribe((schema) => {
    console.log("flow schema", schema);
});

flow.input$.next({
    name: "getCitations",
    payload: {
        messages: [
            {
                role: "user",
                content:
                    "https://quillette.com/2023/12/10/the-carbon-neutral-dumpster-fire/",
            },
        ],
    },
});

Node.$.subscribe((node) => {
    console.log("node", node.id);
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
            console.log("functionCallResult", output.detail);
        }
    });

    node.input$.subscribe((input) => {
        console.log("input", input.messages && input);
    });

    node.output$.subscribe((output) => {
        console.log("output", output.messages && output);
    });
});
