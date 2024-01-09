import { from, of, pipe, catchError, switchMap, tap } from 'https://esm.sh/rxjs';
import { z } from 'https://esm.sh/zod';
import fileSystemAccess from 'https://esm.sh/file-system-access';

export const key = 'fs';
export const version = '0.0.1';
export const description = 'The fs operator gives access to a single folder on the filesystem.';

export const configSchema = () => {
  return of(
    z.object({
      directory: z.string().describe('The directory of the files'),
    }).describe('Configuration for the fs process operator')
  );
};

export const inputSchema = () => {
  return of(
    z.object({
      file: z.string().describe('The filename to read, e.g., readme.md'),
    }).describe('Input for the fs process operator')
  );
};

export const outputSchema = () => {
  return of(
    z.object({
      contents: z.string().describe('The contents of the file'),
    }).describe('Output from the fs process operator')
  );
};

const setupOperator = (config) => {
  return pipe(
    of(config),
    catchError((error) => {
      console.error('Error during setup:', error);
      return of(null);
    }),
    switchMap((config) => {
      let adapter;
      if (typeof Deno !== 'undefined') {
        adapter = fileSystemAccess.deno;
      } else if (typeof window !== 'undefined') {
        adapter = fileSystemAccess.browser;
      } else if (typeof process !== 'undefined') {
        adapter = fileSystemAccess.node;
      } else {
        throw new Error('Unsupported environment for file-system-access ponyfill');
      }
      return of(fileSystemAccess.getOriginPrivateDirectory(adapter, config.directory));
    })
  );
};

const statusOperator = (operable) => {
  return tap({
    next: (value) => {
      operable.status$.next({
        status: 'reading',
        message: `Reading file: ${value.file}`,
        detail: value
      });
    },
    error: (error) => {
      operable.status$.next({
        status: 'error',
        message: `Error reading file: ${error.message}`,
        detail: error
      });
    },
    complete: () => {
      operable.status$.next({
        status: 'complete',
        message: 'File read complete',
        detail: null
      });
    }
  });
};

export default (operable) => {
  return pipe(
    setupOperator(operable.config),
    switchMap((directoryHandle) => {
      return operable.input$.pipe(
        switchMap(async (input) => {
          try {
            const fileHandle = await directoryHandle.getFileHandle(input.file);
            const file = await fileHandle.getFile();
            const contents = await file.text();
            operable.status$.next({
              status: 'success',
              message: `File read successfully: ${input.file}`,
              detail: { file: input.file }
            });
            return { contents };
          } catch (error) {
            operable.status$.next({
              status: 'error',
              message: `Error reading file: ${error.message}`,
              detail: error
            });
            throw error;
          }
        }),
        statusOperator(operable)
      );
    }),
    catchError((error, caught) => {
      operable.status$.next({
        status: 'error',
        message: `Unhandled error: ${error.message}`,
        detail: error
      });
      return caught;
    })
  );
};