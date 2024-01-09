import { fileSystemAccess } from 'file-system-access';
import { z } from 'zod';
import { BehaviorSubject } from 'rxjs';
import { withLatestFrom, switchMap, catchError, of } from 'rxjs/operators';

export const key = 'fs';
export const version = '0.0.1';
export const description = 'The fs operator gives access to a single folder on the filesystem.';

export const inputSchema = z.object({
  file: z.string().description('The filename to read, e.g., "readme.md"')
});

export const outputSchema = z.object({
  contents: z.string().description('The contents of the file')
});

export const configSchema = z.object({
  directory: z.string().description('The directory where the files are located')
});

const setupOperator = async (config) => {
  let directoryHandle;

  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    const nodeAdapter = await import('file-system-access/lib/adapters/node.js');
    directoryHandle = await fileSystemAccess.getOriginPrivateDirectory(nodeAdapter, config.directory);
  } else if (typeof Deno !== 'undefined') {
    const denoAdapter = await import('file-system-access/src/adapters/deno.js');
    directoryHandle = await fileSystemAccess.getOriginPrivateDirectory(denoAdapter, config.directory);
  } else {
    directoryHandle = await fileSystemAccess.getOriginPrivateDirectory();
  }

  return directoryHandle;
};

const status$ = new BehaviorSubject(null);

const statusOperator = (event) => {
  const isValidEvent = Object.keys(event).every(key => ['status', 'message', 'detail'].includes(key) && typeof event[key] === 'string');
  if (!isValidEvent) {
    throw new Error('Invalid status event');
  }
  status$.next(event);
};

const fsOperator = (operable) => {
  const { config$ } = operable;
  return operable.input$.pipe(
    withLatestFrom(config$),
    switchMap(async ([input, config]) => {
      const directoryHandle = await setupOperator(config);
      const fileHandle = await directoryHandle.getFileHandle(input.file);
      const file = await fileHandle.getFile();
      const reader = new FileReader();

      return new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
      });
    }),
    map(contents => ({ contents })),
    catchError(error => {
      statusOperator({ status: 'error', message: error.message, detail: error });
      return of({ error: error.message });
    })
  );
};

export default fsOperator;