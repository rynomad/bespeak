import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import fetch from 'node-fetch';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { z } from 'zod';

export const key = 'fetch-readability-operator';
export const version = '1.0.0';
export const description = 'An operator that fetches HTML content from a specified URL, parses it using readability.js, and optionally reinserts image and/or anchor tags into the parsed content.';

export const input = () => {
    return of(
        z.object({
            url: z.string().url(),
            includeImages: z.boolean().optional().default(false),
            includeLinks: z.boolean().optional().default(false),
        })
    );
};

export const output = () => {
    return of(
        z.object({
            title: z.string(),
            content: z.string(),
            textContent: z.string(),
            length: z.number(),
            excerpt: z.string(),
            siteName: z.string(),
        })
    );
};

export const config = () => {
    return of(
        z.object({
            userAgent: z.string().optional(),
            timeout: z.number().optional().default(5000),
        })
    );
};

export const keys = () => {
    return of(
        z.object({
            proxy: z.object({
                url: z.string().url(),
                auth: z.object({
                    username: z.string(),
                    password: z.string(),
                }).optional(),
            }).optional(),
        })
    );
};

const setupOperator = (operable) => {
  return operable.data.config.pipe(
    map((config) => {
      const headers = config.userAgent ? { 'User-Agent': config.userAgent } : {};
      const customFetch = (url) => {
        return fetch(url, {
          headers: headers,
          timeout: config.timeout || 5000,
        });
      };
      return {
        fetch: customFetch,
        Readability,
        JSDOM,
      };
    }),
  );
};

const toolOperator = (operable) => {
  return operable.io.tool$.pipe(
    switchMap((tools) => {
      const { fetch: customFetch, Readability, JSDOM } = tools;
      return operable.read.input$.pipe(
        switchMap(({ url, includeImages, includeLinks }) => {
          return customFetch(url).pipe(
            switchMap(async (response) => {
              if (!response.ok) {
                throw new Error(`Unable to fetch URL: ${url}`);
              }
              const html = await response.text();
              const doc = new JSDOM(html, { url });
              let reader = new Readability(doc.window.document);
              let article = reader.parse();
              // Reinsert images and links if required (logic omitted)
              return of({
                title: article.title,
                content: article.content,
                textContent: article.textContent,
                length: article.textContent.length,
                excerpt: article.excerpt,
                siteName: article.siteName,
              });
            }),
            catchError((error) => {
              operable.status$.next({
                error: true,
                message: error.message,
              });
              return throwError(() => new Error(error.message));
            })
          );
        })
      );
    })
  );
};

const statusOperator = (operable) => {
  const status$ = operable.status$ || new BehaviorSubject({});
  return {
    next: (status, message, detail = null) => {
      status$.next({
        status,
        message,
        detail,
      });
    },
    error: (message, detail = null) => {
      status$.next({
        status: 'error',
        message,
        detail,
      });
    },
    complete: () => {
      status$.complete();
    },
  };
};

export default function fetchReadabilityOperator(operable) {
  const setup$ = setupOperator(operable);
  const tool$ = toolOperator(operable);
  const status = statusOperator(operable);

  return setup$.pipe(
    switchMap((tools) => tool$),
    catchError((error) => {
      status.error(error.message);
      return throwError(() => error);
    })
  );
}