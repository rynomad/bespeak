import BespeakComponent from "./component.js";
import { ReteNode } from "./node.child.js";
import { takeUntil } from "https://esm.sh/rxjs";

export default class Subflow extends BespeakComponent {
    static config = {
        title: "Subflow",
        description: "A subflow",
        schema: {
            type: "object",
            properties: {
                workspace: {
                    type: "string",
                    title: "Workspace",
                    description: "The workspace to use",
                },
            },
        },
    };

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
                    this.constructor.config = {
                        ...this.constructor.config,
                        schema: {
                            ...this.constructor.config.schema,
                            properties: {
                                ...this.constructor.config.schema.properties,
                                workspace: {
                                    ...this.constructor.config.schema.properties
                                        .workspace,
                                    oneOf: workspaces.map(({ id, name }) => ({
                                        title: name,
                                        const: id,
                                    })),
                                },
                            },
                        },
                    };

                    this.requestUpdate();
                });
        }
    }

    updated(changes) {
        super.updated(changes);
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

        const workspace = this.workspaces.find(
            (w) => w.id === this.config.workspace
        );

        if (!workspace) {
            throw new Error("Workspace not found for subflow");
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
            slave.ide = this.ide;
            slave.removed$ = this.removed$;

            this.nodeMap.set(node.id, slave);
        }

        for (const connection of connections) {
            const { source, target } = connection;
            const sourceNode = this.nodeMap.get(source);
            const targetNode = this.nodeMap.get(target);

            sourceNode.pipe(targetNode);
        }

        const output = this.nodeMap.get(
            nodes.find((n) => n.key === "flow-output").id
        );

        if (output) {
            output.output$.pipe(takeUntil(this.removed$)).subscribe((data) => {
                this.output = data;
            });
        }
    }

    async _process(input, config) {
        const inputNode = this.nodeMap.get(
            this.workspaces
                .find((w) => w.id === config.workspace)
                .nodes.find((n) => n.key === "flow-input").id
        );

        if (inputNode) {
            inputNode.input = input;
        }
    }
}
