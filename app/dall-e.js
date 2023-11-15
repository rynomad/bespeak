import { html, css } from "https://esm.sh/lit@2.8.0";
import BespeakComponent from "./component.js";
import OpenAI from "https://cdn.jsdelivr.net/npm/openai@4.17.1/+esm";

export default class ImageGenerator extends BespeakComponent {
    description = "Generate an image using DALL-E";
    static input = {
        title: "Image Generation Input",
        description: "Input for generating image using DALL-E",
        type: "object",
        properties: {
            prompt: {
                type: "string",
                title: "Prompt",
                description: "The prompt to generate the image from",
            },
        },
        required: ["prompt"],
    };

    static config = {
        title: "Image Generation Configuration",
        description: "Configuration for generating image using DALL-E",
        type: "object",
        properties: {
            model: {
                type: "string",
                title: "Model",
                description: "The model to use for generating the image",
                default: "dall-e-3",
                enum: ["dall-e-3"],
            },
            size: {
                type: "string",
                title: "Image Size",
                description: "The size of the generated image",
                enum: ["1024x1024"],
                default: "1024x1024",
            },
            n: {
                type: "integer",
                title: "Number of Images",
                description: "The number of images to generate",
                default: 1,
            },
        },
        required: ["model", "size", "n"],
    };

    static keys = {
        title: "OpenAI API Keys",
        description: "API keys for OpenAI",
        type: "object",
        properties: {
            apiKey: {
                type: "string",
                title: "API Key",
                description: "The API key for OpenAI",
            },
        },
        required: ["apiKey"],
    };

    static output = {
        title: "Image Generation Output",
        description: "Output of the image generation process",
        type: "object",
        properties: {
            url: {
                type: "string",
                title: "Image URL",
                description: "The URL of the generated image",
            },
        },
        required: ["url"],
    };

    static styles = css`
        :host {
            display: block;
            padding: 16px;
            color: var(--image-generator-text-color, black);
        }
        img {
            max-width: 100%;
            height: auto;
        }
    `;

    async _process(input, config, keys) {
        const openai = new OpenAI({
            apiKey: keys.apiKey,
            dangerouslyAllowBrowser: true,
        });
        let response;
        for (let i = 0; i < 5; i++) {
            try {
                response = await openai.images.generate({
                    model: config.model,
                    prompt: input.prompt,
                    n: config.n,
                    size: config.size,
                });
                if (response) break;
            } catch (error) {
                console.error(
                    `Attempt ${i + 1} failed. Retrying in 20 seconds...`
                );
                await new Promise((resolve) => setTimeout(resolve, 20000));
            }
        }
        if (!response)
            throw new Error("Image generation failed after 5 attempts");
        return { url: response.data[0].url };
    }

    render() {
        return html`
            <div>
                <h1>
                    Prompt:
                    ${this.input ? this.input.prompt : "No prompt provided"}
                </h1>
                ${this.output
                    ? html`<img
                          src="${this.output.url}"
                          alt="Generated image" />`
                    : html`<p>No image generated</p>`}
            </div>
        `;
    }
}
