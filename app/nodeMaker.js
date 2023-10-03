import { LitElement, html, css } from "https://esm.sh/lit";
import OpenAI from "https://esm.sh/openai";
import { Types } from "http://localhost:3000/app/types.js";
import { quine as example } from "http://localhost:3000/app/example.js";

async function generateInstructions(currentNode) {
    const exampleCode = await example();

    let instructions = `# Instructions for Making a Node\n\n`;
    instructions += `the user will present a desire, and you will respond with an es6 module with a default export that extends a LitElement conforming to the goal.\n\n`;
    instructions += `use available types where possible. and if a type is not defined, define one and use it.  your schema must always be an object.\n\n`;
    instructions += `types are not available via Types.get() until they are used. When defining your own types, always pass the whole type object into the property declaration instead of using Types.get().\n\n`;
    instructions += `for text input fields, always provide a save button rather than updating reactive properties on change. multiple choice options and toggles may update on change.\n\n`;
    instructions += `Always endeavor to provide elegant and aesthetically pleasing styling. Your output will stretch to fill its container.\n\n`;
    instructions += `Always initialize variables in the constructor and use nullish operators when referencing nested values to minimize errors.\n\n`;
    instructions += `Always use flexbox layouts to ensure that everything you render is displayed in a nice layout.\n\n`;
    instructions += `Here is an example of how to make a node:\n\n`;
    instructions += "```javascript\n" + exampleCode + "\n```\n\n";

    instructions += `# Available Types\n\n`;
    for (const [key, type] of Types.entries()) {
        instructions += `## ${type.type}\n\n`;
        instructions += `${type.description}\n\n`;
        instructions +=
            "```javascript\n" +
            JSON.stringify(type.schema, null, 2) +
            "\n```\n\n";
    }

    if (currentNode) {
        instructions += `#Current Node\n\n`;
        instructions += `this is the node you are working on. unless the users request seems completely incongruent or they tell you to start over, you should iterate on this code.`;
        instructions += "```javascript\n" + currentNode + "\n```\n\n";
    }

    return instructions;
}

function extractCodeBlocks(text) {
    // The '^' character asserts start of a line due to the 'm' flag
    const regex = /^```(\w*\n)?([\s\S]*?)```/gm;
    let match;
    const codeBlocks = [];

    while ((match = regex.exec(text)) !== null) {
        let language = match[1]?.trim() || "plaintext";
        let codeBlock = match[2];

        // Check if the code block is valid, e.g. not an empty string
        if (codeBlock.trim().length > 0) {
            codeBlocks.push(codeBlock);
        }
    }

    return codeBlocks;
}

export default class NodeMakerGPT extends LitElement {
    static get properties() {
        return {
            chat_input: { type: Types.get("chat") },
            prompt_input: { type: Types.get("prompt") },
            config: { type: Types.get("config") },
            api_key: { type: Types.get("api-key") },
            response_output: { type: Object },
            chat_output: { type: Types.get("chat") },
            component_output: { type: Types.get("component") },
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

        messages.unshift({
            role: "system",
            content: await generateInstructions(this.component_output?.source),
        });

        const options = {
            model: config.model,
            temperature: config.temperature,
            messages,
        };

        const streamOptions = {
            ...options,
            stream: true,
            n: 1,
        };

        const stream = await openai.chat.completions.create(streamOptions);

        let streamContent = "";

        for await (const part of stream) {
            const delta = part.choices[0]?.delta?.content || "";
            streamContent += delta;
            this.response_output = {
                content: streamContent,
            };
        }

        const codeBlock = extractCodeBlocks(streamContent).pop();
        if (codeBlock) {
            this.component_output = {
                source: codeBlock,
            };
        }

        this.chat_output = {
            messages: [
                ...messages,
                { role: "assistant", content: streamContent },
            ],
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
        debugger;
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
