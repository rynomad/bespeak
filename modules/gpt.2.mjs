import { z } from "zod";
import { zodToJsonSchema } from "@deboxsoft/zod-to-json-schema";
import { OpenAI } from "openai";
import {
    combineLatest,
    map,
    switchMap,
    tap,
    catchError,
    debounceTime,
    share,
    of,
    from,
    withLatestFrom,
    pipe,
    concat,
    Observable,
    skipUntil,
    filter,
    buffer,
    Subject,
} from "rxjs";
import { take } from "npm:rxjs@^7.8.1";

export const key = "GPT Operator";
export const version = "0.0.1";
export const description =
    "The operator takes an array of messages as input, appends a configured message, and then calls the openai chat endpoint.";

export const input = (operable) => {
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

export const output = (operable) => {
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

export const config = (operable) => {
    console.log("CONFIG");
    const models$ = operable.read.keys$.pipe(
        switchMap((keys) =>
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
        tap((models) => console.log("GPT Operator models", models)),
        map((models) => {
            return z.object({
                prompt: z.string(),
                role: z.enum(["user", "assistant", "system"]).default("user"),
                temperature: z.number().min(0).max(1).step(0.1).default(0.3),
                model: z.enum(models).default("gpt-4"),
                tools: z.enum(["user", "none", "all"]).default("none"),
                clean: z.boolean().default(false),
            });
        })
    );
};

export const keys = (operable) => {
    const schema = z.object({
        apiKey: z.string(),
    });
    return of(schema);
};

const getModels = async ({ apiKey }) => {
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
};

export const setupOperator = (operable) => {
    return operable.read.keys$.pipe(
        filter((keys) => keys?.apiKey),
        map((keys) => {
            if (!keys || !keys.apiKey) {
                throw new Error("API key is required for the OpenAI client.");
            }
            const client = new OpenAI({
                apiKey: keys.apiKey,
                dangerouslyAllowBrowser: true,
            });
            return client;
        })
    );
};

export const toolOperator = (operable) => {
    return operable.io.tools$.pipe(
        switchMap((tools) => {
            if (!tools) {
                return of([]);
            }

            return of(
                tools.map((toolNode) => {
                    const toolFunction = async (args) => {
                        try {
                            return await toolNode.invokeAsFunction(args);
                        } catch (error) {
                            console.error(
                                `Error invoking tool function: ${error}`
                            );
                            throw error;
                        }
                    };

                    const tool = {
                        name: toolNode.id,
                        function: toolFunction,
                        parse: (args) =>
                            toolNode.process.operator$
                                .getValue()
                                .schema.parse(args),
                        description: toolNode.meta$.getValue().description,
                        parameters: zodToJsonSchema(
                            toolNode.process.operator$.getValue().schema
                        ),
                    };

                    return tool;
                })
            );
        }),
        catchError((error) => {
            console.error(`Error processing tools: ${error}`);
            return of([]);
        })
    );
};

export const statusOperator = (operable, runner) => {
    return tap({
        next: () => {
            const events = [
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

            events.forEach((event) => {
                runner.on(event, (detail) => {
                    operable.status$.next({
                        status: event,
                        message: `Event ${event} received`,
                        detail,
                    });
                });
            });
        },
    });
};

const bufferUntil = (notifier) => (source) => {
    return new Observable((subscriber) => {
        const buffer$ = source.pipe(buffer(notifier), take(1), share());
        const passthrough$ = source.pipe(skipUntil(buffer$.toPromise()));

        concat(buffer$.pipe(switchMap((inputs) => from(inputs))), passthrough$)
            .pipe(tap((i) => console.log("bufferUntil", i)))
            .subscribe(subscriber);
    });
};

export default function processOperator(operable) {
    console.log("GPT Operator operable", operable.id);

    const setup$ = new Subject();

    combineLatest(
        setupOperator(operable),
        toolOperator(operable),
        operable.read.config$
    ).subscribe(setup$);

    return (input$) =>
        combineLatest(input$, setup$).pipe(
            switchMap(([input, [client, tools, config]]) => {
                console.log("GPT Operator input", input, tools, config);
                const newMessage = {
                    role: config.role,
                    content: config.prompt,
                };
                const messages = [...input.messages, newMessage];

                const useStream = config.tools !== "none" || !tools.length;
                const runner = useStream
                    ? client.beta.chat.completions.stream({
                          model: config.model,
                          messages,
                      })
                    : client.beta.chat.completions.runTools({
                          model: config.model,
                          messages,
                          tools,
                      });

                statusOperator(operable, runner);

                return from(runner.finalMessage()).pipe(
                    map((finalMessage) => {
                        const updatedMessages = [...messages, finalMessage];
                        return {
                            messages: updatedMessages,
                        };
                    }),
                    catchError((error) => {
                        console.error(`Error in processOperator: ${error}`);
                        operable.status$.next({
                            status: "error",
                            message: `Error in processOperator: ${error.message}`,
                        });
                        throw error;
                    })
                );
            })
        );
}
