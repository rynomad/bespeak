import { readFile } from 'file-system-access';
import { z } from 'zod';
import { pipe, catchError, of, switchMap } from 'rxjs';
import { map } from 'rxjs/operators';

export const key = 'fs';
export const version = '0.0.1';
export const description = 'The fs operator gives access to a single folder on the filesystem.';

export const inputSchema = z.object({
  file: z.string().min(1).describe('Filename to read from the filesystem'),
});

export const outputSchema = z.object({
  contents: z.string().describe('Contents of the file'),
});

export const configSchema = z.object({
  directory: z.string().min(1).describe('Directory of the files'),
});

const readFromFileSystem = (directory, file) => {
  const fullPath = `${directory}/${file}`;
  return readFile(fullPath)
    .then((contents) => ({ contents }))
    .catch((error) => {
      throw new Error(`Error reading file ${fullPath}: ${error.message}`);
    });
};

export default (operable) => {
  return pipe(
    switchMap((input) =>
      operable.read.config$.pipe(
        map((config) => readFromFileSystem(config.directory, input.file)),
        catchError((error) => of({ error: error.message }))
      )
    )
  );
};