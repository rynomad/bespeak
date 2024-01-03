import { OpenAI } from "openai";
import {
    BehaviorSubject,
    combineLatest,
    from,
    of,
    switchMap,
    withLatestFrom,
} from "rxjs";
import { map } from "rxjs/operators";
import { z } from "zod";
import { zodToJsonSchema } from "@deboxsoft/zod-to-json-schema";

export const key = "GPT Operator";
export const version = "0.0.1";
export const description =
    "The operator takes an array of messages as input, appends a configured message, and then calls the openai chat endpoint.";

export const input = () => {
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

export const output = () => {
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

export const config = () => {
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

export const keys = () => {
    const keysSchema = z.object({
        apiKey: z.string(),
    });
    return of(keysSchema);
};

export const setupOperator = (operable) => {
    return combineLatest([operable.data.keys]).pipe(
        switchMap(([keys]) => {
            const client = new OpenAI({
                apiKey: keys.apiKey,
                dangerouslyAllowBrowser: true,
            });
            return from(Promise.resolve(client));
        })
    );
};

export const toolOperator = (operable) => {
    const tools$ = operable.io.tools$;

    return tools$.pipe(
        switchMap((tools) => {
            if (!tools) {
                return from([]);
            }

            const transformedTools = tools.map((toolNode) => {
                const tool = {
                    name: toolNode.id,
                    function: async (args) => {
                        try {
                            return await toolNode.invokeAsFunction(args);
                        } catch (error) {
                            console.error(
                                `Error invoking tool ${toolNode.id}:`,
                                error
                            );
                            throw error;
                        }
                    },
                    parse: (args) => {
                        const schema = toolNode.schema.input$.getValue();
                        return schema.parse(args);
                    },
                    description: toolNode.meta$.getValue().description,
                    parameters: zodToJsonSchema(
                        toolNode.schema.input$.getValue()
                    ),
                };
                return tool;
            });

            return from(transformedTools);
        })
    );
};

export const statusOperator = (operable, runner) => {
    const eventsToMonitor = [
        "connect",
        "chunk",
        "chatCompletion",
        "message",
        "content",
        "functionCall",
        "functionCallResult",
        "finalChatCompletion",
        "finalContent",
        "finalMessage",
        "finalFunctionCall",
        "finalFunctionCallResult",
        "error",
        "abort",
        "totalUsage",
        "end",
    ];

    eventsToMonitor.forEach((event) => {
        runner.on(event, (detail) => {
            operable.status$.next({
                status: event,
                message: `Received ${event} event`,
                detail: detail,
            });
        });
    });
};

export default (operable) => {
    return combineLatest([
        setupOperator(operable),
        operable.data.config,
        operable.data.input,
        toolOperator(operable),
    ]).pipe(
        switchMap(([client, config, input, tools]) => {
            input.messages.push({
                role: config.role,
                content: config.prompt,
            });

            const runner =
                tools.length > 0
                    ? client.beta.chat.completions.runTools({
                          model: config.model,
                          messages: input.messages,
                          tools: tools,
                          temperature: config.temperature,
                      })
                    : client.beta.chat.completions.stream({
                          model: config.model,
                          messages: input.messages,
                          temperature: config.temperature,
                      });

            statusOperator(operable, runner);

            return from(runner.finalMessage()).pipe(
                map((finalMessage) => {
                    input.messages.push(finalMessage);
                    return {
                        messages: input.messages,
                    };
                })
            );
        })
    );
};
