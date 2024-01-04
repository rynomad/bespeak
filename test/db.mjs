import Operable from "../modules/operable.mjs";

const dbModule = await import("../modules/db.2.mjs");
const { config: dbConfig } = await import("../modules/db.schemas.mjs");

const db = new Operable();

db.process.module$.next(dbModule);
db.write.config$.next(dbConfig);
db.write.input$.next({
    collection: "meta",
    operation: "upsert",
    params: {
        operable: "test",
        data: {
            name: "test",
        },
    },
});

let count = 0;
db.read.output$.subscribe((output) => {
    console.log("output", output);
    if (!count) {
        count++;
        console.log("remove");
        db.write.input$.next({
            collection: "meta",
            operation: "remove",
            params: {
                operable: "test",
            },
        });
    }
});
