import Node from "../node.mjs";
import "../bootload.mjs";
import "./renderers/node.mjs";
import "./renderers/flow.mjs";
import { switchMap, filter, take, tap } from "rxjs";

console.log("imported");
Node.$.subscribe((node) => {
    console.log("node", node.id);
    node.status$.subscribe((output) => {
        if (output.status === "content") {
            console.log("content", output.detail);
        }

        if (output.status === "functionCall") {
            console.log("functionCall", output.detail.arguments);
        }

        if (output.status === "functionCallResult") {
            console.log("functionCallResult", output.detail);
        }
    });

    node.log$.subscribe(({ message, detail, callSite }) => {
        if (node.id === "flowui") {
            console.log(node.id, message);
        }
        // console.log(node.id, message, detail, callSite);
    });

    node.input$.subscribe((input) => {
        console.log("input", input);
    });

    node.output$.subscribe((output) => {
        console.log("output", output.messages && output);
    });
});

const node = new Node("flowui");

const gpt = new Node();
gpt.write$$("process:keys", {
    apiKey: "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",
}).subscribe(() => {
    console.log("wrote keys");
});

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
                    prompt: "write me a haiku about the subject above",
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
                    prompt: "write me a sonnet about the same subject",
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

node.status$.subscribe(({ status, message, detail }) => {
    console.log(status, message, detail);
});

node.output$.subscribe((output) => {
    console.log("output", output);
});

const el = document.createElement("bespeak-flow");
el.operable = node;

document.body.appendChild(el);

Node.ready$
    .pipe(
        switchMap(() =>
            node.write$$("system", {
                process: "flow@0.0.1",
            })
        ),
        tap(() =>
            node.status$.next({ status: "info", message: "WROTE SYSTEM" })
        ),
        switchMap(() =>
            node.process$.pipe(
                tap((p) =>
                    node.status$.next({
                        status: "info",
                        message: "GOT PROCESS",
                    })
                ),
                filter((p) => p.system.process === "flow@0.0.1")
            )
        ),
        tap(() => node.status$.next({ status: "info", message: "GOT SYSTEM" })),
        take(1),
        switchMap(() => node.write$$("process:config", config)),
        tap(() =>
            node.status$.next({ status: "WROTE CONFIG", message: "info" })
        ),
        tap(() => {
            console.log("send input");
            node.input$.next({
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

            node.output$.pipe(take(1)).subscribe(() => {});
        })
    )
    .subscribe();
