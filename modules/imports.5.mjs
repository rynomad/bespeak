import { BehaviorSubject, from, of, pipe, switchMap, tap } from "https://esm.sh/rxjs";
import { z } from "https://esm.sh/zod";

export const key = "imports";
export const version = "0.0.1";
export const description = "imports takes an array of module documents and returns an array of imported modules.";

export const input = (operable) => {
  const schema = z.array(
    z.object({
      id: z.string(),
      data: z.string(),
    })
  );
  return of(schema);
};

export const output = (operable) => {
  const schema = z.array(z.unknown());
  return of(schema);
};

export const config = null;
export const keys = null;

const setupOperator = (operable) => {
  const memoizationCache = new Map();
  const cacheSubject = new BehaviorSubject(memoizationCache);
  return cacheSubject;
};

const fetchModuleDocument = (moduleId) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const moduleDocument = {
        id: moduleId,
        data: `export default function() { console.log("Module ${moduleId} executed"); }`,
      };
      resolve(moduleDocument);
    }, 1000);
  });
};

const statusOperator = (operable) => {
  return tap({
    next: (value) => {
      operable.status$.next({
        status: 'imported',
        message: `Module with id ${value.id} imported successfully.`,
        detail: value
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
        status: 'complete',
        message: 'All modules imported.',
        detail: null
      });
    }
  });
};

export default function memoizedImportsOperator(operable) {
  const cache$ = setupOperator(operable);

  return pipe(
    switchMap((moduleDocuments) => {
      return from(moduleDocuments).pipe(
        switchMap(async (moduleDocument) => {
          const { id, data } = moduleDocument;
          const cache = cache$.getValue();
          if (cache.has(id)) {
            return cache.get(id);
          }
          const fetchedModuleDocument = await fetchModuleDocument(id);
          const blob = new Blob([fetchedModuleDocument.data], { type: 'application/javascript' });
          const url = URL.createObjectURL(blob);
          const importedModule = await import(url);
          cache.set(id, importedModule);
          return importedModule;
        }),
        statusOperator(operable)
      );
    })
  );
}