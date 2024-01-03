import Operable from "../modules/operable.mjs";

const gpt = await import("../modules/gpt.2.mjs");
const dbModule = await import("../modules/db.1.mjs");
const { config: dbConfig } = await import("../modules/db.schemas.mjs");

const testop = new Operable();

testop.process.module$.next(gpt);
testop.write.config$.next({
    prompt: "write me a haiku",
});

testop.write.input$.next({ messages: [] });

testop.read.output$.subscribe((output) => {
    console.log("output", output);
    if (output) {
        testop.write.config$.next({
            prompt: "write me a sonnet",
        });
    }
    // console.log("gpt", gpt.default);
});
const KEY = Deno.env.get("OPENAI_KEY");

if (!KEY) {
    throw new Error("OPENAI_KEY environment variable not set");
}

const keys = {
    apiKey: KEY,
};

testop.write.keys$.next(keys);

const db = new Operable();

db.process.module$.next(dbModule);
db.write.config$.next(dbConfig);
