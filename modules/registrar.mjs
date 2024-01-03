import {
    pipe,
    mergeMap,
    combineLatest,
    switchMap,
    of,
    catchError,
    EMPTY,
    map,
    from,
} from "rxjs";

export const version = "0.0.1";
export const key = "registrar";
const description = `The primary functional requirement of the registrar.mjs module is to dynamically import JavaScript modules from a given path and store them in a collection.

The specific requirements are as follows:

1. It takes a module path as input.
2. It reads the module source code from the provided path.
3. It dynamically imports the module from the source code.
4. It extracts the key and version from the imported module.
5. It creates an id from the key and version.
6. It prepares an "upsert" operation to store the module in a collection named "modules", with the id, key, version, and the module's source code as parameters.
7. If any error occurs during this process, it logs the error and returns an empty observable.`;

const getText = async (path) => {
    try {
        return Deno.readTextFile(path);
    } catch (e) {
        return fetch(path).then((res) => res.text());
    }
};
export default function registerModule({ node }) {
    return pipe(
        node.log("registrar: got module path"),
        mergeMap((path) => {
            const source$ = from(getText(path));
            return combineLatest({
                module: source$.pipe(
                    switchMap((source) => {
                        const blob = new Blob([source], {
                            type: "application/javascript",
                        });
                        const url = URL.createObjectURL(blob);
                        const prom = import(url);
                        // URL.revokeObjectURL(url);
                        return from(prom);
                    })
                ),
                source: from(getText(path)),
            }).pipe(
                node.log("registrar: module and source received"),
                map(({ module, source }) => {
                    const { key, version } = module;
                    const id = `${key}@${version}`;
                    return [
                        {
                            operation: "upsert",
                            collection: "modules",
                            params: { id, key, version, data: source },
                        },
                    ];
                }),
                catchError((err) => {
                    console.error(err);
                    return EMPTY;
                }),
                node.log("registrar: module save mapped to operations")
            );
        })
    );
}
