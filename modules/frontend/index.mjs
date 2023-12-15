import Node from "../node.mjs";
import "../bootload.mjs";
import "./operable.mjs";

console.log("imported");

const node = new Node("test");

// node.write$$("process:keys", {
//     apiKey: "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",
// }).subscribe(() => {
//     console.log("wrote keys");
// });

node.status$.subscribe(({ status, message, detail }) => {
    console.log(status, message, detail);
});

node.output$.subscribe((output) => {
    console.log("output", output);
});

const el = document.createElement("bespeak-operable");
el.operable = node;

document.body.appendChild(el);
