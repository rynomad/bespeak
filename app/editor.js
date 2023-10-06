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
import { MinimapPlugin } from "https://esm.sh/rete-minimap-plugin@2.0.0";
import { ChatFlowInput, Node, ChatFlowOutput } from "./node.js";
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
    map,
} from "https://esm.sh/rxjs";
import { DevDefault } from "./dev-default.js";
import { debug } from "./operators.js";
import { Stream } from "./stream.js";

import {
    ReteNode,
    InputNode,
    OutputNode,
    NextReteNode,
    NextLitNode,
} from "./node.js";
import { DoubleApplier } from "./layout-applier.js";
import { CONFIG } from "./types/gpt.js";
import { Custom } from "./custom.js";
import { Example } from "./example.wrapped.js";
import { layout } from "./layout.js";
import "./icons/nodes.js";

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
                        if (node.Component === ChatFlowInput) {
                            return InputNode;
                        } else if (node.Component === ChatFlowOutput) {
                            return OutputNode;
                        } else if (node instanceof NextReteNode) {
                            return NextLitNode;
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
        this.setupCrud();
        this.setupState();
        this.setupIO();

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
                    (this.isDev ? ReteNode : NextReteNode).deserialize(
                        this.ide,
                        this,
                        node
                    ),
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
                    if (node.Component === ChatFlowOutput) {
                        node = this.structures.incomers(node.id).nodes().pop();
                    }
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
                tap((operations) => {
                    const create = operations.create;
                    const remove = operations.delete;
                    for (const serialized of create.nodes || []) {
                        const node = NextReteNode.deserialize(
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

    setupIO() {
        this.hydrated$.pipe(take(1)).subscribe(async () => {
            if (this.inputs$) {
                const nodes = this.editor.getNodes();
                let input, output;
                if (nodes.length === 0) {
                    input = new ReteNode(this.ide, this, ChatFlowInput);
                    output = new ReteNode(this.ide, this, ChatFlowOutput);
                    const devDefault = new ReteNode(this.ide, this, DevDefault);
                    await this.addNode(input, null, true);
                    await this.addNode(output, null, true);
                    await this.addNode(devDefault, null, true);
                    await this.addConnection({
                        id: `${input.id}-${devDefault.id}`,
                        source: input.id,
                        target: devDefault.id,
                        sourceOutput: "output",
                        targetInput: "input",
                    });

                    await this.addConnection({
                        id: `${devDefault.id}-${output.id}`,
                        source: devDefault.id,
                        target: output.id,
                        sourceOutput: "output",
                        targetInput: "input",
                    });
                } else {
                    input = nodes.find(
                        (node) => node.Component === ChatFlowInput
                    );
                    output = nodes.find(
                        (node) => node.Component === ChatFlowOutput
                    );
                }

                this.inputs$.subscribe(input.outputs$);
                output.inputs$
                    .pipe(debug(this, "output inputs"))
                    .subscribe(this.outputs$);
            }
        });
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

    findConfigurable(nodes) {
        nodes ||= this.structures.roots().nodes();

        if (nodes.length === 0) {
            return null;
        }

        for (const node of nodes) {
            for (const param of node.Component.parameters || []) {
                if (param.type === CONFIG.type) {
                    return node;
                }
            }
        }

        const next = nodes
            .map((node) => this.structures.outgoers(node.id).nodes())
            .flat();

        return this.findConfigurable(next);
    }

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
        this.arrange = new AutoArrangePlugin();
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
                } else if (data.side === "output" && data.key === "child") {
                    return {
                        x: data.width,
                        y: 0,
                        width: 15,
                        height: 15,
                        side: "EAST",
                    };
                } else if (data.side === "input" && data.key === "parent") {
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
        }));
        this.area.use(this.arrange);

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

    layoutLeaves() {
        const leaves = this.structures.leaves().nodes();
        const nodes = leaves.filter(
            (node) => node.Component !== ChatFlowOutput
        );
        if (leaves.length && !nodes.length) {
            nodes.push(this.structures.incomers(leaves[0].id).nodes());
        }
        return this.doLayout(nodes.flat());
    }

    zoom(nodes) {
        if (nodes) {
            AreaExtensions.zoomAt(this.area, nodes);
        }
    }

    doLayout() {
        const applier = new DoubleApplier({
            duration: 200,
            timingFunction: (t) => t,
            onTick: () => {
                // this.zoom(nodes);
            },
        });

        const nodes = this.editor.getNodes();
        const connections = this.editor.getConnections();
        const arrangedNodes = layout(nodes, connections);
        applier.setEditor(this.editor);
        applier.setArea(this.area);
        applier.apply(arrangedNodes);

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

    handleDrop(event) {
        event.preventDefault();
        // const componentName = event.dataTransfer.getData("text/plain");
        // const component = NextReteNode.components.get(componentName);
        // if (component) {
        //     const node = new ReteNode(this.ide, this, Custom);
        //     node.component.customElement =
        //         component === Custom ? Example : component;
        //     this.addNode(node, null, true);
        // }
        const next = new NextReteNode(this.ide, this, Custom);
        this.addNode(next); //, null, true);
    }

    render() {
        return html`
            <div class="column">
                <bespeak-nodes-icon
                    style="position: absolute; top: 0; right: 0; cursor: pointer; z-index: 9999;"
                    @click="${() =>
                        this.doLayout(
                            this.editor.getNodes()
                        )}"></bespeak-nodes-icon>
                <bespeak-nodes-icon
                    style="position: absolute; top: 0; right: 30px; cursor: pointer; transform: rotate(90deg); z-index: 9999;"
                    @click="${() =>
                        this.doLayout(this.editor.getNodes(), {
                            "elk.direction": "RIGHT",
                        })}"></bespeak-nodes-icon>
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
                this.layoutLeaves();
            }, 100);
        }
        this.requestUpdate();
    }
}

customElements.define("bespeak-editor", Editor);
