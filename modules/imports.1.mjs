import { of, from, pipe, mergeMap } from "https://esm.sh/rxjs";
import { z } from "https://esm.sh/zod";

export const key = "imports";
export const version = "0.0.1";
export const description = "imports takes a module document and returns a memoized import";

export const input = () => {
  const schema = z.object({
    id: z.string(),
    data: z.string(),
  });
  return of(schema);
};

export const output = () => {
  const schema = z.object({}).passthrough();
  return of(schema);
};

export const config = () => {
  const schema = z.object({});
  return of(schema);
};

const memoizationCache = new Map();

const processOperator = (operable) => {
  return pipe(
    mergeMap(({ id, data }) => {
      if (memoizationCache.has(id)) {
        return from(memoizationCache.get(id));
      } else {
        const blob = new Blob([data], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);
        const importPromise = import(url).then(module => {
          URL.revokeObjectURL(url);
          return module;
        });
        memoizationCache.set(id, importPromise);
        return from(importPromise);
      }
    })
  );
};

export default processOperator;