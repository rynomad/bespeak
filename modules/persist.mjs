import {
    map,
    distinctUntilChanged,
    takeUntil,
    combineLatest,
    of,
    pluck,
    filter,
    switchMap,
    withLatestFrom,
    tap,
} from "rxjs";
import { v4 as uuidv4 } from "https://esm.sh/uuid";
import { deepEqual } from "https://esm.sh/fast-equals";
import Operable from "./operable.mjs";

const dbModule = await import("./db.2.mjs");
const { config: dbConfig } = await import("./db.schemas.mjs");

const db = new Operable("system:db");
db.process.module$.next(dbModule);
db.write.config$.next(dbConfig);

const imports = new Operable("system:imports");
imports.process.module$.next(await import("./imports.1.mjs"));

const SESSION_KEY = "operable_process_session";

const session = uuidv4();

sessionStorage.setItem(SESSION_KEY, session);

Operable.$.subscribe((operable) => {
    if (operable.id === "system:db") {
        return;
    }

    operable.rolesIO((collection) => {
        combineLatest(
            operable.write[`${collection}$`],
            operable.schema[`${collection}$`]
        )
            .pipe(
                distinctUntilChanged(deepEqual),
                map(([data, schema]) =>
                    schema?.parse
                        ? schema.safeParse(data)
                        : { success: true, data }
                ),
                withLatestFrom(operable.process.module$),
                map(([{ data }, module]) => ({
                    collection,
                    operation: "upsert",
                    params: {
                        ...(collection === "keys"
                            ? {}
                            : { operable: operable.id }),
                        ...(["input", "output"].includes(collection)
                            ? { session: sessionStorage.getItem(SESSION_KEY) }
                            : {}),
                        ...(collection !== "meta"
                            ? { module: `${module.key}@${module.version}` }
                            : {}),
                        data,
                    },
                })),
                db.asOperator(),
                takeUntil(operable.destroy$)
            )
            .subscribe((res) => console.log("wrote", collection, res));

        operable.process.module$
            .pipe(
                filter((module) => !!module),
                switchMap((module) => {
                    let selector = {};
                    switch (collection) {
                        case "config":
                            selector = {
                                operable: operable.id,
                                module: `${module.key}@${module.version}`,
                            };
                            break;
                        case "meta":
                            selector = { operable: operable.id };
                            break;
                        case "keys":
                            selector = {
                                module: `${module.key}@${module.version}`,
                            };
                            break;
                        case "input":
                        case "output":
                            selector = {
                                operable: operable.id,
                                session: sessionStorage.getItem(SESSION_KEY),
                            };
                            break;
                        default:
                            selector = { operable: operable.id };
                    }
                    return of({
                        collection,
                        operation: "findOne",
                        params: {
                            selector,
                        },
                    });
                }),
                db.asOperator(),
                filter((e) => e),
                map(({ data }) => data),
                takeUntil(operable.destroy$)
            )
            .subscribe(operable.read[`${collection}$`]);

        if (collection === "meta") {
            ["process", "ingress"].forEach((key) => {
                operable.read.meta$
                    .pipe(
                        pluck(key),
                        distinctUntilChanged(),
                        switchMap((id) => {
                            return of({
                                collection: "modules",
                                operation: "findOne",
                                params: {
                                    selector: { id },
                                },
                            });
                        }),
                        db.asOperator(),
                        filter((e) => e),
                        imports.asOperator(),
                        takeUntil(operable.destroy$)
                    )
                    .subscribe(operable[key].module$);
            });
        }
    });
    console.log("id", operable.id);
});
