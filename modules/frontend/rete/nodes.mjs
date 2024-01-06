import { Presets as LitPresets } from "https://esm.sh/gh/rynomad/rete-lit-plugin/dist/rete-litv-plugin.esm.js";
import { ClassicPreset as Classic } from "https://esm.sh/rete";
import { LitElement, css, html } from "https://esm.sh/lit@2.8.0";

export class ReteNode extends Classic.Node {
    constructor(operable, socket = new Classic.Socket("default")) {
        super("stupid");
        this.id = operable.id;
        this.operable = operable;
        this.width = 180;
        this.height = 120;
        this.addInput("input", new Classic.Input(socket, "input", true));
        this.addOutput("output", new Classic.Output(socket, "output"));
        this.addInput("tool", new Classic.Input(socket, "tool", true));
        this.addOutput("tools", new Classic.Output(socket, "tools"));
    }

    data() {}
}

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
    }
    async initComponent() {
        await this.updateComplete;

        this.reteNode.litNode = this;
        // this.updateComponent();
    }

    static get styles() {
        return css``;
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

    nodeStyles() {
        return "";
    }

    render() {
        const tool = this.reteNode?.inputs?.tool || {};
        const tools = this.reteNode?.outputs?.tools || {};
        const input = this.reteNode?.inputs?.input || {};
        const output = this.reteNode?.outputs?.output || {};

        console.log(this.reteNode);

        return html`
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
                    <bespeak-iframe
                        .operable=${this.reteNode.operable}></bespeak-iframe>
                </div>
            </bespeak-compass>
        `;
    }
}
customElements.define("bespeak-rete-node", LitNode);

class IFrames extends LitElement {
    static get styles() {
        return css`
            :host {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                width: 100%;
                height: 100%;
            }
            iframe {
                border: none;
                margin: 5rem;
                width: 50rem;
                height: 40rem;
            }
        `;
    }

    static get properties() {
        return {
            operable: { type: Object },
        };
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        console.log("DISCONNECTED");
    }

    firstUpdated() {
        console.log("CONSTRUCTED");
        const iframe = this.shadowRoot.querySelector("iframe");
        iframe.onload = () => {
            self.addEventListener("message", (event) => {
                if (event.data.ready) {
                    // The iframe is ready, send the id message
                    iframe.contentWindow.postMessage(
                        { id: this.operable?.id },
                        window.location.origin
                    );
                }
            });
        };
    }

    render() {
        return html`<iframe
            src=${`${location.origin}/operable.html`}></iframe>`;
    }
}

customElements.define("bespeak-iframe", IFrames);
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
