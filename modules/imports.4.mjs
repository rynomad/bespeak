import { of, from, mergeMap } from "https://esm.sh/rxjs";
import { z } from "https://esm.sh/zod";

export const key = "imports";
export const version = "0.0.1";
export const description = "imports takes a module document and returns a memoized import";

export const input = () => {
  const schema = z.object({
    id: z.string().description("A string identifier for the module."),
    data: z.string().description("A string containing the module data."),
  });
  return of(schema);
};

export const output = () => {
  const schema = z.unknown().description("An imported module.");
  return of(schema);
};

const memoizedImports = new Map();

export default function importsOperator(operable) {
  return from(operable.input$).pipe(
    mergeMap(async ({ id, data }) => {
      if (memoizedImports.has(id)) {
        return memoizedImports.get(id);
      }

      const blob = new Blob([data], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);

      try {
        const module = await import(blobUrl);
        memoizedImports.set(id, module);
        return module;
      } catch (error) {
        throw new Error(`Error importing module with id ${id}: ${error.message}`);
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
    })
  );
}