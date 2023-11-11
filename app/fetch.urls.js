import { html, css } from "https://esm.sh/lit@2.8.0";
import BespeakComponent from "./component.js";

class Fetch extends BespeakComponent {
    static input = {
        title: "Fetch URL",
        description: "A  URL to fetch as text",
        type: "object",
        properties: {
            url: {
                type: "string",
                format: "uri",
                description: "The URL to fetch",
            },
        },
        required: ["url"],
    };

    static output = {
        title: "Fetched Text",
        description: "The fetched text from the URL",
        type: "object",
        properties: {
            url: {
                type: "string",
                format: "uri",
                description: "The URL that was fetched",
            },
            text: {
                type: "string",
                description: "The fetched text",
            },
        },
        required: ["url", "text"],
    };

    async _process(input, config, keys) {
        const { url } = input;
        const { timeout = 5000 } = config;

        const fetchedText = [];

        try {
            const response = await fetch(url, { timeout });
            const text = await response.text();
            return { url, text };
        } catch (error) {
            console.error("Error fetching URLs:", error);
        }
    }

    render() {
        return html`
            <div class="container">
                <div class="input">
                    <h3>Input:</h3>
                    ${this.input
                        ? html`<pre>
${JSON.stringify(this.input, null, 2)}</pre
                          >`
                        : html`<p>No input provided</p>`}
                </div>

                <div class="output">
                    <h3>Output:</h3>
                    <div class="output-item">
                        <strong>${this.output?.url}</strong>:
                        ${this.output?.text}
                    </div>
                </div>
            </div>
        `;
    }

    static styles = css`
        .container {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 20px;
        }

        .input {
            margin-bottom: 20px;
        }

        .output {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
        }

        .output-item {
            margin-bottom: 10px;
        }
    `;
}

export default Fetch;
