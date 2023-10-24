import { LitElement, html, css } from "https://esm.sh/lit@2.8.0";
import { repeat } from "https://esm.sh/lit/directives/repeat.js";
import _ from "https://esm.sh/lodash";
import { ComponentMixin } from "./component.old.js";
import { CHAT } from "./types/gpt.js";
import { FREQUENCY_TABLE } from "./types/frequency.js";
import { Chart } from "https://esm.sh/chart.js/auto";
import { CODE_FREQUENCY_TABLE } from "./types/frequency.js";
import { minify } from "https://esm.sh/terser";
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

export const CodeFrequencyTable = ComponentMixin(
    class CodeFrequencyTable extends LitElement {
        static get properties() {
            return {
                chat_input: { type: CHAT },
                codeFrequencyTable: { type: CODE_FREQUENCY_TABLE },
            };
        }

        updated(changedProperties) {
            super.updated(changedProperties);
            if (changedProperties.has("chat_input")) {
                this.updateCodeFrequencyTable();
            }
            if (changedProperties.has("codeFrequencyTable")) {
                this.updateChart();
            }
        }

        updateChart() {
            const canvas = this.shadowRoot.querySelector("canvas");
            if (this.chart) {
                this.chart.destroy();
            }
            this.chart = new Chart(canvas.getContext("2d"), {
                type: "bar",
                data: {
                    labels: this.codeFrequencyTable.groups.map((group) =>
                        group.failedToMinify
                            ? "FAILED TO MINIFY"
                            : group.minifiedCode
                    ),
                    datasets: [
                        {
                            label: "Frequency",
                            data: this.codeFrequencyTable.groups.map(
                                (group) => group.messages.length
                            ),
                            backgroundColor: "rgba(75, 192, 192, 0.2)",
                            borderColor: "rgba(75, 192, 192, 1)",
                            borderWidth: 1,
                        },
                    ],
                },
                options: {
                    indexAxis: "y", // Add this line
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: "Minified Code",
                            },
                        },
                        x: {
                            title: {
                                display: true,
                                text: "Frequency",
                            },
                        },
                    },
                },
            });
        }
        async updateCodeFrequencyTable() {
            const messages = this.chat_input?.messages || [];
            const assistantMessages = messages
                .flat()
                .filter((message) => message.role === "assistant");

            const grouped = _.groupBy(
                await Promise.all(
                    assistantMessages.map(async (message) => {
                        try {
                            const code = extractCodeBlocks(
                                message.content
                            ).pop();
                            const minifiedCode = (await minify(code)).code;
                            return {
                                minifiedCode,
                                failedToMinify: false,
                                message,
                            };
                        } catch (error) {
                            return {
                                minifiedCode: message,
                                failedToMinify: true,
                                message,
                            };
                        }
                    })
                ),
                "minifiedCode"
            );

            const codeGroups = Object.values(grouped).map((group) => ({
                ...group[0],
                messages: group,
            }));

            this.codeFrequencyTable = { groups: codeGroups };
        }

        render() {
            const table = this.codeFrequencyTable || { groups: [] };
            return html`
                ${repeat(
                    table.groups,
                    (group, index) => index,
                    (group) => html`
                        <details>
                            <summary>
                                ${group.minifiedCode} (${group.messages.length})
                            </summary>
                            ${group.failedToMinify
                                ? html`<p>Failed to minify</p>`
                                : null}
                            ${repeat(
                                group.messages,
                                (message) => message,
                                (message) =>
                                    html`<pre>${message.message.content}</pre>`
                            )}
                        </details>
                    `
                )}
                <canvas></canvas>
            `;
        }

        static styles = css`
            :host {
                display: block;
            }
            canvas {
                width: 100%;
                height: 400px;
                background-color: white;
            }
            pre {
                background-color: #f8f8f8;
                border: 1px solid #ddd;
                padding: 10px;
                border-radius: 4px;
            }
        `;
    }
);

customElements.define("bespeak-code-frequency-table", CodeFrequencyTable);

export const FrequencyTable = ComponentMixin(
    class IntegerFrequencyTable extends LitElement {
        static get properties() {
            return {
                chat_input: { type: CHAT },
                frequencyTable: { type: FREQUENCY_TABLE },
            };
        }

        updated(changedProperties) {
            super.updated(changedProperties);
            if (changedProperties.has("chat_input")) {
                this.updateFrequencyTable();
            }
            if (changedProperties.has("frequencyTable")) {
                this.updateChart();
            }
        }

        updateChart() {
            const canvas = this.shadowRoot.querySelector("canvas");
            if (this.chart) {
                this.chart.destroy();
            }
            this.chart = new Chart(canvas.getContext("2d"), {
                type: "bar",
                data: {
                    labels: Object.keys(this.frequencyTable || {}),
                    datasets: [
                        {
                            label: "Frequency",
                            data: Object.values(this.frequencyTable),
                            backgroundColor: "rgba(75, 192, 192, 0.2)",
                            borderColor: "rgba(75, 192, 192, 1)",
                            borderWidth: 1,
                        },
                    ],
                },
                options: {
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: "Frequency",
                            },
                        },
                        x: {
                            title: {
                                display: true,
                                text: "Integer",
                            },
                        },
                    },
                },
            });
        }
        static styles = css`
            :host {
                display: block;
            }
            canvas {
                width: 100%;
                height: 400px;
                background-color: white;
            }
        `;
        updateFrequencyTable() {
            const messages = this.chat_input?.messages || [];
            const assistantMessages = messages
                .flat()
                .filter((message) => message.role === "assistant")
                .map((message) => message.content);

            let noIntegerCount = 0;
            const lastIntegers = assistantMessages
                .map((message) => {
                    const match = message.match(/\d+(?=\s*$)/);
                    if (match) {
                        return parseInt(match[0], 10);
                    } else {
                        noIntegerCount++;
                        return null;
                    }
                })
                .filter(Boolean);

            const frequencyTable = _.countBy(lastIntegers);
            frequencyTable["No Integer"] = noIntegerCount;
            this.frequencyTable = frequencyTable;
        }

        render() {
            return html`<canvas></canvas>`;
        }
    }
);

customElements.define("bespeak-frequency-table", FrequencyTable);
