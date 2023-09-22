import { tap } from "https://esm.sh/rxjs";

export const debug = (element, message) => {
    const error = new Error();
    const callSite = error.stack.split("\n")[2];
    const fileAndLineNumber = callSite.match(/\(([^)]+)\)/)?.[1];
    return tap((value) => {
        console.log(element, message, value, fileAndLineNumber || "");
    });
};
