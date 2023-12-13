import Node from "http://localhost:3002/modules/node.mjs";
import "../modules/bootload.mjs";
import { getText } from "../modules/util.mjs";

const config = {
    nodes: [
        {
            system: {
                process: "fs@0.0.1",
                ingress: "default-ingress@0.0.1",
                name: "fs",
                description:
                    "This fs operator gives access to a directory containing markdown files.",
            },
            processConfig: {
                directory: "./pages",
            },
            ingressConfig: {},
        },
        {
            system: {
                process: "readability@0.0.1",
                ingress: "default-ingress@0.0.1",
                name: "readability",
                description:
                    "This readability can be used to fetch urls and present them cleaned of most html.",
            },
            processConfig: {
                insertLinks: true,
                insertImages: false,
            },
            ingressConfig: {},
        },
        {
            system: {
                ingress: "default-ingress@0.0.1",
                name: "header",
                description: "Start by writing the header",
            },
            processConfig: {
                basic: {
                    prompt: [
                        "Start by writing the header",
                        "Relevant documents to read with the fs tool:",
                        "writing a process operator.md",
                        "process operators.md",
                    ].join("\n"),
                },
                advanced: {
                    model: "gpt-4-1106-preview",
                    role: "user",
                },
            },
            ingressConfig: {},
            tools: ["fs", "readability"],
        },
        {
            system: {
                ingress: "default-ingress@0.0.1",
                name: "schemas",
                description: "Now write any schema operators",
            },
            processConfig: {
                basic: {
                    prompt: [
                        "Now write any schema operators",
                        "You should write all relevant schema operators.",
                        "always write schema operators for config, input, and output",
                        "if the process operator needs api keys, also provide a keys schema operator",
                        "Relevant docs to read with fs tool:",
                        "writing a process operator.md",
                        "schema operators.md",
                        "schema roles.md",
                        "remember to read all links provided in the requirements with the readability tool",
                        "remember to read all documentation provided above with the fs tool",
                        "remember to provide a complete and thorough implementation of the current step",
                        "remember to write code that matches the code you wrote earlier",
                    ].join("\n"),
                },
                advanced: {
                    model: "gpt-4-1106-preview",
                    role: "user",
                },
            },
            ingressConfig: {},
            tools: ["fs", "readability"],
        },
        {
            system: {
                ingress: "default-ingress@0.0.1",
                name: "setup",
                description: "Now, if applicable, write a setup operator",
            },
            processConfig: {
                basic: {
                    prompt: [
                        "Now, if applicable, write a setup operator",
                        "Relevant docs to read with fs tool:",
                        "writing a process operator.md",
                        "setup operator.md",
                        "remember to read all links provided in the requirements with the readability tool",
                        "remember to read all documentation provided above with the fs tool",
                        "remember to provide a complete and thorough implementation of the current step",
                        "remember to write code that matches the code you wrote earlier",
                    ].join("\n"),
                },
                advanced: {
                    model: "gpt-4-1106-preview",
                    role: "user",
                },
            },
            ingressConfig: {},
            tools: ["fs", "readability"],
        },
        {
            system: {
                name: "tools",
                description: "Now, if applicable, write a tool operator",
            },
            processConfig: {
                basic: {
                    prompt: [
                        "Now, if applicable, write a tool operator",
                        "Relevant docs to read with fs tool:",
                        "writing a process operator.md",
                        "tool operator.md",
                        "nodes.md",
                        "schema roles.md",
                        "data roles.md",
                        "remember to read all links provided in the requirements with the readability tool",
                        "remember to read all documentation provided above with the fs tool",
                        "remember to provide a complete and thorough implementation of the current step",
                        "remember to write code that matches the code you wrote earlier",
                    ].join("\n"),
                },
                advanced: {
                    model: "gpt-4-1106-preview",
                    role: "user",
                },
            },
            ingressConfig: {},
            tools: ["fs", "readability"],
        },
        {
            system: {
                name: "status",
                description: "Now, if applicable, write a status operator",
            },
            processConfig: {
                basic: {
                    prompt: [
                        "Now, if applicable, write a status operator",
                        "Before you begin, you should check the requirements and make sure to read any relevant web links with the readability tool",
                        "Relevant docs to read with fs tool:",
                        "writing a process operator.md",
                        "status operator.md",
                        "status messages.md",
                        "nodes.md",
                        "remember to read all links provided in the requirements with the readability tool",
                        "remember to read all documentation provided above with the fs tool",
                        "remember to provide a complete and thorough implementation of the current step",
                        "remember to write code that matches the code you wrote earlier",
                    ].join("\n"),
                },
                advanced: {
                    model: "gpt-4-1106-preview",
                    role: "user",
                },
            },
            tools: ["fs", "readability"],
            ingressConfig: {},
        },
        {
            system: {
                name: "main",
                description: "write the entire process operator",
            },
            processConfig: {
                basic: {
                    prompt: [
                        "write the entire process operator, composing any setup, tool, and status operators to achieve the desired functionality.",
                        "Relevant docs to read with fs tool:",
                        "writing a process operator.md",
                        "process operators.md",
                        "setup operator.md",
                        "tool operator.md",
                        "status operator.md",
                        "remember to read all links provided in the original requirements with the readability tool",
                        "remember to read all documentation provided above with the fs tool",
                        "remember to provide a complete and thorough implementation of the current step",
                        "remember to write code that matches the code you wrote earlier",
                        "start by rewriting the header, schema operators, and any setup, tool, and status operators",
                        "then provide the default export that brings them all together",
                    ].join("\n"),
                },
                advanced: {
                    model: "gpt-4-1106-preview",
                    role: "user",
                },
            },
            tools: ["fs", "readability"],
            ingressConfig: {},
        },
        {
            system: {
                name: "unify",
                description: "Now, it's time to get all the code in one place",
            },
            tools: ["fs", "readability"],
            processConfig: {
                basic: {
                    prompt: [
                        "Now, it's time to get all the code in one place",
                        "After this step, your final message will be parsed and executed",
                        "It is imperative that you output a single markdown code block containing the entire process operator module.",
                        "You must include all required exports, with no comments.",
                        "You must read the entire process operator.md file with the fs tool to make sure you have all the required exports.",
                    ].join("\n"),
                },
                advanced: {
                    model: "gpt-4-1106-preview",
                    role: "user",
                },
            },
            ingressConfig: {},
        },
        {
            system: {
                process: "chat-gpt@0.0.1",
                ingress: "default-ingress@0.0.1",
                name: "review",
                description:
                    "review the code against all relevant documentation",
            },
            tools: ["fs", "readability"],
            processConfig: {
                basic: {
                    prompt: [
                        "review the code against all relevant documentation, both web and local with fs and readability tools",
                        "make sure you have all the required exports",
                        "make sure the code properly implements all the required functionality",
                        "make sure there are no bugs",
                        "You must visit all links provided in the requirements with the readability tool before you begin your review",
                        "You must read all documentation provided above with the fs tool before you begin your review",
                        "After this step, your final message will be parsed and executed",
                        "It is imperative that you output a single markdown code block containing the entire process operator module.",
                        "You must include all required exports, with no comments.",
                        "You must read the entire process operator.md file with the fs tool to make sure you have all the required exports.",
                    ].join("\n"),
                },
                advanced: {
                    model: "gpt-4-1106-preview",
                    role: "user",
                },
            },
            ingressConfig: {},
        },
    ],
    connections: [
        { from: "header", to: "schemas" },
        { from: "schemas", to: "setup" },
        { from: "setup", to: "tools" },
        { from: "tools", to: "status" },
        { from: "status", to: "main" },
        { from: "main", to: "unify" },
        { from: "unify", to: "review" },
    ],
};

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
setTimeout(async () => {
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

    console.log("FLOW WRITE INPUT");

    flow.input$.next({
        name: "header",
        payload: {
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
        },
    });
}, 0);

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
