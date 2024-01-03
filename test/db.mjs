import Operable from "../modules/operable.mjs";

const dbModule = await import("../modules/db.1.mjs");
const { config: dbConfig } = await import("../modules/db.schemas.mjs");

const db = new Operable();

db.process.module$.next(dbModule);
db.write.config$.next(dbConfig);
db.write.input$.next({
    collection: "meta",
    operation: "upsert",
    params: {
        id: "test",
        data: {
            id: "test",
            name: "test",
        },
    },
});

db.read.output$.subscribe((output) => {
    console.log("output", output);
});
