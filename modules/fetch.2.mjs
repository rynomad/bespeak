import { z } from 'zod';
import { combineLatest, map, tap, of, throwError, catchError, switchMap } from 'rxjs';
import { functions } from './functions';

export const key = "fetch-readability-operator";
export const version = "1.0.0";
export const description = "An operator that fetches HTML content from a specified URL, parses it using readability.js, and optionally reinserts image and/or anchor tags into the parsed content.";

export const input = z.object({
  url: z.string().url(),
  includeImages: z.boolean().optional().default(false),
  includeLinks: z.boolean().optional().default(false),
});

export const output = z.object({
  title: z.string(),
  content: z.string(),
  textContent: z.string(),
  length: z.number(),
  excerpt: z.string(),
  siteName: z.string(),
});

export const config = z.object({
  userAgent: z.string().optional(),
  timeout: z.number().optional().default(5000),
});

export const keys = z.object({
  proxy: z.object({
    url: z.string().url(),
    auth: z.object({
      username: z.string(),
      password: z.string(),
    }),
  }).optional(),
});

const setupOperator = (operable) => {
  return combineLatest(of(operable.data.config))
    .pipe(
      map(([config]) => {
        const fetchOptions = {
          headers: {}
        };
        if (config.userAgent) {
          fetchOptions.headers['User-Agent'] = config.userAgent;
        }
        if (config.timeout) {
          fetchOptions.timeout = config.timeout;
        }
        return fetchOptions;
      })
    );
};

const toolOperator = (operable) => {
  return operable.io.tool$.pipe(
    switchMap((tools) => {
      const { readability } = tools.reduce((acc, tool) => {
        acc[tool.key] = tool;
        return acc;
      }, {});

      return operable.read.input$.pipe(
        switchMap((input) => {
          return functions.readability({ url: input.url }).pipe(
            catchError((error) => {
              return throwError(() => new Error(`Failed to fetch or parse content: ${error.message}`));
            }),
            map((parsedContent) => {
              if (input.includeImages) {
                // Logic to reinsert images goes here
              }
              if (input.includeLinks) {
                // Logic to reinsert links goes here
              }
              return {
                title: parsedContent.title,
                content: parsedContent.content,
                textContent: parsedContent.textContent,
                length: parsedContent.textContent.length,
                excerpt: parsedContent.excerpt,
                siteName: parsedContent.siteName,
              };
            })
          );
        })
      );
    })
  );
};

const statusOperator = (operable) => {
  return tap({
    next: (value) => {
      operable.status$.next({
        status: 'success',
        message: 'Content fetched and parsed successfully',
        detail: value
      });
    },
    error: (error) => {
      operable.status$.next({
        status: 'error',
        message: 'Error occurred during fetch and parse',
        detail: error.message
      });
    },
    complete: () => {
      operable.status$.next({
        status: 'complete',
        message: 'Fetch and parse operation completed',
        detail: null
      });
    }
  });
};

export default function fetchReadabilityOperator(operable) {
  return combineLatest(
    setupOperator(operable),
    toolOperator(operable).pipe(statusOperator(operable))
  ).pipe(
    switchMap(([fetchOptions, content]) => {
      return of(content);
    })
  );
}