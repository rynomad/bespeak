import Operable from "../modules/operable.mjs";

const importsModule = await import("../modules/imports.1.mjs");

const readFile = async (path) => {
    const file = await Deno.readFile(path);
    const decoder = new TextDecoder();
    return decoder.decode(file);
};

const db = new Operable();

db.process.module$.next(importsModule);
db.write.input$.next({
    data: await readFile("./modules/imports.1.mjs"),
});

db.read.output$.subscribe((output) => {
    console.log("output", output);
});
