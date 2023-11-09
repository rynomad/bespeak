import BespeakComponent from "./component.js";
import { ReteNode } from "./node.child.js";
import {
    takeUntil,
    map,
    combineLatest,
    debounceTime,
} from "https://esm.sh/rxjs";
import { html } from "https://esm.sh/lit";
import { Keys } from "./keys.js";
import { getDefaultValue } from "./util.js";

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

    firstUpdated() {
        this.removed$.subscribe(() => {
            for (const node of this.nodeMap.values()) {
                try {
                    document.body.removeChild(node);
                } catch (e) {}
            }
        });
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
    }

    async _process(input, config) {
        console.log(
            "subflow _process",
            input,
            config,
            this.reteId,
            Date.now(),
            this.connectionMap,
            this.nodeMap,
            this.config,
            this
        );
        if (this.connectionMap) {
            for (const { source, target } of this.connectionMap) {
                this.nodeMap.get(source).unpipe(this.nodeMap.get(target));
            }
        }

        if (this.nodeMap) {
            for (const node of this.nodeMap.values()) {
                this.removeChild(node);
            }
        }

        const workspace = await new Promise((resolve) => {
            const sub = this.ide.workspaces$.subscribe((workspaces) => {
                const workspace = workspaces.find(
                    (w) => w.id === config.workspace
                );
                if (workspace) {
                    setTimeout(() => {
                        sub.unsubscribe();
                    }, 0);
                    resolve(workspace);
                }
            });
        });

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

            const slave = new Component(`${this.reteId}-${node.id}`);

            slave.config = node.config;
            slave.keys = await Keys.getKeys(Component);
            slave.ide = this.ide;
            slave.removed$ = this.removed$;
            slave.style = "display: none;";

            this.appendChild(slave);

            this.nodeMap.set(node.id, slave);

            slave.output$.subscribe((data) => {
                console.log(
                    "SUBFLOW NODE OUTPUT",
                    slave.title,
                    slave.id,
                    slave.reteId,
                    slave.input,
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

        const inputNode = this.nodeMap.get(
            nodes.find((n) => n.key === "flow-input")?.id
        );

        const pipedToOutput = this.nodeMap.values().filter((node) => {
            return node.pipedTo.has(output);
        });

        if (output) {
            let prom = new Promise((resolve) => {
                const sub = output.output$
                    .pipe(debounceTime(1000), takeUntil(this.removed$))
                    .subscribe((data) => {
                        this.output = data;
                        resolve(data);
                    });
            });

            for (const node of this.nodeMap.values()) {
                node.started = true;
            }

            // this.nodeMap
            //     .values()
            //     .filter((node) => {
            //         return node.pipedTo.has(output);
            //     })
            //     .forEach((node) => {
            //         node.style = "";
            //     });

            setTimeout(() => {
                console.log("INPUT NODE", inputNode);
                if (inputNode) {
                    inputNode.input = input;
                }
            }, 0);

            return prom;
        }
    }

    async onPipe() {
        if (this.pipeSubscription) {
            this.pipeSubscription.unsubscribe();
        }

        this.pipeSubscription = combineLatest(
            Array.from(this.pipedFrom).map((component) => component.output$)
        ).subscribe(async (outputs) => {
            outputs = outputs.flat();
            this.input = outputs;
        });

        if (this.pipedFrom.size == 0) {
            this.input = [];
        }
    }

    render() {
        return html`<div>
            Subflow:
            ${this.workspaces.find((w) => w.id === this.config.workspace)?.name}
            <slot> </slot>
        </div>`;
    }
}

if (!customElements.get("bespeak-subflow-hard-code")) {
    customElements.define("bespeak-subflow-hard-code", Subflow);
}
