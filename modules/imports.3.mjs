import { of, from } from "https://esm.sh/rxjs";
import { z } from "https://esm.sh/zod";

export const key = "imports";
export const version = "0.0.1";
export const description = "imports takes a module document and returns a memoized import";

export const inputSchema = () => {
  const schema = z.object({
    id: z.string(),
    data: z.string(),
  });
  return of(schema);
};

export const outputSchema = () => {
  const schema = z.any();
  return of(schema);
};

const memoizationCache = new Map();

export const setupOperator = () => {
  return of(memoizationCache);
};

const processOperator = ({ id, data }) => {
  if (memoizationCache.has(id)) {
    return from(memoizationCache.get(id));
  } else {
    const blob = new Blob([data], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const importPromise = import(url).then(module => {
      URL.revokeObjectURL(url);
      return module;
    });
    memoizationCache.set(id, importPromise);
    return from(importPromise);
  }
};

export default (operable) => {
  const { input$, node } = operable;
  return input$.pipe(
    from(processOperator)
  );
};