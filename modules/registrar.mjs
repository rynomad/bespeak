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

import { getText } from "../util.mjs";

export default function registerModule({ node }) {
    return pipe(
        node.log("registrar: got module path"),
        mergeMap((path) => {
            console.log("registrar: got module path", path);
            return combineLatest({
                module: from(import(path)),
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
