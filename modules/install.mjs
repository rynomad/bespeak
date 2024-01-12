import {
    from,
    of,
    concatMap,
    map,
    withLatestFrom,
    switchMap,
    mergeMap,
    toArray,
    take,
    tap,
} from "rxjs";
import Operable from "./operable.mjs";

const importsModule = await import("./imports.1.mjs");
const dbModule = await import("./db.2.mjs");
const { config: dbConfig } = await import("./db.schemas.mjs");

const getText = async (path) => {
    try {
        path = path.replace("./", "");
        const cwd = Deno.realPathSync(".");
        return await Deno.readTextFile(`${cwd}/${path}`);
    } catch (e) {
        return await fetch(path).then((res) => res.text());
    }
};

const imports = new Operable("system:imports");
imports.process.module$.next(importsModule);

const db = new Operable("system:db");
db.process.module$.next(dbModule);
db.write.config$.next(dbConfig);

const paths = [
    "./modules/db.2.mjs",
    "./modules/imports.1.mjs",
    "./modules/gpt.2.mjs",
    "./modules/flow.3.mjs",
    "./modules/ingress.mjs",
    "./modules/fetch.1.mjs",
];

from(paths)
    .pipe(
        // map(([paths, tools]) => [paths.map(getAbsoluteUrl), tools]),
        mergeMap(async (path) => {
            return await getText(path);
        }),
        mergeMap((data) => {
            console.log();
            return of({ data }).pipe(
                imports.asOperator(),
                withLatestFrom(of(data))
            );
        }),
        map(([module, data]) => {
            console.log("prep upsert for module", module);
            return {
                collection: "modules",
                operation: "upsert",
                params: {
                    id: `${module.key}@${module.version}`,
                    description: module.description,
                    key: module.key,
                    version: module.version,
                    type: module.type || "",
                    data,
                },
            };
        }),
        db.asOperator(),
        tap((v) => {
            console.log("did upsert for", v);
        }),
        take(paths.length),
        toArray()
    )
    .subscribe((v) => {
        console.log("Registration Complete");
    });
