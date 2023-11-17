import {
    pipe,
    mergeMap,
    combineLatest,
    switchMap,
    of,
    catchError,
    EMPTY,
} from "rxjs";

import { getText } from "../util.mjs";

export default function registerModule({ node }) {
    return pipe(
        mergeMap((path) => {
            return combineLatest({
                module: import(path),
                source: getText(path),
                db: node.tool$$("system:db"),
            }).pipe(
                node.log("registrar: module and source received"),
                switchMap(({ module, source, db }) => {
                    const { key, version } = module;
                    const id = `${key}@${version}`;
                    return of([
                        {
                            operation: "upsert",
                            collection: "modules",
                            params: { id, key, version, data: source },
                        },
                    ]).pipe(db.operator());
                }),
                catchError((err) => {
                    console.error(err);
                    return EMPTY;
                }),
                node.log("registrar: module saved")
            );
        })
    );
}
