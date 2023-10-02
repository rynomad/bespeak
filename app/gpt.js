import { LitElement, html, css } from "https://esm.sh/lit";
import OpenAI from "https://esm.sh/openai";
import { Types } from "./types.js";
export default class ChatGPT extends LitElement {
    static get properties() {
        return {
            chat_input: { type: Types.get("chat") },
            prompt_input: { type: Types.get("prompt") },
            config: { type: Types.get("config") },
            api_key: { type: Types.get("api-key") },
            response_output: { type: Object },
            chat_output: { type: Types.get("chat") },
        };
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        if (this.shouldCallOpenAI(changedProperties)) {
            if (this.callInProgress) {
                this.callPending = true;
            } else {
                this.callOpenAI();
            }
        }
    }

    shouldCallOpenAI(changedProperties) {
        if (this.hasAllInputs && this.didInputsChange && !this.isFromCache) {
            return true;
        }

        return false;
    }

    async callOpenAI() {
        this.callInProgress = true;
        const { config, prompt_input, api_key, chat_input } = this;
        const openai = new OpenAI({
            apiKey: api_key.api_key,
            dangerouslyAllowBrowser: true,
        });

        const messages = (chat_input?.messages || [])
            .map((message) =>
                !Array.isArray(message) || config.chooser === "all"
                    ? message
                    : message[0]
            )
            .concat([
                {
                    ...prompt_input,
                    role: prompt_input.role || "user",
                },
            ])
            .flat();

        const options = {
            model: config.model,
            temperature: config.temperature,
            n: config.quantity,
            messages,
        };

        const remainder = options.n - 1;

        const streamOptions = {
            ...options,
            stream: true,
            n: 1,
        };

        const stream = await openai.chat.completions.create(streamOptions);

        let streamContent = "";

        const remainderResponses = [];
        for (let i = 0; i < remainder; i += 10) {
            const batchSize = Math.min(remainder - i, 10);
            const remainderOptions = {
                ...options,
                n: batchSize,
            };
            remainderResponses.push(
                openai.chat.completions.create(remainderOptions)
            );
        }

        const allResponses = (
            await Promise.all([
                (async () => {
                    for await (const part of stream) {
                        const delta = part.choices[0]?.delta?.content || "";
                        streamContent += delta;
                        this.response_output = {
                            content: streamContent,
                        };
                    }
                    return streamContent;
                })(),
                Promise.all(remainderResponses).then((responses) => {
                    return responses.flatMap((e) =>
                        e.choices.map((e) => e.message.content)
                    );
                }),
            ])
        )
            .flat()
            .map((e) => ({
                role: "assistant",
                content: e,
            }));

        this.chat_output = {
            messages: [...messages, allResponses],
        };

        this.callInProgress = false;
        if (this.callPending) {
            this.callPending = false;
            this.callOpenAI();
        }
    }

    static styles = css`
        :host {
            display: block;
        }
    `;

    handleMessage({ content }) {
        this.prompt_input = {
            role: this.config.role,
            content,
        };
    }

    render() {
        return html`
            <bespeak-chat
                .handleMessage=${this.handleMessage.bind(this)}
                .value=${this.prompt_input?.content}>
            </bespeak-chat>
            <bespeak-stream-renderer .content=${this.response_output?.content}>
            </bespeak-stream-renderer>
        `;
    }
}

// leave this here for now
export async function quine() {
    const response = await fetch(import.meta.url);
    const source = await response.text();
    return source;
}
