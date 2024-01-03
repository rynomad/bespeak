import { z } from 'zod';
import { zodToJsonSchema } from '@deboxsoft/zod-to-json-schema';
import OpenAI from 'openai-node';
import { BehaviorSubject, combineLatest, from, of, pipe, tap, withLatestFrom, switchMap } from 'rxjs';

export const key = "GPT Operator";
export const version = "0.0.1";
export const description = "The operator takes an array of messages as input, appends a configured message, and then calls the openai chat endpoint.";

export const inputSchema = z.array(
  z.object({
    role: z.enum(["user", "assistant", "system"]),
    content: z.string(),
  })
).description("An array of message objects, as expected by the openai API.");

export const outputSchema = z.array(
  z.object({
    role: z.enum(["user", "assistant", "system"]),
    content: z.string(),
  })
).description("The total message array, including all received messages, optionally filtered based on configuration");

export const configSchema = z.object({
  prompt: z.string().description("The prompt content to be appended to the incoming message array."),
  role: z.enum(["user", "assistant", "system"]).default("user"),
  temperature: z.number().min(0).max(1).step(0.1).default(0.3),
  model: z.string().default("gpt-4"),
  tools: z.enum(["user", "none", "all"]),
  clean: z.boolean().description("Whether to strip system and/or user messages from the returned message history."),
}).description("Configuration for the GPT Operator.");

export const keysSchema = z.object({
  apiKey: z.string().description("The apiKey for the openai client."),
}).description("Keys required for the GPT Operator to function.");

export const setupOperator = (operable) => {
  return combineLatest(operable.data.keys)
    .pipe(
      map((keys) => {
        const client = new OpenAI({
          apiKey: keys.apiKey,
          dangerouslyAllowBrowser: true
        });
        return client;
      })
    );
};

export const toolOperator = (operable) => {
  const tools$ = operable.io.tools$ || of([]);
  return tools$.pipe(
    switchMap((tools) =>
      from(tools).pipe(
        map((toolNode) => {
          const metadata = toolNode.meta$.getValue();
          const inputSchema = toolNode.schema.input$.getValue();
          const jsonSchema = zodToJsonSchema(inputSchema, toolNode.id);
          return {
            name: toolNode.id,
            function: async (args) => {
              try {
                return await toolNode.invokeAsFunction(args);
              } catch (error) {
                console.error(`Error invoking tool ${toolNode.id}:`, error);
                throw error;
              }
            },
            parse: inputSchema.parse,
            description: metadata.description,
            parameters: jsonSchema,
          };
        })
      )
    )
  );
};

export const statusOperator = (operable, runner) => {
  const eventsToMonitor = [
    'connect', 'chunk', 'chatCompletion', 'message', 'content', 'functionCall',
    'functionCallResult', 'finalChatCompletion', 'finalContent', 'finalMessage',
    'finalFunctionCall', 'finalFunctionCallResult', 'error', 'abort', 'totalUsage', 'end',
  ];

  eventsToMonitor.forEach(event => {
    runner.on(event, (detail) => {
      operable.status$.next({
        status: event,
        message: `Received ${event} event from OpenAI API`,
        detail: detail
      });
    });
  });

  return tap(() => {});
};

export default function gptOperatorFactory(operable) {
  return pipe(
    withLatestFrom(setupOperator(operable), toolOperator(operable)),
    switchMap(([input, client, tools]) => {
      const config = operable.data.config.getValue();
      const messages = [...input.messages, { role: config.role, content: config.prompt }];
      const method = tools.length > 0 ? 'runTools' : 'stream';
      const runner = client.chat.completions[method]({
        model: config.model,
        messages: messages,
        temperature: config.temperature,
        tools: tools,
      });
      statusOperator(operable, runner);
      return from(runner.finalMessage()).pipe(
        map((finalMessage) => {
          const updatedMessages = [...messages, finalMessage];
          if (config.clean) {
            return updatedMessages.filter(msg => msg.role !== 'system');
          }
          return updatedMessages;
        })
      );
    })
  );
}