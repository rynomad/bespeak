import { Presets as LitPresets } from "https://esm.sh/gh/rynomad/rete-lit-plugin/dist/rete-litv-plugin.esm.local.js";
import { ClassicPreset as Classic } from "https://esm.sh/rete";
import localForage from "https://esm.sh/localforage";
import {
    Subject,
    filter,
    shareReplay,
    takeUntil,
    tap,
} from "https://esm.sh/rxjs";
import { getProjectSource } from "./util.js";
import { css, html } from "https://esm.sh/lit@2.8.0";

export class ReteNode extends Classic.Node {
    static globals = new Map();
    static _sockets = {};
    static componentsDB = localForage.createInstance({
        name: "bespeak-components",
    });
    static components$ = new Subject();
    static modules = new Map();

    static async registerComponent(key, source) {
        const existing = (await this.componentsDB.getItem(key)) || [];

        existing.push(source);
        await this.componentsDB.setItem(key, existing);

        await this.updateComponents();
    }

    static async getComponent(key, version) {
        const existing = (await this.componentsDB.getItem(key)) || [];
        version ||= existing.length;
        const source = existing[version - 1];

        if (!source) {
            throw new Error(`Component ${key} not found`);
        }

        if (!this.modules.has(`${key}-${version}`)) {
            const blob = new Blob([source], { type: "text/javascript" });
            const url = URL.createObjectURL(blob);
            const module = await import(url);
            this.modules.set(`${key}-${version}`, module);
            try {
                customElements.define(
                    `bespeak-component-${key}-${version}`,
                    module.default
                );
            } catch (e) {
                console.warn(e);
            }
        }

        const module = this.modules.get(`${key}-${version}`);
        if (module) {
            return {
                key,
                Component: module.default,
                version,
            };
        } else {
            throw new Error(`Component ${key} not found`);
        }
    }

    static async updateComponents() {
        const keys = await this.componentsDB.keys();
        const components = await Promise.all(
            keys.map((key) => this.getComponent(key))
        );
        this.components$.next(components);
    }

    static async deserialize(ide, editor, { key, version, id }) {
        const { Component } = await this.getComponent(key, version);
        const node = new this(ide, editor, { key, version, Component, id });

        return node;
    }

    static getSocket(workspaceId) {
        if (!workspaceId) throw new Error("workspaceId is undefined");
        this._sockets[workspaceId] =
            this._sockets[workspaceId] || new Classic.Socket(workspaceId);
        return this._sockets[workspaceId];
    }

    get socket() {
        return this.constructor.getSocket(this.workspaceId);
    }

    get selected() {
        return this._selected;
    }

    get db() {
        return this.ide.db;
    }

    set selected(value) {
        this._selected = value;
        if (value) {
            this.litNode.emit({
                type: "custom-node-selected",
                data: this,
            });
        } else {
            this.litNode.emit({
                type: "custom-node-deselected",
                data: this,
            });
        }
        this.litNode.selected = value;
        this.litNode.requestUpdate();
    }

    constructor(ide, editor, { key, version, Component, id }) {
        super();
        this.id = id || this.id;
        this.key = key;
        this.version = version;
        this.ide = ide;
        this.editor = editor;
        this.workspaceId = editor.id;
        this.Component = Component;

        this.addInput("input", new Classic.Input(this.socket, "input", true));
        this.addOutput("output", new Classic.Output(this.socket, "output"));
        this.addInput("owners", new Classic.Input(this.socket, "owners", true));
        this.addOutput("assets", new Classic.Output(this.socket, "assets"));

        this.removed$ = this.editor.events$.pipe(
            filter(
                (event) =>
                    event.type === "noderemoved" && event.data.id === this.id
            ),
            shareReplay(1)
        );

        this.editor.events$
            .pipe(
                filter(
                    (event) =>
                        event.type === "connectioncreated" &&
                        event.data.source === this.id
                ),
                takeUntil(this.removed$),
                tap((value) => {
                    const target = this.editor.getNode(value.data.target)
                        .litNode.component;
                    this.litNode.component.pipe(target);
                })
            )
            .subscribe();

        this.editor.events$
            .pipe(
                filter(
                    (event) =>
                        event.type === "connectionremoved" &&
                        event.data.source === this.id
                ),
                takeUntil(this.removed$),
                tap((value) => {
                    const target = this.editor.getNode(value.data.target)
                        .litNode.component;
                    this.litNode.component.unpipe(target);
                })
            )
            .subscribe();
    }

    data() {}

    serialize() {
        return {
            id: this.id,
            key: this.key,
            version: this.version,
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
        }
    }

    move(x, y) {
        this.editor.area.translate(this.id, { x, y });
    }
}

const hasChanged = (newV, oldV) => !deepEqual(newV, oldV);

export class LitNode extends LitPresets.classic.Node {
    nodeStyles() {
        return "";
    }

    get reteNode() {
        return this.data;
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
            Component: { type: Object },
            selected: { type: Boolean },
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

    async updateComponent() {
        // Get the source code from the editor
        this.component = new this.reteNode.Component(this.id);
        this.shadowRoot
            .querySelector(".container")
            .replaceChildren(this.component);

        this.requestUpdate();
    }

    onToggle() {}

    render() {
        const owners = this.reteNode?.inputs?.parents || {};
        const assets = this.reteNode?.outputs?.assets || {};
        const input = this.reteNode?.inputs?.input || {};
        const output = this.reteNode?.outputs?.output || {};

        return html`
            <div class="tracker" @click=${() => console.log("tracker click")}>
                <bespeak-compass>
                    ${this.ports?.includes("input")
                        ? html`<div slot="north">
                              ${html`<ref-component
                                  class="input-socket"
                                  .data=${{
                                      type: "socket",
                                      side: "input",
                                      key: input.label,
                                      nodeId: this.data?.id,
                                      payload: input.socket,
                                  }}
                                  .emit=${this.emit}
                                  data-testid="input-socket"></ref-component>`}
                          </div>`
                        : ""}
                    ${this.ports?.includes("output")
                        ? html`<div slot="south">
                              ${html`<ref-component
                                  class="output-socket"
                                  .data=${{
                                      type: "socket",
                                      side: "output",
                                      key: output.label,
                                      nodeId: this.data?.id,
                                      payload: output.socket,
                                  }}
                                  .emit=${this.emit}
                                  data-testid="output-socket"></ref-component>`}
                          </div>`
                        : ""}
                    ${this.ports?.includes("assets")
                        ? html`<div slot="east">
                              ${html`<ref-component
                                  class="output-socket"
                                  .data=${{
                                      type: "socket",
                                      side: "output",
                                      key: assets.label,
                                      nodeId: this.data?.id,
                                      payload: assets.socket,
                                  }}
                                  .emit=${this.emit}
                                  data-testid="output-socket"></ref-component>`}
                          </div>`
                        : ""}
                    ${this.ports?.includes("owners")
                        ? html`<div slot="west">
                              ${html`<ref-component
                                  class="input-socket"
                                  .data=${{
                                      type: "socket",
                                      side: "input",
                                      key: owners.label,
                                      nodeId: this.data?.id,
                                      payload: owners.socket,
                                  }}
                                  .emit=${this.emit}
                                  data-testid="output-socket"></ref-component>`}
                          </div>`
                        : ""}
                    <div>
                        <bespeak-flipper
                            @click=${() => console.log("click node flipper")}
                            class="front"
                            .onToggle=${this.onToggle.bind(this)}>
                            <div
                                class="container"
                                slot="front"
                                style="min-width: 20px; min-height: 20px; padding: 1.5rem;"></div>
                            <div slot="back" style="padding: 1.5rem"></div>
                        </bespeak-flipper>
                    </div>
                </bespeak-compass>
            </div>
        `;
    }
}
customElements.define("bespeak-lit-node", LitNode);

(async () => {
    console.log("REGISTER HARD CODE");
    await ReteNode.registerComponent(
        "gpt-prompt",
        await getProjectSource("./prompt.child.js")
    );
    await ReteNode.registerComponent(
        "gpt-call",
        await getProjectSource("./gpt.child.js")
    );
    await ReteNode.registerComponent(
        "gpt-response",
        await getProjectSource("./gpt-response.child.js")
    );
})();
