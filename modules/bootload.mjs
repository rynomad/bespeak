import * as path from "https://deno.land/std@0.188.0/path/mod.ts";
import NodeWrapper from "./node.mjs";
import * as DefaultIngress from "./ingress.mjs";
import { config as dbConfig } from "./db.schemas.mjs";
import {
    combineLatest,
    EMPTY,
    from,
    of,
    concatMap,
    tap,
    map,
    catchError,
} from "rxjs";
const Imports = await import("./imports.mjs");
const Registrar = await import("./registrar.mjs");
const Validator = await import("./validator.mjs");
const DB = await import("./db.mjs");

const __dirname = path.dirname(path.fromFileUrl(import.meta.url));

const systemTools = [
    {
        id: "db",
        operator: {
            module: await import("./db.mjs"),
            config: dbConfig,
        },
        system: {
            operator: `${DB.key}@${DB.version}`,
            ingress: `${DefaultIngress.key}@${DefaultIngress.version}`,
        },
    },
    {
        id: "validator",
        operator: {
            module: Validator,
            config: {},
        },
        system: {
            ingress: `${DefaultIngress.key}@${DefaultIngress.version}`,
            operator: `${Validator.key}@${Validator.version}`,
        },
    },
    {
        id: "imports",
        operator: {
            module: Imports,
        },
        system: {
            ingress: `${DefaultIngress.key}@${DefaultIngress.version}`,
            operator: `${Imports.key}@${Imports.version}`,
        },
    },
    {
        id: "registrar",
        operator: {
            module: Registrar,
        },
        system: {
            operator: `${Registrar.key}@${Registrar.version}`,
        },
    },
];

NodeWrapper.systemTools$.next(
    systemTools.map(({ id, operator, system }) => {
        const node = new NodeWrapper(`system:${id}`);
        node.operator$.next(operator);
        node.system$.next(system);
        return node;
    })
);

combineLatest(
    of([
        "./db.mjs",
        "./imports.mjs",
        "./ingress.mjs",
        "./registrar.mjs",
        "./gpt.mjs",
        "./validator.mjs",
    ]),
    NodeWrapper.systemTools$
)
    .pipe(
        concatMap(([paths, tools]) => {
            return from(paths).pipe(
                map((p) => path.join(__dirname, p)),
                tools.find(({ id }) => id === "system:registrar").operator(),
                tools.find(({ id }) => id === "system:db").operator(),
                catchError((error) => {
                    console.error(
                        "Catastrophic Error In Registration: ",
                        error.stack
                    );
                    return EMPTY;
                })
            );
        })
    )
    .subscribe(() => {
        console.log("Registration Complete");
    });

NodeWrapper.$.pipe(
    tap((node) => {
        // node.operator$.subscribe(
        //     (operator) => {
        //         console.log(node.id, "got operator", operator);
        //     },
        //     (error) => {
        //         console.error(node.id, "operator$ error", error);
        //     },
        //     () => {
        //         console.log(node.id, "operator$ complete");
        //     }
        // );
        node.log$.subscribe(({ message, value, callSite }) => {
            const DEBUG = Deno.env.get("DEBUG");
            if (!DEBUG) return;
            if (DEBUG === "dots") {
                const text = new TextEncoder().encode(".");
                Deno.writeAllSync(Deno.stdout, text);
                return;
            }

            console.log(node.id, message, callSite);
        });
        node.error$.subscribe((error) => console.error(node.id, error));
    })
).subscribe();
