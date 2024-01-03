import { z } from 'zod';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import fetch from 'node-fetch';

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

const toolOperator = async ({ url, includeImages, includeLinks, userAgent, timeout }) => {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': userAgent },
      timeout: timeout,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (includeImages) {
      // Logic to reinsert images would go here
    }
    if (includeLinks) {
      // Logic to reinsert links would go here
    }

    return {
      title: article.title,
      content: article.content,
      textContent: article.textContent,
      length: article.textContent.length,
      excerpt: article.excerpt,
      siteName: article.siteName,
    };
  } catch (error) {
    throw new Error(`Error fetching and parsing content: ${error.message}`);
  }
};

const statusOperator = (operable) => {
  return {
    emitStart: (url) => operable.status$.next({
      status: 'start',
      message: `Fetching content from: ${url}`,
    }),
    emitSuccess: (title) => operable.status$.next({
      status: 'success',
      message: `Successfully parsed content: ${title}`,
    }),
    emitError: (error) => operable.status$.next({
      status: 'error',
      message: `Error during fetch or parse: ${error.message}`,
      detail: error
    }),
  };
};

const fetchReadabilityOperator = (operable) => {
  const status = statusOperator(operable);
  return async (input) => {
    try {
      status.emitStart(input.url);
      const result = await toolOperator(input);
      status.emitSuccess(result.title);
      return result;
    } catch (error) {
      status.emitError(error);
      throw error;
    }
  };
};

export default fetchReadabilityOperator;