import { Observable, of, pipe } from "https://esm.sh/rxjs";
import { map, switchMap, tap, catchError } from "https://esm.sh/rxjs/operators";

export const key = "importModuleFromCode";
export const version = "0.0.1";
export const description =
    "Dynamically import JavaScript code as a module from a provided string of source code. It creates a Blob URL from the source code, imports it as a module, and returns the imported module. If any error occurs during the import process, it captures and returns the error.";

export const inputSchema = () =>
    of({
        description: "The input for the importModuleFromCode operator",
        type: "object",
        properties: {
            code: {
                description: "The source code to be imported as a module",
                type: "string",
            },
        },
        required: ["code"],
    });

export const outputSchema = () =>
    of({
        description: "The output of the importModuleFromCode operator",
        type: "object",
        properties: {
            module: {
                description: "The imported module",
                type: "object",
            },
        },
        required: ["module"],
    });

const importModuleFromCode = ({ node }) =>
    pipe(
        map(({ code }) => {
            const blob = new Blob([code], {
                type: "text/javascript",
            });
            const url = URL.createObjectURL(blob);
            return { url };
        }),
        node.log(`Node ${node.id}: Blob URL created`),
        switchMap(({ url }) => import(url)),
        map((module) => ({ module })),
        catchError((error) => {
            node.log(`Node ${node.id}: Error importing module`);
            return of({ error });
        }),
        node.log(`Node ${node.id}: Module imported`)
    );

export default importModuleFromCode;
