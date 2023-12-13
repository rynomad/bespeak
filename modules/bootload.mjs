import * as path from "https://deno.land/std@0.188.0/path/mod.ts";
import slash from "https://deno.land/x/slash/mod.ts";
import Node from "http://localhost:3002/modules/node.mjs";
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
        process: {
            module: await import("./db.mjs"),
            config: dbConfig,
        },
        system: {
            process: `${DB.key}@${DB.version}`,
            ingress: `${DefaultIngress.key}@${DefaultIngress.version}`,
        },
    },
    {
        id: "validator",
        process: {
            module: Validator,
            config: {},
        },
        system: {
            ingress: `${DefaultIngress.key}@${DefaultIngress.version}`,
            process: `${Validator.key}@${Validator.version}`,
        },
    },
    {
        id: "imports",
        process: {
            module: Imports,
        },
        system: {
            ingress: `${DefaultIngress.key}@${DefaultIngress.version}`,
            process: `${Imports.key}@${Imports.version}`,
        },
    },
    {
        id: "registrar",
        process: {
            module: Registrar,
        },
        system: {
            process: `${Registrar.key}@${Registrar.version}`,
        },
    },
];

Node.systemTools$.next(
    systemTools.map(({ id, process, system }) => {
        const node = new Node(`system:${id}`);
        node.process$.next(process);
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
        "./importModuleFromCode.mjs",
        "./testRunner.mjs",
        "./configurableOperator.mjs",
        "./readability.mjs",
        "./fs.mjs",
        "./flow.mjs",
    ]),
    Node.systemTools$
)
    .pipe(
        concatMap(([paths, tools]) => {
            return from(paths).pipe(
                map((p) => slash(path.resolve(__dirname, p))),
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

Node.$.pipe(
    tap((node) => {
        node.log$.subscribe(({ message, value, callSite }) => {
            const DEBUG = Deno.env.get("DEBUG");
            if (!DEBUG) return;

            if (DEBUG === "all") {
                console.log(node.id, message, callSite);
                return;
            }

            if (DEBUG.includes(node.id)) {
                console.log(node.id, message, callSite);
                return;
            }

            if (DEBUG === "dots") {
                const text = new TextEncoder().encode(".");
                Deno.writeAllSync(Deno.stdout, text);
                return;
            }
        });
        node.error$.subscribe((error) => console.error(node.id, error));
    })
).subscribe();
