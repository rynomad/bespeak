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
    take,
} from "rxjs";

export const key = "gpt";
export const version = "0.0.1";
export const type = "process";
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
    // console.log("CONFIG");
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
        // tap((models) => console.log("GPT Operator models", models)),
        map((models) => {
            return z.object({
                prompt: z.string(),
                role: z.enum(["user", "assistant", "system"]).default("user"),
                temperature: z.number().min(0).max(1).step(0.1).default(0.3),
                model: z.enum(models).default("gpt-4"),
                tools: z.enum(["user", "none", "all"]).default("none"),
                clean: z.boolean().default(false),
                json: z.boolean().default(false),
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
            const client = new OpenAI({
                apiKey: keys.apiKey,
                dangerouslyAllowBrowser: true,
            });
            return client;
        })
    );
};

export const toolOperator = (operable) => {
    return combineLatest(operable.io.tools$, operable.io.downstream$).pipe(
        switchMap(([tools]) => {
            if (!tools) {
                return of([]);
            }

            return of(
                tools.map((toolNode) => {
                    const toolFunction = async (args) => {
                        try {
                            return await toolNode.invokeAsFunction(args);
                        } catch (error) {
                            return `Error invoking tool function: ${error}`;
                        }
                    };

                    const tool = {
                        name: toolNode.id,
                        type: "function",
                        function: toolFunction,
                        parse: (args) =>
                            toolNode.schema.input$.getValue().parse(args),
                        description: toolNode.meta$.getValue().description,
                        parameters: zodToJsonSchema(
                            toolNode.schema.input$.getValue()
                        ),
                    };

                    return tool;
                })
            );
        }),
        withLatestFrom(operable.io.downstream$),
        map(([tools, downstream]) => {
            if (!downstream || downstream.length <= 1) {
                return tools;
            }

            // make a zod schema for downstreamId based on the downstream nodes
            const downstreamSchema = z.object({
                downstreamId: z.enum(downstream.map((node) => node.id)),
            });

            return tools.concat({
                type: "function",
                function: {
                    name: "downstream_router",
                    function: (args, runner) => {
                        const downstreamId = args.downstreamId;
                        const _downstream = downstream.find(
                            (node) => node.id === downstreamId
                        );

                        if (!_downstream) {
                            return `Downstream node ${downstreamId} not found`;
                        }
                        runner.abort();
                        const messages = runner.messages.filter(
                            (message) =>
                                ["user", "assistant"].includes(message.role) &&
                                message.content
                        );
                        console.log("Downstream messages", messages);
                        return _downstream.write.input$.next({ messages });
                    },
                    parse: (str) => downstreamSchema.parse(JSON.parse(str)),
                    description:
                        "Route to a specific downstream node. Only use this if the user has specified conditional logic for where to send messages in the prompt.",
                    parameters: zodToJsonSchema(downstreamSchema),
                },
            });
        }),
        catchError((error) => {
            console.error(`Error processing tools: ${error}`);
            return of([]);
        })
    );
};

export const statusOperator = (operable, runner) => {
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

    let message = "";
    events.forEach((event) => {
        runner.on(event, (detail, snapshot) => {
            operable.status$.next({
                status: event,
                message: `Event ${event} received`,
                detail,
            });

            // console.log("GPT Operator event", event, detail, snapshot);

            switch (event) {
                case "connect":
                    operable.write.state$.next({
                        state: "started",
                        message: `Connected to OpenAI...`,
                    });
                    break;
                case "finalContent":
                case "content":
                    message = snapshot || detail;
                    operable.write.state$.next({
                        state: "running",
                        message,
                    });
                    break;
                case "end":
                    operable.write.state$.next({
                        state: "stopped",
                        message,
                    });
                    break;
                case "error":
                    operable.write.state$.next({
                        state: "error",
                        message: `Error: ${detail}`,
                    });
                    break;
                default:
                    break;
            }
        });
    });
};

export default function processOperator(operable) {
    // console.log("GPT Operator operable", operable.id);

    const setup$ = new Subject();

    combineLatest(
        setupOperator(operable),
        toolOperator(operable),
        operable.read.config$
    ).subscribe(setup$);

    return (input$) =>
        combineLatest(input$, setup$).pipe(
            switchMap(([input, [client, tools, config]]) => {
                // console.log("GPT Operator input", input, tools, config);
                const newMessage = {
                    role: config.role,
                    content: config.prompt,
                };
                const messages = [
                    {
                        role: "system",
                        content: "respond with json (jsend). use strict mode.",
                    },
                    ...input.messages,
                    newMessage,
                ];

                const useStream =
                    (config.tools !== "none" || !tools.length) &&
                    !tools.find(
                        (tool) => tool.function?.name === "downstream_router"
                    );

                let toolExtra = {};
                if (config.tools === "none") {
                    tools = tools.filter(
                        (tool) => tool.function?.name === "downstream_router"
                    );
                    toolExtra = {
                        tool_choice: {
                            type: "function",
                            function: {
                                name: "downstream_router",
                            },
                        },
                    };
                }

                const runner = useStream
                    ? client.beta.chat.completions.stream({
                          model: config.model,
                          messages,
                          response_format: {
                              type: "json_object",
                          },
                      })
                    : client.beta.chat.completions.runTools({
                          model: config.model,
                          messages,
                          tools,
                          ...toolExtra,
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
