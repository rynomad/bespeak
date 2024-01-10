import { debounceTime } from "rxjs";
import Operable from "../modules/operable.mjs";
import "../modules/persist.mjs";
import "../modules/install.mjs";

window.test = new Operable("test-flow-2");

// test.write.meta$.next({
//     process: "flow@1.0.0",
// });

// test.write.config$.next({
//     operables: ["first", "second", "third"],
//     connections: {
//         stream: [
//             {
//                 from: "first",
//                 to: "second",
//             },
//             {
//                 from: "second",
//                 to: "third",
//             },
//         ],
//     },
//     input: "first",
//     output: "third",
// });

test.read.config$.subscribe((config) => {
    console.log("config", config);
});

test.io.tools$.pipe(debounceTime(100)).subscribe((tools) => {
    // tools.forEach((tool, i) => {
    //     tool.write.meta$.next({
    //         process: "gpt@0.0.1",
    //     });
    //     tool.write.config$.next({
    //         prompt:
    //             i === 0
    //                 ? "write me a haiku"
    //                 : i === 1
    //                 ? "write me a sonnet about the same subject"
    //                 : "write me a limerick about the same subject",
    //     });
    //     tool.read.config$.subscribe((config) => {
    //         console.log("!!!!!! config", config);
    //     });
    //     tool.read.meta$.subscribe((meta) => {
    //         console.log("!!!!!! meta", meta);
    //     });
    //     tool.read.output$.subscribe((output) => {
    //         console.log("!!!!!! output", output);
    //     });
    // });
});

// test.write.input$.next({
//     messages: [],
// });

test.read.output$.subscribe((output) => {
    console.log("output", output);
});

export default test;
