import { createClient } from 'openai';
import { z } from 'zod';
import zodToJsonSchema from '@deboxsoft/zod-to-json-schema';
import { BehaviorSubject, combineLatest, from, of } from 'rxjs';
import { switchMap, catchError, map } from 'rxjs/operators';

export const key = "GPT Operator";
export const version = "0.0.1";
export const description = "Processes an array of messages, appends a configured message, and makes API calls to generate responses using the OpenAI chat endpoint.";

export const input = (operable) => {
  const inputSchema = z.object({
    messages: z.array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
      })
    ),
  });
  return of(inputSchema);
};

export const output = (operable) => {
  const outputSchema = z.object({
    messages: z.array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
      })
    ),
  });
  return of(outputSchema);
};

export const config = (operable) => {
  const configSchema = z.object({
    prompt: z.string(),
    role: z.enum(["user", "assistant", "system"]).default("user"),
    temperature: z.number().min(0).max(1).step(0.1).default(0.3),
    model: z.string().default("gpt-4"),
    tools: z.enum(["user", "none", "all"]),
    clean: z.boolean(),
  });
  return of(configSchema);
};

export const keys = (operable) => {
  const keysSchema = z.object({
    apiKey: z.string(),
  });
  return of(keysSchema);
};

export const setupOperator = (operable) => {
  return combineLatest([operable.data.keys])
    .pipe(
      switchMap(([keys]) => {
        const openai = createClient({
          apiKey: keys.apiKey,
          dangerouslyAllowBrowser: true
        });
        return from(Promise.resolve(openai));
      })
    );
};

export const toolOperator = (operable) => {
  // Implementation of the tool operator
};

export const statusOperator = (operable, runner) => {
  // Implementation of the status operator
};

const processOperator = (operable) => {
  // Implementation of the process operator logic
};

export default processOperator;