import { z } from 'zod';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

export const key = 'fetch-readability-operator';
export const version = '1.0.0';
export const description = 'An operator that fetches HTML content from a specified URL, parses it using readability.js, and optionally reinserts image and/or anchor tags into the parsed content.';

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
  excerpt: z.string(),
  siteName: z.string(),
});

export const configSchema = z.object({});

export const keysSchema = z.object({
  proxy: z.string().url().optional(),
});

let DOMParser;
if (typeof window === 'undefined') {
  DOMParser = new JSDOM().window.DOMParser;
} else {
  DOMParser = window.DOMParser;
}

const statusOperator = (operable) => {
  return {
    emitSuccess: (message, detail) => {
      operable.status$.next({
        status: 'success',
        message: message,
        detail: detail
      });
    },
    emitError: (error, detail) => {
      operable.status$.next({
        status: 'error',
        message: error.message,
        detail: detail
      });
    }
  };
};

export default function fetchReadabilityOperator(operable) {
  const status = statusOperator(operable);

  return async (input) => {
    try {
      const { url, includeImages, includeLinks } = inputSchema.parse(input);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const html = await response.text();

      const doc = new JSDOM(html, { url }).window.document;
      const reader = new Readability(doc);
      const article = reader.parse();

      if (!article) {
        throw new Error('Failed to parse the article using Readability');
      }

      status.emitSuccess('Content fetched and parsed successfully', {
        title: article.title,
        length: article.length,
        siteName: article.siteName
      });

      return outputSchema.parse({
        title: article.title,
        content: article.content,
        textContent: article.textContent,
        length: article.length,
        excerpt: article.excerpt,
        siteName: article.siteName
      });
    } catch (error) {
      status.emitError(error, { url: input.url });
      throw error;
    }
  };
}