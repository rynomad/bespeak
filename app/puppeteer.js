import { LitElement, html, css } from "https://esm.sh/lit@2.8.0";
import OpenAI from "https://esm.sh/openai";
import "./stream-renderer.js";
import { PROMPT, CONFIG, API_KEY, CHAT } from "./types/gpt.js";
import { ComponentMixin } from "./component.js";

const systemMessage = {
    role: "system",
    content:
        "To control the browser via the extension, please provide a JavaScript script as an ES6 module. " +
        "Your script should make use of the puppeteer and ExtensionDebuggerTransport libraries. " +
        "It should export a default function that takes these two libraries as arguments. " +
        "This function will be responsible for controlling the browser. " +
        "Any promise returned from this function will be awaited and its resolved value will be sent back to the user. You can use this to gather information from the browser and send it back to the user. " +
        "Please note that the `browser.newPage()` method will not work in this context. " +
        "Instead, pages need to be created using the Chrome API and then explicitly wrapped in the transport to create the puppeteer instance. " +
        "Afterwards, the page object can be retrieved from `browser.pages()` and used normally. " +
        "Here is an example of how you might structure your script:\n\n" +
        "```javascript\n" +
        "export default async function(puppeteer, ExtensionDebuggerTransport) {\n" +
        "  return new Promise((resolve, reject) => {\n" +
        '    chrome.tabs.create({url: "https://example.com", active: false}, async (tab) => {\n' +
        "      const extensionTransport = await ExtensionDebuggerTransport.create(tab.id);\n" +
        "      const browser = await puppeteer.connect({\n" +
        "        transport: extensionTransport,\n" +
        "        defaultViewport: null,\n" +
        "      });\n" +
        "      const [page] = await browser.pages();\n" +
        "      await page.goto(tab.url);\n" +
        "      const pageTitle = await page.title();\n" +
        "      resolve(pageTitle);\n" +
        "    });\n" +
        "  });\n" +
        "}\n" +
        "```\n" +
        'In this example, the script creates a new tab with the URL "https://example.com", creates an ExtensionDebuggerTransport with the ID of the new tab, ' +
        "connects to a puppeteer browser using this transport, gets the first page of the browser, and navigates to the URL of the new tab. " +
        "The title of the page is then returned as a resolved promise. " +
        "Please note that due to security restrictions, the script is executed as an ES6 module. Therefore, it should contain a default export and any imports should be sourced from https://esm.sh",
};

export class ChatPuppeteer extends LitElement {
    static get properties() {
        return {
            chat_input: { type: CHAT },
            prompt: { type: PROMPT },
            config: { type: CONFIG },
            api_key: { type: API_KEY },
            response_output: { type: Object },
            chat_output: { type: CHAT },
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
        const { config, prompt, api_key, chat_input } = this;
        const openai = new OpenAI({
            apiKey: api_key.api_key,
            dangerouslyAllowBrowser: true,
        });

        const messages = [systemMessage].concat(
            (chat_input?.messages || [])
                .map((message) =>
                    !Array.isArray(message) || config.chooser === "all"
                        ? message
                        : message[0]
                )
                .concat([
                    {
                        ...prompt,
                        role: prompt.role || "user",
                    },
                ])
                .flat()
        );

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

                        const codeBlockMatch = streamContent.match(
                            /```javascript([\s\S]*?)```/
                        );
                        let run = false;
                        if (codeBlockMatch && !run) {
                            // construct a blob url for the script, and import it and run its default export with window.puppeteer and window.ExtensionDebuggerTransport
                            const script = codeBlockMatch[1];
                            const blob = new Blob([script], {
                                type: "application/javascript",
                            });
                            const url = URL.createObjectURL(blob);
                            const module = await import(url);
                            const result = await module.default(
                                window.puppeteer,
                                window.ExtensionDebuggerTransport
                            );
                        }
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
        this.prompt = {
            role: this.config.role,
            content,
        };
    }

    render() {
        return html`
            <bespeak-chat
                .handleMessage=${this.handleMessage.bind(this)}
                .value=${this.prompt?.content}>
            </bespeak-chat>
            <bespeak-stream-renderer .content=${this.response_output?.content}>
            </bespeak-stream-renderer>
        `;
    }
}
export const Puppeteer = ComponentMixin(ChatPuppeteer);

customElements.define("bespeak-puppeteer-node", Puppeteer);
