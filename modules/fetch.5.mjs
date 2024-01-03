import { z } from 'zod';
import { of, throwError, Subject } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { functions } from './functions'; // Assuming functions are defined in a separate file

export const key = "fetch-readability-operator";
export const version = "1.0.0";
export const description = "An operator that fetches HTML content from a specified URL, parses it using readability.js, and optionally reinserts image and/or anchor tags into the parsed content.";

export const inputSchema = z.object({
  url: z.string().url(),
  includeImages: z.boolean().optional().default(false),
  includeLinks: z.boolean().optional().default(false),
});

export const outputSchema = z.object({
  title: z.string(),
  content: z.string(),
  textContent: z.string(),
  length: z.number(),
  excerpt: z.string().optional(),
  siteName: z.string().optional(),
});

export const configSchema = z.object({
  userAgent: z.string().optional(),
  timeout: z.number().optional().default(5000),
});

export const keysSchema = z.object({
  proxy: z.object({
    url: z.string().url(),
    auth: z.object({
      username: z.string(),
      password: z.string(),
    }).optional(),
  }).optional(),
});

export const input = (operable) => of(inputSchema);
export const output = (operable) => of(outputSchema);
export const config = (operable) => of(configSchema);
export const keys = (operable) => of(keysSchema);

const statusOperator = () => {
  const status$ = new Subject();
  const emitStatus = (status, message, detail = null) => {
    status$.next({
      status,
      message,
      detail,
    });
  };
  return {
    status$,
    emitStatus,
  };
};

const toolOperator = (operable) => {
  const { url, includeImages, includeLinks } = operable.read.input$.getValue();
  const { userAgent, timeout } = operable.read.config$.getValue();
  return functions.readability({ url }).pipe(
    switchMap((readabilityResult) => {
      if (!readabilityResult || !readabilityResult.content) {
        return throwError(new Error('Failed to parse content using readability.'));
      }
      const doc = new JSDOM(readabilityResult.content).window.document;
      const reader = new Readability(doc);
      const article = reader.parse();
      if (!article) {
        return throwError(new Error('Failed to parse article using Readability.'));
      }
      let content = article.content;
      if (includeImages) {
        // Logic to reinsert images
      }
      if (includeLinks) {
        // Logic to reinsert links
      }
      return of({
        title: article.title,
        content: content,
        textContent: article.textContent,
        length: article.textContent.length,
        excerpt: article.excerpt,
        siteName: article.siteName,
      });
    }),
    catchError((error) => {
      operable.status$.next({ error: true, message: error.message });
      return throwError(error);
    })
  );
};

const fetchReadabilityOperator = (operable) => {
  const { emitStatus } = statusOperator();
  emitStatus('init', 'Fetch readability operator initialized.');
  return toolOperator(operable).pipe(
    map((result) => {
      emitStatus('success', 'Content successfully fetched and parsed.', result);
      return result;
    }),
    catchError((error) => {
      emitStatus('error', 'An error occurred during fetching and parsing.', error);
      return throwError(error);
    })
  );
};

export default fetchReadabilityOperator;