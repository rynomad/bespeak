import {
    from,
    pipe,
    switchMap,
    withLatestFrom,
    filter,
    of,
} from "https://esm.sh/rxjs";

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
        withLatestFrom(node.tool$$("system:db")),
        switchMap(([module, db]) => {
            if (typeof module === "string") {
                return of([
                    {
                        operation: "findOne",
                        collection: "modules",
                        params: { selector: { id: module } },
                    },
                ]).pipe(
                    db.operator({ node }),
                    switchMap(([module$]) => module$),
                    filter((module) => !!module)
                );
            }

            return of(module);
        }),
        switchMap((module) => {
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
