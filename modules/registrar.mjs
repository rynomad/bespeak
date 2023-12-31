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
                        return import(url);
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
