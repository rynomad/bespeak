import { LitElement, css, html } from "https://esm.sh/lit@2.8.0";
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
} from "https://esm.sh/rete-auto-arrange-plugin?deps=rete-area-plugin@2.0.0";
import { MinimapPlugin } from "https://esm.sh/rete-minimap-plugin@2.0.0?deps=rete-area-plugin@2.0.0";
import { BetterDomSocketPosition } from "./socket-position.js";
import { Connection } from "./connection.js";
import { structures } from "https://esm.sh/rete-structures?deps=rete-area-plugin@2.0.0";
import {
    ContextMenuPlugin,
    Presets as ContextMenuPresets,
} from "https://esm.sh/rete-context-menu-plugin?deps=rete-area-plugin@2.0.0";
import {
    ConnectionPlugin,
    Presets as ConnectionPresets,
} from "https://esm.sh/rete-connection-plugin?deps=rete-area-plugin@2.0.0";

import {
    Subject,
    scan,
    take,
    switchMap,
    filter,
    debounceTime,
    tap,
    map,
} from "https://esm.sh/rxjs";
import { DevDefault } from "./dev-default.js";
import { debug } from "./operators.js";
import { Stream } from "./stream.js";

import { ReteNode, LitNode } from "./node.child.js";
import "./icons/nodes.js";
import { getText } from "./util.js";

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
        this.state$ = new Subject();
        this.crud$ = new Subject();
    }

    async connectedCallback() {
        super.connectedCallback();

        if (this.open) {
            this.classList.add("open");
        }

        this.addEventListener("dragover", this.handleDragOver);
        this.addEventListener("drop", this.handleDrop);

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
        // area.use(minimap);
        area.use(connection);
        // litRender.use(reroutePlugin);
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
        this.setupCrud();

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

    getInputNode() {
        return this.editor
            .getNodes()
            .find(
                (node) =>
                    node.editorNode.customElement?.tagName === "flow-input"
            );
    }

    getNode(id) {
        return this.editor.getNodes().find((node) => node.id === id);
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
                    await ReteNode.deserialize(this.ide, this, node),
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
                    this.doLayout([node]);
                }
            }, 100);
        }

        this.hydrated$.next(true);
        setTimeout(() => {
            this.events$.next({ type: "hydrated" });
        }, 0);
    }

    setupState() {
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
                        event.type === "nodecreated" ||
                        event.type === "hydrated" ||
                        event.type === "custom-node-selected"
                ),
                debounceTime(1000),
                map(() => {
                    const nodes = this.editor
                        .getNodes()
                        .map((node) => node.serialize());
                    const connections = JSON.parse(
                        JSON.stringify(this.editor.getConnections())
                    );
                    const Components = this.editor.nodes
                        .map((node) => node.Component)
                        .map((C) => ({
                            type: C.name,
                            parameters: C.parameters,
                            outputs: C.outputs,
                        }));

                    return {
                        nodes,
                        connections,
                        Components,
                    };
                })
            )
            .subscribe(this.state$);
    }

    setupCrud() {
        this.crudSubscription = this.crud$
            .pipe(
                filter((crud) => !Stream.storage.has(crud)),
                debug(this, "crud$"),
                tap(async (operations) => {
                    const create = operations.create;
                    const remove = operations.delete;
                    for (const serialized of create.nodes || []) {
                        const node = await ReteNode.deserialize(
                            this.ide,
                            this,
                            serialized
                        );
                        const source = this.editor.nodes.find(
                            (n) => (n.id = serialized.from)
                        );
                        this.addNode(node, source);

                        if (serialized.initialValues) {
                            for (const initialValue of serialized.initialValues) {
                                setTimeout(() => {
                                    node.component[initialValue.name] =
                                        initialValue.value;
                                }, 0);
                            }
                        }
                    }
                })
            )
            .subscribe();
    }

    selectNode(node, focus = true) {
        this.selector.add({
            id: node.id,
            unselect() {
                node.selected = false;
            },
            translate() {},
        });
        node.selected = true;
        if (focus && node.component) {
            node.component.focus();
        }
    }

    // findConfigurable(nodes) {
    //     nodes ||= this.structures.roots().nodes();

    //     if (nodes.length === 0) {
    //         return null;
    //     }

    //     for (const node of nodes) {
    //         for (const param of node.Component.parameters || []) {
    //             if (param.type === CONFIG.type) {
    //                 return node;
    //             }
    //         }
    //     }

    //     const next = nodes
    //         .map((node) => this.structures.outgoers(node.id).nodes())
    //         .flat();

    //     return this.findConfigurable(next);
    // }

    selected() {
        return this.editor.getNodes().find((node) => node.selected);
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
        this.events$.next({ type: "saved" });
    }

    disconnectedCallback() {
        this.storageSubscription?.unsubscribe();
    }

    async addNode(node, nodeToConnect, select = false) {
        await this.editor.addNode(node).catch((e) => {});
        if (nodeToConnect) {
            await this.editor
                .addConnection({
                    id: `${node.id}-${nodeToConnect.id}`,
                    source: nodeToConnect.id,
                    target: node.id,
                    sourceOutput: "output",
                    targetInput: "input",
                })
                .catch((e) => {});
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
        // this.events$
        //     .pipe(
        //         filter((event) => event.type === "custom-node-resize"),
        //         debounceTime(100),
        //         scan(
        //             (applier, event) => {
        //                 applier?.cancel();
        //                 const nodes = this.editor
        //                     .getNodes()
        //                     .filter((node) => node.selected);
        //                 if (nodes.length > 0) {
        //                     return this.doLayout([event.data]);
        //                 } else {
        //                     return this.doLayout();
        //                 }
        //             },
        //             { cancel: () => {} }
        //         )
        //     )
        //     .subscribe();

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

    async doLayout(options = {}) {
        this.arrange = new AutoArrangePlugin();

        const nodes = this.editor.getNodes();
        const connections = this.editor.getConnections().map((connection) => ({
            ...connection,
            targetInput: connection.targetInput || "owners",
        }));

        const { vertical, horizontal } = separateSubgraphs(connections, nodes);
        let isDoingHorizontal = false;
        this.arrange.addPreset(() => ({
            port(data) {
                const { spacing, top, bottom } = {
                    spacing: data.width / (data.ports * 2),
                };

                // if (data.side === "output") {
                //     return {
                //         x: 0,
                //         y: top + data.index * spacing,
                //         width: 15,
                //         height: 15,
                //         side: "EAST",
                //     };
                // }
                // return {
                //     x: 0,
                //     y:
                //         data.height -
                //         bottom -
                //         data.ports * spacing +
                //         data.index * spacing,
                //     width: 15,
                //     height: 15,
                //     side: "WEST",
                // };
                if (data.side === "output" && data.key === "output") {
                    return {
                        x: data.width / 2,
                        y: data.height,
                        width: 15,
                        height: 15,
                        side: "SOUTH",
                    };
                } else if (data.side === "output" && data.key === "assets") {
                    return {
                        x: data.width,
                        y: 0,
                        width: 15,
                        height: 15,
                        side: "EAST",
                    };
                } else if (data.side === "input" && data.key === "owners") {
                    return {
                        x: 0,
                        y: 0,
                        width: 15,
                        height: 15,
                        side: "WEST",
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
            options(id) {
                if (!isDoingHorizontal) {
                    return {};
                }

                const fixed = vertical.nodes.some((node) => node.id === id);

                return {
                    fixed,
                    priority: fixed ? 2 : 0,
                };
            },
        }));

        this.area.use(this.arrange);
        const applier = new ArrangeAppliers.TransitionApplier({
            duration: 200,
            timingFunction: (t) => t,
            onTick: () => {
                // this.zoom(nodes);
            },
        });

        // .map((connection) =>
        //     connection.targetInput === "input"
        //         ? connection
        //         : getSiblingConnection(
        //               this.editor.getConnections(),
        //               connection
        //           )
        // );
        console.log(nodes, connections);

        await this.arrange.layout({
            nodes,
            connections,
            applier,
            options: {
                "elk.direction": "DOWN",
            },
        });

        // isDoingHorizontal = true;
        // this.arrange.layout({
        //     ...horizontal,
        //     applier,
        //     options: {
        //         algorithm: "force",
        //         "elk.direction": "RIGHT",
        //     },
        // });

        return applier;
    }

    destroy() {
        this.area?.destroy();
    }

    setStatus(message) {
        this.statusMessage = message;
        this.requestUpdate();
    }

    // ...

    handleDragOver(event) {
        event.preventDefault();
    }

    async handleDrop(event) {
        event.preventDefault();
        const data = JSON.parse(event.dataTransfer.getData("text/plain"));
        const node = await ReteNode.deserialize(this.ide, this, data);
        await this.addNode(node);
        node.move(event.clientX, event.clientY);
    }

    render() {
        return html`
            <div class="column">
                <bespeak-nodes-icon
                    style="position: absolute; top: 0; right: 0; cursor: pointer; z-index: 9999;"
                    @click="${() => this.doLayout()}"></bespeak-nodes-icon>
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
        if (this.open) {
            setTimeout(() => {
                this.events$.next({
                    type: "editor-open",
                    data: this,
                });
            }, 100);
        }
        this.requestUpdate();
    }
}

function getSiblingConnection(connections, connection) {
    const downGraph = connections.filter(
        (connection) => connection.sourceOutput === "output"
    );
    const newParent = downGraph.find(
        (c) => c.target === connection.source || c.target === connection.target
    );
    const newConnection = newParent
        ? {
              id: connection.id,
              source: newParent.source,
              target:
                  newParent.target === connection.source
                      ? connection.target
                      : connection.source,
              sourceOutput: connection.sourceOutput,
              targetInput: connection.targetInput,
          }
        : connection;

    return newConnection;
}

function separateSubgraphs(connections, nodes) {
    // Initialize empty subgraphs
    let verticalSubgraph = {
        nodes: [],
        connections: [],
    };

    let horizontalSubgraph = {
        nodes: [],
        connections: [],
    };

    // Helper function to add a node to a subgraph by its id if it's not already present
    function addNodeToSubgraph(subgraph, nodeId) {
        const node = nodes.find((n) => n.id === nodeId);
        if (node && !subgraph.nodes.some((n) => n.id === nodeId)) {
            subgraph.nodes.push(node);
        }
    }

    // Populate subgraphs based on connections
    connections.forEach((connection) => {
        if (connection.sourceOutput === "output") {
            addNodeToSubgraph(verticalSubgraph, connection.source);
            addNodeToSubgraph(verticalSubgraph, connection.target);
            verticalSubgraph.connections.push(connection);
        } else if (connection.sourceOutput === "assets") {
            addNodeToSubgraph(horizontalSubgraph, connection.source);
            addNodeToSubgraph(horizontalSubgraph, connection.target);
            horizontalSubgraph.connections.push(connection);
        }
    });

    // Return the subgraphs in an object
    return {
        vertical: verticalSubgraph,
        horizontal: horizontalSubgraph,
    };
}

customElements.define("bespeak-editor", Editor);

function getAbsoluteUrl(relativeUrl) {
    const baseUrl = new URL(".", import.meta.url).href;
    const absoluteUrl = new URL(relativeUrl, baseUrl).href;
    return absoluteUrl;
}
