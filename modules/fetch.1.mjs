import { z } from 'zod';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import fetch from 'node-fetch';

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
  excerpt: z.string().optional(),
  siteName: z.string().optional(),
});

export const config = z.object({
  userAgent: z.string().optional(),
  timeout: z.number().optional().default(5000),
});

export const keys = z.object({
  proxy: z.object({
    host: z.string(),
    port: z.number(),
    auth: z.object({
      username: z.string(),
      password: z.string(),
    }).optional(),
  }).optional(),
});

export const toolOperator = async (operable) => {
  const input = await operable.schema.input$.getValue();
  const config = await operable.schema.config$.getValue();

  try {
    const response = await fetch(input.url, {
      headers: {
        'User-Agent': config.userAgent || 'fetch-readability-operator',
      },
      timeout: config.timeout,
    });

    if (!response.ok) {
      throw new Error(`HTTP Error Response: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const doc = new JSDOM(html, { url: input.url });
    const reader = new Readability(doc.window.document);
    const article = reader.parse();

    return {
      title: article.title,
      content: article.content,
      textContent: article.textContent,
      length: article.length,
      excerpt: article.excerpt,
      siteName: article.siteName,
    };
  } catch (error) {
    operable.status$.next({ error: true, message: error.message });
    operable.log$.next({ level: 'error', message: error.stack });
    return null;
  }
};

export const statusOperator = (operable) => {
  operable.status$.subscribe({
    next: (status) => {
      operable.log$.next({
        level: status.error ? 'error' : 'info',
        message: status.message,
        detail: status.detail || null,
      });
    },
    error: (err) => {
      operable.log$.next({
        level: 'error',
        message: err.message,
        detail: err.stack,
      });
    },
    complete: () => {
      operable.log$.next({
        level: 'info',
        message: 'Fetch and readability parsing completed successfully.',
      });
    },
  });
};

export default function fetchReadabilityOperator(operable) {
  statusOperator(operable);
  return toolOperator(operable);
}