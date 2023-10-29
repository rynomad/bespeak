import { html } from "https://esm.sh/lit@2.8.0";
import { CONFIG, API_KEY, PAYLOAD } from "./types/gpt.js";
import { deepEqual } from "https://esm.sh/fast-equals";
import BespeakComponent from "./component.js";
import OpenAI from "https://esm.sh/openai@4.11.0";

export default class GPTCall extends BespeakComponent {
    static keys = API_KEY.schema;
    static config = CONFIG.schema;
    static output = PAYLOAD;

    icon = "openai";

    async _call(options, cb) {
        const openai = new OpenAI({
            apiKey: options.apiKey,
            dangerouslyAllowBrowser: true,
        });
        delete options.apiKey;

        const remainder = (options.n || 1) - 1;
        const streamOptions = {
            ...options,
            stream: true,
            n: 1,
            user: `stream`,
        };

        const stream = await openai.chat.completions.create(streamOptions);

        let streamContent = "";

        const remainderResponses = [];
        for (let i = 0; i < remainder; i += 10) {
            const batchSize = Math.min(remainder - i, 10);
            const remainderOptions = {
                ...options,
                n: batchSize,
                user: `remainder-${i}`,
            };
            remainderResponses.push(
                openai.chat.completions.create(remainderOptions)
            );
        }

        const messagesOutput = (
            await Promise.all([
                (async () => {
                    for await (const part of stream) {
                        const delta = part.choices[0]?.delta?.content || "";
                        streamContent += delta;
                        cb?.(streamContent);
                    }
                    return {
                        content: streamContent,
                        role: "assistant",
                    };
                })(),
                Promise.all(remainderResponses).then((responses) => {
                    return responses.flatMap((e) =>
                        e.choices.map((e) => e.message)
                    );
                }),
            ])
        )
            .flat()
            .map((msg) => options.messages.concat([msg]));

        return messagesOutput;
    }

    async _process(input, config, keys) {
        const threads = input
            .filter((e) => e.type === "GPT")
            .map((e) => e.threads)
            .flat();

        if (threads.length === 0) {
            return this.output;
        }

        const streamer = threads.shift();

        const proms = [];
        proms.push(
            this._call(
                {
                    ...config,
                    ...keys,
                    messages: streamer,
                },
                (response) => {
                    this.output = {
                        ...this.output,
                        response,
                    };
                }
            )
        );

        for (const thread of threads) {
            proms.push(
                this._call({
                    ...config,
                    ...keys,
                    messages: thread,
                })
            );
        }

        const outputThreads = await Promise.all(proms);

        return {
            ...this.output,
            threads: outputThreads,
        };
    }
}
