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
    startWith,
    tap,
    take,
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

export const SESSION_KEY = "operable_process_session";

Operable.$.subscribe((operable) => {
    if (operable.id.startsWith("system")) {
        return;
    }

    operable.rolesIO((collection) => {
        combineLatest(
            operable.write[`${collection}$`],
            operable.schema[`${collection}$`],
            operable.process.module$.pipe(
                filter((f) => !!f),
                startWith({})
            )
        )
            .pipe(
                distinctUntilChanged(deepEqual),
                map(([data, schema, module]) => {
                    const res = schema?.parse
                        ? schema.safeParse(data)
                        : { success: true, data };

                    return { module, ...res };
                }),
                filter(({ success }) => success),
                map(({ data, module }) => ({
                    collection,
                    operation: "upsert",
                    params: {
                        ...(collection === "keys"
                            ? {}
                            : { operable: operable.id }),
                        ...(["input", "output", "state"].includes(collection)
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
            .subscribe();

        operable.process.module$
            .pipe(
                filter((module) => !!module || collection === "meta"),
                map((module) => {
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
                        case "state":
                            selector = {
                                operable: operable.id,
                                session: sessionStorage.getItem(SESSION_KEY),
                            };
                            break;
                        default:
                            selector = { operable: operable.id };
                    }
                    return {
                        collection,
                        operation: "findOne",
                        params: {
                            selector,
                        },
                    };
                }),
                db.asOperator(),
                filter((e) => e),
                map(({ data }) => data),
                takeUntil(operable.destroy$),
                tap(
                    console.log.bind(
                        console,
                        collection,
                        location.href,
                        "got data from db"
                    )
                )
            )
            .subscribe((data) => {
                console.log("send data to read." + collection, data);
                operable.read[`${collection}$`].next(data);
            });

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
                        take(1),
                        tap(console.log.bind(console, "got module")),
                        takeUntil(operable.destroy$)
                    )
                    .subscribe(operable[key].module$);
            });
        }
    });
});
