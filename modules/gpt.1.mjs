import { z } from 'zod';
import { OpenAI } from 'openai-node';
import { zodToJsonSchema } from '@deboxsoft/zod-to-json-schema';
import { BehaviorSubject, combineLatest, map, switchMap, tap, catchError, of, from, pipe, withLatestFrom } from 'rxjs';

export const key = "GPT Operator";
export const version = "0.0.1";
export const description = "The operator takes an array of messages as input, appends a configured message, and then calls the openai chat endpoint.";

export const inputSchema = (operable) => {
  const schema = z.object({
    messages: z.array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
      })
    ),
  });
  return of(schema);
};

export const outputSchema = (operable) => {
  const schema = z.object({
    messages: z.array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
      })
    ),
  });
  return of(schema);
};

export const configSchema = (operable) => {
  const models$ = operable.data.keys.pipe(
    switchMap(keys => 
      keys?.apiKey
        ? from(getModels(keys))
        : of([
            "gpt-4",
            "gpt-3.5-turbo-0613",
            "gpt-4-1106-preview",
            "gpt-3.5-turbo-1106",
            "gpt-4-vision-preview",
          ])
    )
  );

  return models$.pipe(
    map((models) => {
      const schema = z.object({
        prompt: z.string(),
        role: z.enum(["user", "assistant", "system"]).default("user"),
        temperature: z.number().min(0).max(1).step(0.1).default(0.3),
        model: z.enum(models).default("gpt-4"),
        tools: z.enum(["user", "none", "all"]),
        clean: z.boolean(),
      });
      return schema;
    })
  );
};

export const keysSchema = (operable) => {
  const schema = z.object({
    apiKey: z.string(),
  });
  return of(schema);
};

export const setupOperator = (operable) => {
  return combineLatest([operable.data.keys])
    .pipe(
      map(([keys]) => {
        const client = new OpenAI({
          apiKey: keys.apiKey,
          dangerouslyAllowBrowser: true,
        });
        return client;
      })
    );
};

export const toolOperator = (operable) => {
  // Implementation of the tool operator
};

export const statusOperator = (operable) => {
  return tap((runner) => {
    const eventsToMonitor = [
      'connect',
      'chunk',
      'chatCompletion',
      'message',
      'content',
      'functionCall',
      'functionCallResult',
      'finalChatCompletion',
      'finalContent',
      'finalMessage',
      'finalFunctionCall',
      'finalFunctionCallResult',
      'error',
      'abort',
      'totalUsage',
      'end',
    ];

    eventsToMonitor.forEach((event) => {
      runner.on(event, (detail) => {
        operable.status$.next({
          status: event,
          message: `Received ${event} event`,
          detail,
        });
      });
    });
  });
};

export default function gptOperatorFactory(operable) {
  return pipe(
    withLatestFrom(setupOperator(operable), toolOperator(operable)),
    switchMap(([input, client, tools]) => {
      // Main logic of the process operator
      // Append configured prompt and role to the messages array
      // Call the OpenAI API
      // Use the status operator to emit status events
      // Finalize the message array and emit the completed output
    }),
    statusOperator(operable)
  );
}

async function getModels({ apiKey }) {
  const openai = new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true,
  });
  const response = await openai.models.list();
  try {
    return response.data
      .map((model) => model.id)
      .filter((id) => id.startsWith("gpt"));
  } catch (e) {
    console.warn(e);
    return [
      "gpt-4",
      "gpt-3.5-turbo-0613",
      "gpt-4-1106-preview",
      "gpt-3.5-turbo-1106",
      "gpt-4-vision-preview",
    ];
  }
}