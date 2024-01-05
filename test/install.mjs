import Operable from "../modules/operable.mjs";
import "../modules/install.mjs";
import "../modules/persist.mjs";

const moduleFromInstall = new Operable("module-from-install");

moduleFromInstall.write.config$.next({
    prompt: "write me a haiku",
});

moduleFromInstall.read.config$.subscribe((config) => {
    console.log("!!!!!! config", config);
});

moduleFromInstall.read.meta$.subscribe((meta) => {
    console.log("!!!!!! meta", meta);
});

moduleFromInstall.process.module$.subscribe((module) => {
    console.log("moduleFromInstall", module);
});

moduleFromInstall.read.output$.subscribe((output) => {
    console.log("output", output);
});

moduleFromInstall.write.input$.next({
    messages: [],
});

const KEY =
    localStorage.getItem("OPENAI_KEY") ||
    prompt("OPENAI_KEY") ||
    Deno.env.get("OPENAI_KEY");

localStorage.setItem("OPENAI_KEY", KEY);

if (!KEY) {
    throw new Error("OPENAI_KEY environment variable not set");
}

const keys = {
    apiKey: KEY,
};

moduleFromInstall.write.keys$.next(keys);

moduleFromInstall.write.meta$.next({});
