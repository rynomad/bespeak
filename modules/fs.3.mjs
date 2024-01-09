import { BehaviorSubject, from, of, switchMap, catchError, map, tap } from 'rxjs';
import { z } from 'zod';
import { getOriginPrivateDirectory } from 'file-system-access';

const inputSchema = z.object({
  file: z.string().min(1)
});

const outputSchema = z.object({
  contents: z.string()
});

const configSchema = z.object({
  directory: z.string().min(1)
});

const setupOperator = async (config) => {
  let directoryHandle;
  try {
    if (config.directory) {
      if (typeof process !== 'undefined' && process.version) {
        const nodeAdapter = await import('file-system-access/lib/adapters/node.js');
        directoryHandle = await getOriginPrivateDirectory(nodeAdapter, config.directory);
      } else if (typeof Deno !== 'undefined') {
        const denoAdapter = await import('file-system-access/lib/adapters/deno.js');
        directoryHandle = await getOriginPrivateDirectory(denoAdapter, config.directory);
      } else {
        directoryHandle = await getOriginPrivateDirectory();
      }
    } else {
      directoryHandle = await getOriginPrivateDirectory();
    }
  } catch (error) {
    throw error;
  }
  return directoryHandle;
};

const statusOperator = (statusSubject) => (source) => source.pipe(
  tap({
    next: (value) => {
      statusSubject.next({
        status: 'success',
        message: `Successfully read file: ${value.file}`,
        detail: value
      });
    },
    error: (error) => {
      statusSubject.next({
        status: 'error',
        message: `Error reading file: ${error.message}`,
        detail: error
      });
    }
  })
);

const fsProcessOperator = (operable) => {
  const status$ = operable.status$ || new BehaviorSubject(null);
  const config = operable.config;
  const directoryHandlePromise = setupOperator(config);

  return (input$) => input$.pipe(
    switchMap(async (input) => {
      const directoryHandle = await directoryHandlePromise;
      const fileHandle = await directoryHandle.getFileHandle(input.file);
      const file = await fileHandle.getFile();
      return file.text();
    }),
    map(contents => ({ contents })),
    statusOperator(status$),
    catchError(error => of({ error: true, message: error.message }))
  );
};

export const key = "fs";
export const version = "0.0.1";
export const description = "The fs operator gives access to a single folder on the filesystem.";
export const input = inputSchema;
export const output = outputSchema;
export const config = configSchema;
export default fsProcessOperator;