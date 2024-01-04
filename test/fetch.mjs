import Operable from "../modules/operable.mjs";

const fetchModule = await import("../modules/fetch.1.mjs");

const fetch = new Operable();

fetch.process.module$.next(fetchModule);
// fetch.write.config$.next({
//     insertLinks: true,
// });
fetch.write.input$.next({
    url: "https://en.wikipedia.org/wiki/Functional_programming",
});

fetch.read.output$.subscribe((output) => {
    console.log("output", output);
});
