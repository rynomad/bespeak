import { of, from, pipe, catchError, throwError } from "https://esm.sh/rxjs";
import { switchMap, tap } from "https://esm.sh/rxjs/operators";
import { z } from "https://esm.sh/zod";

export const key = "imports";
export const version = "0.0.1";
export const description = "imports takes a module document and returns a memoized import";

export const input = () => {
    const schema = z.object({
        id: z.string().description("A string identifier for the module."),
        data: z.string().description("A string containing the module data."),
    }).description("The expected input data to the operator.");
    return of(schema);
};

export const output = () => {
    const schema = z.object({}).description("The output data from the operator, which is an imported module.");
    return of(schema);
};

export const config = () => {
    const schema = z.object({}).passthrough().description("Configuration used to construct an instance of the operator.");
    return of(schema);
};

export const keys = () => {
    const schema = z.object({}).passthrough().description("Keys shared by all instances of an operator.");
    return of(schema);
};

const setupOperator = (operable) => {
    const memoizationCache = new Map();
    return of(memoizationCache).pipe(
        tap((cache) => {
            if (!operable.data.memoizationCache) {
                operable.data.memoizationCache = cache;
            }
        })
    );
};

const statusOperator = (operable) => {
    return tap({
        next: (module) => {
            operable.status$.next({
                status: 'importing',
                message: `Importing module: ${module.id}`,
                detail: null
            });
        },
        error: (error) => {
            operable.status$.next({
                status: 'error',
                message: `Error importing module: ${error.message}`,
                detail: error
            });
        },
        complete: () => {
            operable.status$.next({
                status: 'completed',
                message: 'Module import completed',
                detail: null
            });
        }
    });
};

export default function importsOperator(operable) {
    return pipe(
        setupOperator(operable),
        switchMap((memoizationCache) => operable.input$.pipe(
            switchMap(async (module) => {
                if (memoizationCache.has(module.id)) {
                    return memoizationCache.get(module.id);
                }
                try {
                    const blob = new Blob([module.data], { type: 'application/javascript' });
                    const url = URL.createObjectURL(blob);
                    const importedModule = await import(url);
                    memoizationCache.set(module.id, importedModule);
                    return importedModule;
                } catch (error) {
                    throw error;
                }
            }),
            catchError((error) => {
                return throwError(() => new Error(`Error importing module: ${error.message}`));
            }),
            statusOperator(operable)
        ))
    );
}