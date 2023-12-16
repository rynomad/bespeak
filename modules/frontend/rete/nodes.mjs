import { Presets as LitPresets } from "https://esm.sh/gh/rynomad/rete-lit-plugin/dist/rete-litv-plugin.esm.local.js";
import { ClassicPreset as Classic } from "https://esm.sh/rete";
import { LitElement, css, html } from "https://esm.sh/lit@2.8.0";

export class ReteNode extends Classic.Node {
    get db() {
        return this.ide.db;
    }

    constructor(id, operable, socket = new Classic.Socket("default")) {
        super();
        this.id = id || this.id;
        this.operable = operable;

        this.addInput("input", new Classic.Input(socket, "input", true));
        this.addOutput("output", new Classic.Output(socket, "output"));
        this.addInput("tool", new Classic.Input(socket, "tool", true));
        this.addOutput("tools", new Classic.Output(socket, "tools"));
    }

    data() {}

    serialize() {
        return {
            id: this.id,
            x: this.x,
            y: this.y,
        };
    }

    get width() {
        return this.litNode?.width || 0;
    }

    get height() {
        return this.litNode?.height || 0;
    }

    get x() {
        if (!this.litNode) return 0;
        // center of parentElement
        const transform = window.getComputedStyle(
            this.litNode.parentElement
        ).transform;

        // Extract the translate values from the matrix
        const matrix = transform.match(/matrix\((.+)\)/);
        if (matrix) {
            const values = matrix[1].split(", ");
            let translateX = parseFloat(values[4]);

            return translateX + this.width / 2;
        } else {
            return 0;
        }
    }

    get y() {
        if (!this.litNode) return 0;
        // center of parentElement
        const transform = window.getComputedStyle(
            this.litNode.parentElement
        ).transform;

        // Extract the translate values from the matrix
        const matrix = transform.match(/matrix\((.+)\)/);
        if (matrix) {
            const values = matrix[1].split(", ");
            let translateY = parseFloat(values[5]);

            return translateY + this.height / 2;
        } else {
            return 0;
        }
    }
}

const hasChanged = (newV, oldV) => !deepEqual(newV, oldV);

export class LitNode extends LitPresets.classic.Node {
    get reteNode() {
        return this.data;
    }

    get ports() {
        const ports = ["input", "output", "tools", "tool"];

        return ports;
    }

    constructor() {
        super();

        this.initComponent();
        const that = this;

        const callback = (mutationsList) => {
            for (const mutation of mutationsList) {
                if (
                    mutation.type === "attributes" &&
                    mutation.attributeName === "style"
                ) {
                    const newValue = that.getAttribute("style");

                    // Check if change is allowed or if it's an empty string
                    if (this.allowStyleChange || newValue === "") {
                        return;
                    }
                    // Set flag to indicate internal change
                    this.allowStyleChange = true;

                    // Revert the change
                    this.style = "";

                    // Reset flag
                    this.allowStyleChange = false;
                }
            }
        };

        const observer = new MutationObserver(callback);
        observer.observe(this, {
            attributes: true,
            attributeFilter: ["style"],
        });
    }

    setAttribute(name, value) {
        if (name === "style") {
            return;
        }
        super.setAttribute(name, value);
    }

    handleResize() {
        if (Date.now() - this.constructedAt < 10) return;
        this.emit({
            type: "custom-node-resize",
            data: { ...this.data, component: this.component },
        });
    }

    async initComponent() {
        await this.updateComplete;

        this.reteNode.litNode = this;
        this.updateComponent();
    }

    static get styles() {
        return css`
            :host {
                max-width: 50vw;
                max-height: 50vh;
            }
            .tracker {
                position: relative;
            }
            bespeak-compass {
                position: absolute;
            }
        `;
    }

    static get properties() {
        return {
            data: { type: Object },
            emit: { type: Function },
            selected: { type: Boolean },
            back: { type: Object },
        };
    }

    get id() {
        return this.data.id;
    }

    async connectedCallback() {
        super.connectedCallback();
        this.lastConnected = Date.now();
        await this.updateComplete;
        // Create a ResizeObserver instance
        this.resizeObserver = new ResizeObserver((entries) => {
            for (let entry of entries) {
                this.width = entry.contentRect.width;
                this.height = entry.contentRect.height;
                const prevWidth = this.parentElement.clientWidth;
                const prevHeight = this.parentElement.clientHeight;
                this.shadowRoot.querySelector(".tracker").style.width =
                    entry.contentRect.width + "px";
                this.shadowRoot.querySelector(".tracker").style.height =
                    entry.contentRect.height + "px";
                this.reteNode.editor.area.resize(
                    this.reteNode.id,
                    entry.contentRect.width,
                    entry.contentRect.height
                );

                // Calculate the difference in width and height
                const diffWidth = entry.contentRect.width - prevWidth;
                const diffHeight = entry.contentRect.height - prevHeight;

                // Get the current transform values
                const transform = window.getComputedStyle(
                    this.parentElement
                ).transform;

                // Extract the translate values from the matrix
                const matrix = transform.match(/matrix\((.+)\)/);
                if (matrix) {
                    const values = matrix[1].split(", ");
                    let translateX = parseFloat(values[4]);
                    let translateY = parseFloat(values[5]);

                    // Adjust the translate values based on the resize difference
                    translateX -= diffWidth / 2;
                    translateY -= diffHeight / 2;

                    this.reteNode.editor.area.translate(this.reteNode.id, {
                        x: translateX,
                        y: translateY,
                    });
                }
            }
        });

        // Start observing the current component
        this.resizeObserver.observe(
            this.shadowRoot.querySelector("bespeak-compass")
        );
    }

    disconnectedCallback() {
        super.disconnectedCallback();

        // Stop observing when the component is disconnected
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
    }

    nodeStyles() {
        return "";
    }

    onToggle() {}

    render() {
        const tool = this.reteNode?.inputs?.tool || {};
        const tools = this.reteNode?.outputs?.tools || {};
        const input = this.reteNode?.inputs?.input || {};
        const output = this.reteNode?.outputs?.output || {};

        return html`
            <div class="tracker" @click=${() => console.log("tracker click")}>
                <bespeak-compass>
                    <div slot="north">
                        ${html`<ref-element
                            class="input-socket"
                            .data=${{
                                type: "socket",
                                side: "input",
                                key: input.label,
                                nodeId: this.data?.id,
                                payload: input.socket,
                            }}
                            .emit=${this.emit}
                            data-testid="input-socket"></ref-element>`}
                    </div>
                    <div slot="south">
                        ${html`<ref-element
                            class="output-socket"
                            .data=${{
                                type: "socket",
                                side: "output",
                                key: output.label,
                                nodeId: this.data?.id,
                                payload: output.socket,
                            }}
                            .emit=${this.emit}
                            data-testid="output-socket"></ref-element>`}
                    </div>
                    <div slot="east">
                        ${html`<ref-element
                            class="output-socket"
                            .data=${{
                                type: "socket",
                                side: "output",
                                key: tools.label,
                                nodeId: this.data?.id,
                                payload: tools.socket,
                            }}
                            .emit=${this.emit}
                            data-testid="output-socket"></ref-element>`}
                    </div>
                    <div slot="west">
                        ${html`<ref-element
                            class="input-socket"
                            .data=${{
                                type: "socket",
                                side: "input",
                                key: tool.label,
                                nodeId: this.data?.id,
                                payload: tool.socket,
                            }}
                            .emit=${this.emit}
                            data-testid="output-socket"></ref-element>`}
                    </div>
                    <div>
                        <bespeak-lit-node
                            .operable=${this.reteNode
                                .operable}></bespeak-lit-node>
                    </div>
                </bespeak-compass>
            </div>
        `;
    }
}
customElements.define("bespeak-rete-node", LitNode);
class FiveSlotElement extends LitElement {
    static styles = css`
        :host {
            display: flex;
            position: relative;
            width: fit-content;
            justify-content: center;
            align-items: center;
        }
        .content {
            position: relative;
        }
        ::slotted([slot="north"]) {
            position: absolute;
            top: -18px;
            z-index: 1;
        }
        ::slotted([slot="south"]) {
            position: absolute;
            bottom: -18px;
            z-index: 1;
        }
        ::slotted([slot="east"]) {
            position: absolute;
            right: -18px;
            z-index: 1;
        }
        ::slotted([slot="west"]) {
            position: absolute;
            left: -18px;
            z-index: 1;
        }
    `;

    render() {
        return html`
            <slot name="north"></slot>
            <slot name="south"></slot>
            <slot name="east"></slot>
            <slot name="west"></slot>
            <slot></slot>
        `;
    }
}

customElements.define("bespeak-compass", FiveSlotElement);
