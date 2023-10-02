import { LitElement, html, css } from "https://esm.sh/lit";
import { PROMPT, CHAT, CONFIG } from "./types/gpt.js";
import { EDITOR_STATE } from "./types/editor.js";
import { ComponentMixin } from "./component.js";

export const DevDefault = ComponentMixin(
    class extends LitElement {
        static get properties() {
            return {
                config: { type: CONFIG },
                prompt: { type: PROMPT },
                state_input: { type: EDITOR_STATE },
                state_output: { type: EDITOR_STATE },
            };
        }

        updated(changedProperties) {
            super.updated(changedProperties);
            if (this.shouldUpdatePipeline(changedProperties)) {
                this.updatePipeline();
            }
        }

        shouldUpdatePipeline(changedProperties) {
            if (
                !(this.config && this.prompt && this.chat && this.editor_state)
            ) {
                return false;
            }

            if (["prompt"].some((prop) => changedProperties.has(prop))) {
                return true;
            }

            return false;
        }

        updatePipeline() {
            // Extract the necessary properties
            const { config, prompt, editor_state } = this;

            // Find the source node
            const source = editor_state.nodes.find(
                (n) =>
                    n.selected ||
                    !editor_state.connections.some((c) => c.source === n.id)
            );

            // Create the new node
            const newNode = {
                Component: "GPT",
                initialValues: [
                    {
                        type: config.type,
                        name: config.name,
                        value: config,
                    },
                    {
                        type: prompt.type,
                        name: prompt.name,
                        value: prompt,
                    },
                ],
            };

            // Add the new node to the editor state
            this.editor_state = {
                ...editor_state,
                nodes: [...editor_state.nodes, newNode],
            };

            // Create a new connection
            const newConnection = { source: source.id, target: newNode.id };

            // Add the new connection to the editor state
            this.state_output = {
                ...this.editor_state,
                connections: [...editor_state.connections, newConnection],
            };
        }

        static styles = css`
            :host {
                display: block;
                font-size: 1.3rem;
                font-weight: bold;
            }
        `;

        render() {
            return html` <div>Default Chat Input</div> `;
        }
    }
);

customElements.define("bespeak-default-dev-node", DevDefault);
