import NodeWrapper from "./modules/node.mjs";
import "./modules/bootload.mjs";

const KEY = Deno.env.get("OPENAI_KEY");

if (!KEY) {
    throw new Error("OPENAI_KEY environment variable not set");
}

const keys = {
    apiKey: KEY,
};

const gpt = new NodeWrapper("test");
const gpt2 = new NodeWrapper("test2");

// log full output objects
gpt.output$.subscribe((output) => {
    console.log("\nnode 1: output", output);
});
gpt2.output$.subscribe((output) => {
    console.log("\nnode 2: output", output);
});

// log status chunks for streaming responses
[gpt, gpt2].forEach((node) => {
    node.status$.subscribe((status) => {
        const text = new TextEncoder().encode(status.detail?.chunk || "\n");
        Deno.writeAllSync(Deno.stdout, text);
    });
});

// connect the nodes
gpt2.upstream$.next([gpt]);

// send a prompt to node 1
gpt.input$.next({
    override: {
        prompt: "write me a haiku about space",
    },
});

// configure gpt2 so it has a prompt to write a limmerick as followup to existing thread
gpt2.write$$("operator:config", {
    basic: {
        prompt: "write me a limmerick about the same subject",
    },
    advanced: {
        model: "gpt-4",
    },
}).subscribe(() => {
    console.log("gpt2 wrote config");
});

// when the first output from node 2 comes in, send a new prompt to node 1
let first = true;
gpt2.output$.subscribe((output) => {
    if (first) {
        first = false;
        gpt.input$.next({
            override: { prompt: "write me a sonnet about egypt" },
        });
        return;
    }
});

// configure keys, only needs to be done once for any node (they'll share the same keys)

gpt.write$$("operator:keys", keys).subscribe(() => {
    console.log("\nnode 1: write operator keys document");
});

// log the input and config schemas

gpt.schema$$("operator:input").subscribe((schema) => {
    console.log("\ngpt input schema", schema);
});

gpt.schema$$("operator:config").subscribe((schema) => {
    console.log("\ngpt config schema", schema);
});

// debug
gpt.read$$("system").subscribe((system) => {
    console.log("\nnode 1: read system document", system);
});

gpt.read$$("operator:config").subscribe((data) => {
    console.log("\nnode 1: read operator config document", data);
});

gpt.read$$("operator:keys").subscribe((data) => {
    console.log("\nnode 1: read operator keys document", data);
});

gpt.read$$("ingress:config").subscribe((data) => {
    console.log("\nnode 1: read ingress config document", data);
});

gpt.read$$("ingress:keys").subscribe((data) => {
    console.log("\nnode 1: read ingress keys document", data);
});

gpt.write$$("operator:keys", keys).subscribe(() => {
    console.log("\nnode 1: write operator keys document");
});

// gpt.log$.subscribe(({ message, value, callSite }) =>
//     console.log("\nnode 1::", message, callSite)
// );
// gpt2.log$.subscribe(({ message, value, callSite }) => {
//     return console.log(gpt2.id, message, callSite);
// });
