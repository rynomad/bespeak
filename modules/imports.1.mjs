import { of, switchMap, catchError, pipe } from "https://esm.sh/rxjs";
import { z } from "https://esm.sh/zod";

export const key = "imports";
export const version = "0.0.1";
export const description =
    "imports takes a module document and returns a memoized import";

export const input = () => {
    const schema = z.object({
        data: z.string(),
    });
    return of(schema);
};

export const output = () => {
    const schema = z.any();
    return of(schema);
};

const memoizationCache = new Map();

export const setupOperator = () => {
    return of(memoizationCache);
};

const processOperator = (operable) => {
    return pipe(
        switchMap(async (input) => {
            const { data } = input;
            if (memoizationCache.has(data)) {
                return await memoizationCache.get(data);
            } else {
                const blob = new Blob([data], {
                    type: "application/javascript",
                });
                const url = URL.createObjectURL(blob);
                try {
                    const module = import(url);
                    memoizationCache.set(data, module);
                    return await module;
                } catch (error) {
                    throw new Error(`Error importing module: ${error.message}`);
                }
            }
        }),
        catchError((error) => {
            throw error;
        })
    );
};

export default processOperator;
