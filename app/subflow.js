import BespeakComponent from "./component.js";
import { ReteNode } from "./node.child.js";
import { takeUntil, map } from "https://esm.sh/rxjs";
import { Keys } from "./keys.js";

export default class Subflow extends BespeakComponent {
    static config = {
        type: "object",
        properties: {
            workspace: {
                type: "string",
                title: "Workspace",
                description: "The workspace to use",
            },
        },
    };

    constructor(id) {
        super(id);
        this.workspaces = [];
    }

    updated(changes) {
        super.updated(changes);
        if (changes.has("ide")) {
            this.ide.workspaces$
                .pipe(
                    map((workspaces) =>
                        workspaces.filter(({ nodes }) =>
                            nodes.some((node) =>
                                [
                                    "flow-input",
                                    "flow-output",
                                    "flow-owners",
                                    "flow-assets",
                                ].some((name) => name === node.key)
                            )
                        )
                    )
                )
                .subscribe((workspaces) => {
                    this.workspaces = workspaces;
                    this.constructor.config = {
                        ...this.constructor.config,
                        properties: {
                            ...this.constructor.config.properties,
                            workspace: {
                                ...this.constructor.config.properties.workspace,
                                oneOf: workspaces.map(({ id, name }) => ({
                                    title: name,
                                    const: id,
                                })),
                            },
                        },
                    };

                    this.requestUpdate();
                });
        }
        if (changes.has("config")) {
            this.updateDaemon();
        }
    }

    async updateDaemon() {
        if (this.connectionMap) {
            for (const { source, target } of this.connectionMap) {
                this.nodeMap.get(source).unpipe(this.nodeMap.get(target));
            }
        }

        if (this.nodeMap) {
            for (const node of this.nodeMap.values()) {
                document.body.removeChild(node);
            }
        }

        const workspace = this.workspaces.find(
            (w) => w.id === this.config.workspace
        );

        if (!workspace) {
            return;
        }

        const { nodes, connections } = workspace;

        this.nodeMap = new Map();
        this.connectionMap = new Map();

        for (const node of nodes) {
            const { Component } = await ReteNode.getComponent(
                node.key,
                node.version
            );

            const master = new Component(node.id);
            const config = await master.cache.getItem("config");

            const slave = new Component(`${this.reteId}-${node.id}`);

            slave.config = config;
            slave.keys = await Keys.getKeys(Component);
            slave.ide = this.ide;
            slave.removed$ = this.removed$;

            document.body.appendChild(slave);
            slave.output = await master.cache.getItem("output");

            this.nodeMap.set(node.id, slave);

            slave.output$.subscribe((data) => {
                console.log(
                    "SUBFLOW NODE OUTPUT",
                    slave.id,
                    slave.reteId,
                    data
                );
            });
        }

        for (const connection of connections) {
            const { source, target } = connection;
            const sourceNode = this.nodeMap.get(source);
            const targetNode = this.nodeMap.get(target);

            sourceNode.pipe(targetNode);
        }

        const output = this.nodeMap.get(
            nodes.find((n) => n.key === "flow-output")?.id
        );

        if (output) {
            output.output$.pipe(takeUntil(this.removed$)).subscribe((data) => {
                console.log("SUBFLOW OUTPUT", data);
                // this.processing = false;
                this.output = data;
            });
        }

        const input = this.nodeMap.get(
            nodes.find((n) => n.key === "flow-input")?.id
        );

        if (input) {
            input.input = this.input;
        }
    }

    async _process(input, config) {
        const inputNode = this.nodeMap.get(
            this.workspaces
                .find((w) => w.id === config.workspace)
                .nodes.find((n) => n.key === "flow-input")?.id
        );

        if (inputNode) {
            console.log("SUBFLOW INPUT", inputNode.id, inputNode.reteId, input);
            inputNode.input = input;
        }
    }
}

if (!customElements.get("bespeak-subflow-hard-code")) {
    customElements.define("bespeak-subflow-hard-code", Subflow);
}
