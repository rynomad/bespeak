import { LitElement, css, html } from "https://esm.sh/lit@2.0.1";
import { NodeEditor } from "https://esm.sh/rete";
import {
    AreaExtensions,
    AreaPlugin,
} from "https://esm.sh/rete-area-plugin@2.0.0";
import {
    LitPlugin,
    Presets as LitPresets,
} from "https://esm.sh/gh/rynomad/rete-lit-plugin@a75538c269/dist/rete-litv-plugin.esm.local.js";
import {
    AutoArrangePlugin,
    ArrangeAppliers,
} from "https://esm.sh/rete-auto-arrange-plugin";
import { MinimapPlugin } from "https://esm.sh/rete-minimap-plugin";
import { InputNodeComponent, Node, OutputNodeComponent } from "./node.js";
import { BetterDomSocketPosition } from "./socket-position.js";
import { Connection } from "./connection.js";
import { structures } from "https://esm.sh/rete-structures";
import {
    ContextMenuPlugin,
    Presets as ContextMenuPresets,
} from "https://esm.sh/rete-context-menu-plugin";
import {
    ConnectionPlugin,
    Presets as ConnectionPresets,
} from "https://esm.sh/rete-connection-plugin";

import {
    Subject,
    scan,
    take,
    switchMap,
    filter,
    debounceTime,
    tap,
} from "https://esm.sh/rxjs";

import { ReteNode, InputNode, OutputNode } from "./node.js";
import { ChatInput } from "./chat-input-node.js";

export class Editor extends LitElement {
    static get properties() {
        return {
            id: { type: String },
            ide: { type: Object },
            canvas: { type: Object },
            open: { type: Boolean },
            inputs$: { type: Object },
            outputs$: { type: Object },
        };
    }

    static get styles() {
        return css`
            :host,
            .content {
                display: block;
                position: relative;
                width: 100%;
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

    get structures() {
        return structures(this.editor);
    }

    constructor() {
        super();
        this.editor = new NodeEditor();
        this.events$ = new Subject();
    }

    async connectedCallback() {
        super.connectedCallback();

        if (this.open) {
            this.classList.add("open");
        }

        await this.updateComplete;
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.destroy();
    }

    async createEditor(container) {
        const editor = this.editor;
        const area = (this.area = new AreaPlugin(container));
        const litRender = new LitPlugin();

        const contextMenu = new ContextMenuPlugin({
            items: ContextMenuPresets.classic.setup([
                ["copy", (editor) => editor.trigger("copy")],
            ]),
        });
        const minimap = new MinimapPlugin();
        // const reroutePlugin = new ReroutePlugin();
        const connection = new ConnectionPlugin();
        connection.addPreset(ConnectionPresets.classic.setup());

        editor.use(area);

        area.use(litRender);
        area.use(contextMenu);
        area.use(minimap);
        area.use(connection);
        // litRender.use(reroutePlugin);
        litRender.addPreset(
            LitPresets.classic.setup({
                socketPositionWatcher: new BetterDomSocketPosition(),
                customize: {
                    node({ payload: node }) {
                        if (node.Component === InputNodeComponent) {
                            return InputNode;
                        } else if (node.Component === OutputNodeComponent) {
                            return OutputNode;
                        }

                        return Node;
                    },
                    connection() {
                        return Connection;
                    },
                },
            })
        );
        litRender.addPreset(LitPresets.contextMenu.setup());
        litRender.addPreset(LitPresets.minimap.setup());
        litRender.addPreset(
            LitPresets.reroute.setup({
                contextMenu(id) {
                    reroutePlugin.remove(id);
                },
                translate(id, dx, dy) {
                    reroutePlugin.translate(id, dx, dy);
                },
                pointerdown(id) {
                    reroutePlugin.unselect(id);
                    reroutePlugin.select(id);
                },
            })
        );

        this.setupArrange();
        this.setupStorage();

        AreaExtensions.zoomAt(area, editor.getNodes());

        AreaExtensions.simpleNodesOrder(area);

        const selector = (this.selector = AreaExtensions.selector());
        const accumulating = AreaExtensions.accumulateOnCtrl();

        AreaExtensions.selectableNodes(area, selector, { accumulating });
        // RerouteExtensions.selectablePins(reroutePlugin, selector, accumulating);

        // this.view = new CanvasView(this);
    }

    updated(changedProperties) {
        if (this.id && this.ide && !this.initialized) {
            this.initialized = true;
            this.initialize(this.shadowRoot.querySelector(".content"));
        }
    }

    async setupStorage() {
        this.hydrated$ = new Subject();
        this.storageSubscription = this.hydrated$
            .pipe(
                take(1),
                switchMap(() => {
                    return this.events$;
                }),
                filter(
                    (event) =>
                        event.type === "connectioncreated" ||
                        event.type === "connectionremoved" ||
                        event.type === "noderemoved" ||
                        event.type === "nodecreated"
                ),
                debounceTime(1000),
                tap(() => {
                    this.saveToStorage();
                })
            )
            .subscribe();

        const snapshot = await this.getFromStorage();
        if (snapshot) {
            this.name = snapshot.name;
            for (const node of snapshot.nodes) {
                await this.addNode(
                    ReteNode.deserialize(this.ide, this, node),
                    null,
                    false
                );
            }

            for (const connection of snapshot.connections) {
                await this.addConnection(connection);
            }
            setTimeout(() => {
                let node = this.structures.leaves().nodes().pop();
                if (node) {
                    if (node.Component === OutputNodeComponent) {
                        node = this.structures.incomers(node.id).nodes().pop();
                    }
                    this.doLayout([node]);
                }
            }, 100);
        }

        this.hydrated$.next(true);

        if (!snapshot?.nodes?.length) {
            const input = new ReteNode(this.ide, this, InputNodeComponent);
            const output = new ReteNode(this.ide, this, OutputNodeComponent);
            const chatNode = new ReteNode(this.ide, this, ChatInput);
            await this.addNode(input, null, true);
            await this.addNode(output, null, true);
            await this.addNode(chatNode, null, true);
        }
    }

    selectNode(node) {
        this.selector.add({
            id: node.id,
            unselect() {
                node.selected = false;
            },
            translate() {},
        });
        node.selected = true;
        node.component.focus();
    }

    deselectNode(node) {
        this.selector.remove({ id: node.id });
        node.selected = false;
    }

    async getFromStorage() {
        const workspace = await this.ide.db.get("workspaces", this.id);
        return workspace;
    }

    async saveToStorage() {
        const snapshot = {
            id: this.id,
            name: this.name,
            nodes: this.editor.getNodes().map((node) => node.serialize()),
            connections: this.editor.getConnections(),
        };

        await this.ide.db.put("workspaces", snapshot);
    }

    disconnectedCallback() {
        this.storageSubscription?.unsubscribe();
    }

    async addNode(node, nodeToConnect, select = false) {
        await this.editor.addNode(node);
        if (nodeToConnect) {
            await this.editor.addConnection({
                id: `${node.id}-${nodeToConnect.id}`,
                source: nodeToConnect.id,
                target: node.id,
                sourceOutput: "output",
                targetInput: "input",
            });
            await this.deselectNode(nodeToConnect);
        }

        if (select) {
            await this.selectNode(node);
        }

        this.doLayout([node]);
    }

    async removeNode(nodeId) {
        for (const connection of node.getConnections()) {
            if (connection.source === nodeId || connection.target === nodeId) {
                await this.removeConnection(connection);
            }
        }
        await this.editor.removeNode(node);
    }

    async addConnection(connection) {
        await this.editor.addConnection(connection);
    }

    async removeConnection(connectionId) {
        await this.editor.removeConnection(connectionId);
    }

    async initialize(container) {
        await this.createEditor(container);

        this.editor.addPipe((context) => {
            if (context.type === "connectioncreated") {
                console.log("connectioncreated editor", context);
            }
            this.events$.next(context);
            return context;
        });
        this.area.addPipe((context) => {
            if (
                context.type === "connectioncreated" ||
                context.type === "connectionremoved"
            ) {
                return context;
            }

            this.events$.next(context);
            return context;
        });
    }

    setupArrange() {
        this.arrange = new AutoArrangePlugin();
        this.arrange.addPreset(() => ({
            port(data) {
                const { spacing, top, bottom } = {
                    spacing: data.width / (data.ports * 2),
                };

                if (data.side === "output") {
                    return {
                        x: data.width / 2,
                        y: 0,
                        width: 15,
                        height: 15,
                        side: "SOUTH",
                    };
                }
                return {
                    x: data.width / 2,
                    y: 0,
                    width: 15,
                    height: 15,
                    side: "NORTH",
                };
            },
        }));
        this.area.use(this.arrange);

        this.events$
            .pipe(
                filter((event) => event.type === "custom-node-resize"),
                scan(
                    (applier, event) => {
                        applier?.cancel();
                        const nodes = this.editor
                            .getNodes()
                            .filter((node) => node.selected);
                        if (nodes.length > 0) {
                            return this.doLayout([event.data]);
                        } else {
                            const leaves = this.structures.leaves().nodes();
                            const nodes = leaves.filter(
                                (node) => node.Component !== OutputNodeComponent
                            );
                            if (leaves.length && !nodes.length) {
                                nodes.push(
                                    this.structures
                                        .incomers(leaves[0].id)
                                        .nodes()
                                );
                            }
                            return this.doLayout(nodes.flat());
                        }
                    },
                    { cancel: () => {} }
                )
            )
            .subscribe();

        this.events$
            .pipe(
                filter((event) => event.type === "focus"),
                tap((event) => {
                    this.editor.getNodes().forEach((node) => {
                        if (node.selected) {
                            this.deselectNode(node);
                        }
                    });

                    this.selectNode(event.data);
                    this.events$.next({
                        type: "custom-node-selected",
                        data: event.data,
                    });
                })
            )
            .subscribe();

        this.events$
            .pipe(
                filter((event) => event.type === "blur"),
                tap((event) => {
                    this.deselectNode(event.data);
                })
            )
            .subscribe();
    }

    zoom(nodes) {
        if (nodes) {
            AreaExtensions.zoomAt(this.area, nodes);
        }
    }

    doLayout(nodes) {
        const applier = new ArrangeAppliers.TransitionApplier({
            duration: 200,
            timingFunction: (t) => t,
            onTick: () => {
                this.zoom(nodes);
            },
        });

        this.arrange.layout({
            applier,
            options: { "elk.direction": "DOWN" },
        });

        return applier;
    }

    destroy() {
        this.area?.destroy();
    }

    setStatus(message) {
        this.statusMessage = message;
        this.requestUpdate();
    }

    render() {
        return html`
            <div class="column">
                ${this.collapsable
                    ? html`
                          <div class="status">
                              <span
                                  class="${this.open ? "open" : "closed"}"
                                  @click="${this.toggleOpen}"
                                  >&gt;</span
                              >
                              ${this.statusMessage || ""}
                          </div>
                      `
                    : ""}
                <div
                    class="content ${!this.collapsable || this.open
                        ? "open"
                        : "closed"}"></div>
            </div>
        `;
    }

    toggleOpen() {
        this.open = !this.open;
        this.classList.toggle("open");
        this.requestUpdate();
    }
}

customElements.define("bespeak-editor", Editor);
