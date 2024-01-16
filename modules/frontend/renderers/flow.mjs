import { LitElement, css, html } from "https://esm.sh/lit@2.8.0";
import { ClassicPreset as Classic, NodeEditor } from "https://esm.sh/rete";
import { AreaExtensions, AreaPlugin } from "https://esm.sh/rete-area-plugin";
import {
    LitPlugin,
    Presets as LitPresets,
} from "https://esm.sh/gh/rynomad/rete-lit-plugin@a75538c269/dist/rete-litv-plugin.esm.js";
import {
    AutoArrangePlugin,
    Presets as ArrangePresets,
} from "https://esm.sh/rete-auto-arrange-plugin";

import { BetterDomSocketPosition } from "../rete/socket-position.mjs";
import { Connection } from "../rete/connection.mjs";
import {
    ConnectionPlugin,
    Presets as ConnectionPresets,
} from "https://esm.sh/rete-connection-plugin";
import {
    ContextMenuPlugin,
    Presets as ContextMenuPresets,
} from "https://esm.sh/rete-context-menu-plugin";

import { ReplaySubject, fromEventPattern } from "https://esm.sh/rxjs";

import { LitNode } from "../rete/nodes.mjs";
import "../icons/nodes.mjs";

export class Flow extends LitElement {
    static get styles() {
        return css`
            :host {
                display: block;
                height: 100%;
                width: 100%;
            }
            .content {
                display: block;
                position: relative;
                width: 100%;
                flex-grow: 1;
            }

            .column {
                display: flex;
                flex-direction: column;
                height: 100%;
            }

            :host(.open) {
                display: block;
                flex-grow: 1;
                transition: height 0.3s ease;
            }

            .content.open {
                transition: height 0.3s ease;
                flex-grow: 1;
            }

            .status {
                display: block;
                width: 100%;
            }

            span {
                display: inline-block;
                transform-origin: 50% 50%;
                transform: scaleY(1.3);
                font-size: 1.3em;
                cursor: pointer;
                transition: transform 0.3s ease;
            }

            span.open {
                /* No additional styles for .open */
                transform: rotate(90deg);
            }

            span.closed {
            }
        `;
    }

    constructor() {
        super();

        const editor = new NodeEditor();
        this.editor = editor;
        this.events$ = new ReplaySubject();
    }

    async connectedCallback() {
        super.connectedCallback();

        this.addEventListener("dragover", this.handleDragOver);
        this.addEventListener("drop", this.handleDrop);
        self.addEventListener("keydown", this.handleKeyPress);

        await this.updateComplete;

        this.initialize(this.shadowRoot.querySelector(".content"));
    }
    handleKeyPress = async (event) => {
        // Check if 'delete' key was pressed

        if (event.shiftKey && ["Backspace", "Delete"].includes(event.key)) {
            // Iterate over selected nodes and remove them
            for (const node of this.selector.entities.values()) {
                await this.removeNode(node.id);
            }
        }
    };

    disconnectedCallback() {
        super.disconnectedCallback();

        this.area?.destroy();
        this.subscriptions?.forEach((sub) => sub.unsubscribe());
        window.removeEventListener("keydown", this.handleKeyPress);
    }

    async createEditor(container) {
        const editor = this.editor;

        const area = new AreaPlugin(container);
        this.area = area;
        const litRender = new LitPlugin();
        const connection = new ConnectionPlugin();
        connection.addPreset(ConnectionPresets.classic.setup());

        editor.use(area);
        area.use(litRender);
        area.use(connection);

        const arrange = new AutoArrangePlugin();

        arrange.addPreset(ArrangePresets.classic.setup());

        area.use(arrange);

        await arrange.layout();

        AreaExtensions.zoomAt(area, editor.getNodes());

        // AreaExtensions.simpleNodesOrder(area);

        const selector = AreaExtensions.selector();
        const accumulating = AreaExtensions.accumulateOnCtrl();
        this.selector = selector;
        AreaExtensions.selectableNodes(area, selector, {
            accumulating,
        });

        litRender.addPreset(
            LitPresets.classic.setup({
                socketPositionWatcher: new BetterDomSocketPosition(),
                customize: {
                    node({ payload: node }) {
                        return LitNode;
                    },
                    connection() {
                        return Connection;
                    },
                },
            })
        );

        // AreaExtensions.zoomAt(area, editor.getNodes());
        this.onload?.(this);
    }

    getNode(id) {
        return this.editor.nodes.find((node) => node.id === id);
    }

    async addNode(node) {
        return await this.editor.addNode(node);
    }

    async removeNode(nodeId) {
        return await this.editor.removeNode(nodeId);
    }

    async addConnection(connection) {
        return await this.editor.addConnection(connection);
    }

    async removeConnection(connectionId) {
        return await this.editor.removeConnection(connectionId);
    }

    async initialize(container) {
        await this.createEditor(container);

        this.editor.addPipe((event) => {
            if (
                event.type === "connectioncreated" ||
                event.type === "connectionremoved" ||
                event.type === "noderemoved"
            ) {
                this.events$.next(event);
            }

            return event;
        });

        this.area.addPipe((event) => {
            if (event.type === "nodetranslated") {
                this.events$.next(event);
            }
            return event;
        });
    }

    handleDragOver(event) {
        event.preventDefault();
    }

    async handleDrop(event) {
        event.preventDefault();
        const data = JSON.parse(event.dataTransfer.getData("text/plain"));
        console.log("DROP", data);
        this.events$.next({
            type: "drop",
            data,
            position: { x: event.clientX, y: event.clientY },
        });
    }

    render() {
        return html`
            <div class="column">
                <div class="content"></div>
            </div>
        `;
    }
}

customElements.define("bespeak-flow", Flow);
