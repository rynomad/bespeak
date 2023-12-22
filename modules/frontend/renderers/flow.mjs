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
import { BetterDomSocketPosition } from "../rete/socket-position.mjs";
import { Connection } from "../rete/connection.mjs";
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
    debounceTime,
    withLatestFrom,
    concatMap,
    window,
    mergeMap,
    combineLatest,
    takeUntil,
    buffer,
    of,
    ReplaySubject,
    fromEventPattern,
    toArray,
    skip,
    tap,
    take,
    switchMap,
} from "https://esm.sh/rxjs";

import { ReteNode, LitNode } from "../rete/nodes.mjs";
import "../icons/nodes.mjs";
import { filter } from "rxjs";
import { pluck } from "https://esm.sh/rxjs@7.8.1";

export class Flow extends LitElement {
    static get properties() {
        return {
            operable: { type: Object },
        };
    }

    static get styles() {
        return css`
            :host {
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
        area.use(minimap);
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

        // this.setupArrange();
        // this.setupStorage();
        // this.setupCrud();

        AreaExtensions.zoomAt(area, editor.getNodes());

        AreaExtensions.simpleNodesOrder(area);

        const selector = (this.selector = AreaExtensions.selector());
        const accumulating = AreaExtensions.accumulateOnCtrl();

        AreaExtensions.selectableNodes(area, selector, { accumulating });
    }

    updated(changedProperties) {
        if (!this.initialized && this.operable) {
            this.initialized = true;
            this.initialize(this.shadowRoot.querySelector(".content"));
        }
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
    }

    selected() {
        return this.editor.getNodes().find((node) => node.selected);
    }

    deselectNode(node) {
        this.selector.remove({ id: node.id });
        node.selected = false;
    }

    getNode(id) {
        return this.editor.nodes.find((node) => node.id === id);
    }

    async addNode(node, nodeToConnect, select = false) {
        await this.editor.addNode(node).catch((e) => {});
    }

    async removeNode(nodeId) {
        // await this.editor.removeNode(node);
    }

    async addConnection(connection) {
        await this.editor.addConnection(connection);
    }

    async removeConnection(connectionId) {
        await this.editor.removeConnection(connectionId);
    }

    getConnection(connection) {
        console.error("GET CONNECTION", connection, this.editor.connections);
        return this.editor.connections.find(
            (conn) =>
                conn.source === connection.source &&
                conn.target === connection.target
        );
    }

    async initialize(container) {
        await this.createEditor(container);

        const editorEvents$ = new ReplaySubject(1);
        const debouncedWindow$ = editorEvents$.pipe(
            window(editorEvents$.pipe(debounceTime(1000))),
            mergeMap((window$) => window$.pipe(toArray())),
            skip(1)
        );
        this.subscriptions = [
            fromEventPattern(
                (handler) => {
                    this.editor.addPipe((ctx) => {
                        if (
                            [
                                "nodecreated",
                                "noderemoved",
                                "connectioncreated",
                                "connectionremoved",
                            ].includes(ctx.type)
                        ) {
                            handler(ctx);
                        }
                        return ctx;
                    });
                    this.area.addPipe((ctx) => {
                        // handler(ctx);
                        return ctx;
                    });
                },
                (handler) => this.editor.removePipe?.(handler)
            ).subscribe(editorEvents$),

            debouncedWindow$
                .pipe(
                    withLatestFrom(this.operable.read$$("process:config")),
                    concatMap(([events, { data: config }]) => {
                        console.log("EVENT", events, config);
                        const newConfig = { ...config };

                        for (const event of events) {
                            if (event.type === "noderemoved") {
                                newConfig.nodes = newConfig.nodes.filter(
                                    (_node) =>
                                        !event.data.id.startsWith(
                                            _node.system.name
                                        )
                                );
                            } else if (event.type === "connectionremoved") {
                                const {
                                    source,
                                    target,
                                    sourceOutput,
                                    targetInput,
                                } = event.data;

                                if (sourceOutput === "tools") {
                                    newConfig.nodes = newConfig.nodes.map(
                                        (node) => {
                                            if (
                                                source.startsWith(
                                                    node.system.name
                                                )
                                            ) {
                                                return {
                                                    ...node,
                                                    tools: node.tools.filter(
                                                        (tool) =>
                                                            !target.startsWith(
                                                                tool
                                                            )
                                                    ),
                                                };
                                            }

                                            return node;
                                        }
                                    );
                                } else {
                                    newConfig.connections =
                                        newConfig.connections.filter(
                                            (c) =>
                                                !(
                                                    source.startsWith(c.from) &&
                                                    target.startsWith(c.to)
                                                )
                                        );
                                }
                            } else if (event.type === "connectioncreated") {
                                const {
                                    source,
                                    target,
                                    sourceOutput,
                                    targetInput,
                                } = event.data;

                                if (sourceOutput === "tools") {
                                    newConfig.nodes = newConfig.nodes.map(
                                        (node) => {
                                            if (
                                                source.startsWith(
                                                    node.system.name
                                                )
                                            ) {
                                                console.log(
                                                    "toolnode change",
                                                    node
                                                );
                                                return {
                                                    ...node,
                                                    tools: [
                                                        ...node.tools,
                                                        target.split("-")[0],
                                                    ],
                                                };
                                            }

                                            return node;
                                        }
                                    );
                                } else {
                                    newConfig.connections =
                                        newConfig.connections.concat([
                                            {
                                                from: event.data.source.split(
                                                    "-"
                                                )[0],
                                                to: event.data.target.split(
                                                    "-"
                                                )[0],
                                            },
                                        ]);
                                }
                            }
                        }

                        return this.operable
                            .write$$("process:config", newConfig)
                            .pipe(take(1));
                    }),
                    takeUntil(this.operable.destroy$)
                )
                .subscribe(),
            this.operable.status$
                .pipe(
                    filter(({ status }) => status === "rebuild"),
                    pluck("detail"),
                    concatMap(
                        async ({
                            nodes: operables,
                            config: { nodes, connections },
                        }) => {
                            console.error(
                                "REBUILD",
                                operables,
                                nodes,
                                connections
                            );
                            const liveConnections = [];
                            for (const _node of nodes) {
                                const id = `${_node.system.name}-${this.operable.id}`;
                                let node = this.getNode(id);
                                if (!node) {
                                    console.log(
                                        "CREATE NODE",
                                        id,
                                        operables.find((o) => o.id === id),
                                        _node
                                    );
                                    node = new ReteNode(
                                        id,
                                        operables.find((o) => o.id === id),
                                        this
                                    );
                                    await this.addNode(node);
                                }

                                for (const tool of _node.tools) {
                                    const toolId = `${tool}-${this.operable.id}`;
                                    const connection = {
                                        id: `${id}-${toolId}`,
                                        source: id,
                                        target: toolId,
                                        sourceOutput: "tools",
                                        targetInput: "tool",
                                    };
                                    liveConnections.push(connection);

                                    const toolConnection =
                                        this.getConnection(connection);
                                    if (!toolConnection) {
                                        await this.addConnection(
                                            connection
                                        ).catch((e) => {
                                            console.error(e, connection);
                                        });
                                    }
                                }
                            }

                            for (const _connection of connections) {
                                const connection = {
                                    id: `${_connection.from}-${_connection.to}-${this.operable.id}`,
                                    source: `${_connection.from}-${this.operable.id}`,
                                    target: `${_connection.to}-${this.operable.id}`,
                                    sourceOutput: "output",
                                    targetInput: "input",
                                };
                                liveConnections.push(connection);
                                const nodeConnection =
                                    this.getConnection(connection);
                                if (!nodeConnection) {
                                    await this.addConnection(connection).catch(
                                        (e) => {
                                            console.error(e, connection);
                                        }
                                    );
                                }
                            }

                            const reteNodes = this.editor.nodes;

                            for (const node of reteNodes) {
                                if (
                                    !nodes.find(
                                        (n) =>
                                            `${n.system.name}-${this.operable.id}` ===
                                            node.id
                                    )
                                ) {
                                    await this.removeNode(node.id);
                                }
                            }

                            const reteConnections = this.editor.connections;

                            for (const connection of reteConnections) {
                                if (
                                    !liveConnections.find(
                                        (c) =>
                                            c.source === connection.source &&
                                            c.target === connection.target
                                    )
                                ) {
                                    await this.removeConnection(connection.id);
                                }
                            }
                        }
                    )
                )
                .subscribe(),
        ];
    }

    destroy() {
        this.subscriptions?.forEach((sub) => sub.unsubscribe());
        this.area?.destroy();
    }

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
                <div class="content"></div>
            </div>
        `;
    }
}

customElements.define("bespeak-flow", Flow);
