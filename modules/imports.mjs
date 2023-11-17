import { from, pipe, switchMap } from "https://esm.sh/rxjs";

const memos = new Map();

export const key = "memoizedImports";
export const version = "0.0.1";
export const description =
    "Memoized imports takes an array of module documents and returns an array of imported modules.";

export function inputSchema() {
    return of({
        type: "array",
        items: {
            type: "object",
            format: "rxdbDocument",
            properties: {
                id: { type: "string" },
                data: { type: "string" },
            },
        },
    });
}

function memoizedImport({ node }) {
    return pipe(
        node.log("memoizedImport"),
        switchMap((module) => {
            console.log("memo module", module);
            const id = module.get("id");
            if (memos.has(id)) {
                return memos.get(id);
            }

            const source = module.get("data");
            const blob = new Blob([source], {
                type: "text/javascript",
            });
            const url = URL.createObjectURL(blob);
            const import$ = from(import(url));

            memos.set(id, import$);
            return import$;
        })
    );
}

export default memoizedImport;
