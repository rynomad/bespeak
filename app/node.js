import { Presets as LitPresets } from "https://esm.sh/gh/rynomad/rete-lit-plugin/dist/rete-litv-plugin.esm.local.js";
import { ClassicPreset as Classic } from "https://esm.sh/rete";
import { css } from "https://esm.sh/lit";
import { html, LitElement } from "https://esm.sh/lit";
import {
    ReplaySubject,
    filter,
    shareReplay,
    scan,
    map,
    switchMap,
    switchScan,
    take,
    combineLatest,
    distinctUntilChanged,
    tap,
    skip,
} from "https://esm.sh/rxjs";
import { GPT } from "./gpt.js";
import { debug } from "./operators.js";
import { v4 as uuidv4 } from "https://esm.sh/uuid";
import { ChatInput } from "./chat-input-node.js";

export class Node extends LitPresets.classic.Node {
    static get properties() {
        return {
            data: { type: Object },
            emit: { type: Function },
        };
    }

    nodeStyles() {
        return "";
    }

    constructor() {
        super();
        this.test = Math.random();
        this.constructedAt = Date.now();

        // Add initialization code here
        this.initComponent();

        const targetNode = this;
        const config = { attributes: true, attributeFilter: ["style"] };

        const callback = (mutationsList) => {
            for (const mutation of mutationsList) {
                if (
                    mutation.type === "attributes" &&
                    mutation.attributeName === "style"
                ) {
                    const newValue = targetNode.getAttribute("style");

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
        observer.observe(targetNode, config);
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
            data: { ...this.data, element: this.element },
        });
    }

    async initComponent() {
        await this.updateComplete;

        this.data.editorNode = this;

        if (this.data.component) {
            this.appendChild(this.data.component);
        }
    }

    async connectedCallback() {
        super.connectedCallback();
        let prevHeight = this.getBoundingClientRect().height;

        this.resizeObserver = new ResizeObserver((entries) => {
            for (let entry of entries) {
                const newHeight = entry.contentRect.height;

                if (Math.abs(newHeight - prevHeight) > 50) {
                    this.handleResize();
                    prevHeight = newHeight;
                }
            }
        });
        this.resizeObserver.observe(this);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.resizeObserver.disconnect();
    }

    static get styles() {
        return [
            LitPresets.classic.Node.styles[0],
            css`
                :host {
                    display: block;
                }
                .name-heading {
                    font-size: 2em; /* Adjust size as you like */
                    font-weight: bold;
                    margin: 0;
                }
                .node {
                    background: var(--node-color);
                    border: 2px solid #4e58bf;
                    border-radius: 10px;
                    cursor: pointer;
                    box-sizing: border-box;
                    width: 70vw;
                    height: auto;
                    position: relative;
                    user-select: none;
                    line-height: initial;
                    font-family: sans-serif;
                }

                .node:hover {
                    background: linear-gradient(
                            rgba(255, 255, 255, 0.04),
                            rgba(255, 255, 255, 0.04)
                        ),
                        var(--node-color);
                }

                .node.selected {
                    background: var(--node-color-selected);
                    border-color: #e3c000;
                }

                .node .title {
                    color: white;
                    font-family: sans-serif;
                    font-size: 18px;
                    padding: 8px;
                }

                .flex-column {
                    display: flex;
                    flex-direction: column;
                }

                .flex-row {
                    display: flex;
                    justify-content: space-evenly;
                    min-height: 24px;
                }

                .socket-column {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    flex-grow: 1;
                }

                .input-sockets {
                    margin-top: calc(
                        (var(--socket-size) / -2) - var(--socket-margin)
                    );
                }

                .output-sockets {
                    margin-bottom: calc(
                        (var(--socket-size) / -2) - var(--socket-margin)
                    );
                }
            `,
        ];
    }

    get connectableInputs() {
        return this.inputs().filter((i) => !i[1].user);
    }

    get mappedInputs() {
        return this.inputs().map(([key, entry]) => ({ label: key, ...entry }));
    }

    get mappedOutputs() {
        return this.outputs().map(([key, entry]) => ({ label: key, ...entry }));
    }

    get mappedIntermediates() {
        return Object.entries(this.data.intermediates || {}).map(
            ([key, entry]) => ({ label: key, ...entry })
        );
    }

    render() {
        const input = this.data?.inputs?.input || {};
        const output = this.data?.outputs?.output || {};
        // consol   e.log("rerender Transf  ormNode");
        return html`
            <div
                class="node ${this.data?.selected ? "selected" : ""}"
                data-testid="node">
                <div class="flex-column">
                    <div class="flex-row input-sockets">
                        <!-- Inputs -->
                        <div
                            class="socket-column"
                            data-testid="input-${input.key}">
                            <ref-element
                                class="input-socket"
                                .data=${{
                                    type: "socket",
                                    side: "input",
                                    key: input.label,
                                    nodeId: this.data?.id,
                                    payload: input.socket,
                                }}
                                .emit=${this.emit}
                                data-testid="input-socket"></ref-element>
                        </div>
                    </div>

                    <slot></slot>

                    <div class="flex-row output-sockets">
                        <!-- Outputs -->

                        <ref-element
                            class="output-socket"
                            .data=${{
                                type: "socket",
                                side: "output",
                                key: output.label,
                                nodeId: this.data?.id,
                                payload: output.socket,
                            }}
                            .emit=${this.emit}
                            data-testid="output-socket"></ref-element>
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define("bespeak-node", Node);

export class InputNode extends LitPresets.classic.Node {
    static get properties() {
        return {
            data: { type: Object },
            emit: { type: Function },
        };
    }

    constructor() {
        super();
        this.updateComplete.then(() => {
            this.data.editorNode = this;
        });
        this.test = Math.random();
        this.constructedAt = Date.now();

        const targetNode = this;
        const config = { attributes: true, attributeFilter: ["style"] };

        const callback = (mutationsList) => {
            for (const mutation of mutationsList) {
                if (
                    mutation.type === "attributes" &&
                    mutation.attributeName === "style"
                ) {
                    const newValue = targetNode.getAttribute("style");

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
        observer.observe(targetNode, config);
    }

    setAttribute(name, value) {
        if (name === "style") {
            return;
        }
        super.setAttribute(name, value);
    }

    connectedCallback() {
        super.connectedCallback();
        if (this.initialized) return;
        this.initialized = true;
        this.updatePosition();
        this.data.editor.events$
            .pipe(
                filter((event) =>
                    ["zoomed", "translated"].includes(event.type)
                ),
                tap(this.updatePosition.bind(this))
            )
            .subscribe();
    }

    updatePosition() {
        const { x, y } = this.getPosition();
        this.data.editor.area.translate(this.data.id, { x, y });
    }

    getPosition() {
        const area = this.data.editor.area;
        let { x, y, k } = area.area.transform;
        x ||= 0;
        y ||= 0;
        const box = area.container.getBoundingClientRect();
        const halfWidth = box.width / 2;
        const height = 0;
        return { x: halfWidth - x, y: height - y / k };
    }

    render() {
        const output = this.data.outputs?.output || {};
        return html`
            <ref-element
                class="output-socket"
                .data=${{
                    type: "socket",
                    side: "output",
                    key: output.label,
                    nodeId: this.data?.id,
                    payload: output.socket,
                }}
                .emit=${this.emit}
                data-testid="output-socket">
            </ref-element>
        `;
    }
}

export class OutputNode extends LitPresets.classic.Node {
    static get properties() {
        return {
            data: { type: Object },
            emit: { type: Function },
        };
    }

    static styles = css`
        :host,
        .node {
            display: block;
        }
    `;

    constructor() {
        super();
        this.updateComplete.then(() => {
            this.data.editorNode = this;
        });
        this.test = Math.random();
        this.constructedAt = Date.now();

        const targetNode = this;
        const config = { attributes: true, attributeFilter: ["style"] };

        const callback = (mutationsList) => {
            for (const mutation of mutationsList) {
                if (
                    mutation.type === "attributes" &&
                    mutation.attributeName === "style"
                ) {
                    const newValue = targetNode.getAttribute("style");

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
        observer.observe(targetNode, config);
    }

    connectedCallback() {
        super.connectedCallback();
        if (this.initialized) return;
        this.initialized = true;
        this.updatePosition();
        this.data.editor.events$
            .pipe(
                filter((event) =>
                    ["zoomed", "translated"].includes(event.type)
                ),
                tap(this.updatePosition.bind(this))
            )
            .subscribe();
    }

    updatePosition() {
        const { x, y } = this.getPosition();
        this.data.editor.area.translate(this.data.id, { x, y });
    }

    setAttribute(name, value) {
        if (name === "style") {
            return;
        }
        super.setAttribute(name, value);
    }

    getPosition() {
        const area = this.data.editor.area;
        let { x, y, k } = area.area.transform;
        x ||= 0;
        y ||= 0;
        const box = area.container.getBoundingClientRect();
        const halfWidth = box.width / 2;
        const height = box.height;
        return { x: halfWidth - x, y: height - y };
    }

    render() {
        const input = this.data.inputs?.input || {};
        return html`
            <ref-element
                class="input-socket"
                .data=${{
                    type: "socket",
                    side: "input",
                    key: input.label,
                    nodeId: this.data?.id,
                    payload: input.socket,
                }}
                .emit=${this.emit}
                data-testid="output-socket">
            </ref-element>
        `;
    }
}

customElements.define("bespeak-input-node", InputNode);
customElements.define("bespeak-output-node", OutputNode);

export class InputNodeComponent extends LitElement {
    static styles = css`
        :host {
            display: none;
        }
    `;

    render() {
        return html`<slot></slot>`;
    }
}

customElements.define("bespeak-input-node-component", InputNodeComponent);

export class OutputNodeComponent extends LitElement {
    static styles = css`
        :host {
            display: none;
        }
    `;

    render() {
        return html`<slot></slot>`;
    }
}

customElements.define("bespeak-output-node-component", OutputNodeComponent);

export class ReteNode extends Classic.Node {
    static globals = new Map();
    static _sockets = {};

    static getSocket(workspaceId) {
        if (!workspaceId) throw new Error("workspaceId is undefined");
        this._sockets[workspaceId] =
            this._sockets[workspaceId] || new Classic.Socket(workspaceId);
        return this._sockets[workspaceId];
    }

    get socket() {
        return Transformer.getSocket(this.workspaceId);
    }

    get area() {
        return this.canvas?.area;
    }

    get socket() {
        return this.constructor.getSocket(this.workspaceId);
    }

    get width() {
        return this.component.parentElement
            ? this.component.parentElement.clientWidth
            : 0;
    }

    get height() {
        return this.component.parentElement
            ? this.component.parentElement.clientHeight
            : 0;
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
            this.editorNode.emit({
                type: "custom-node-selected",
                data: this,
            });
        } else {
            this.editorNode.emit({
                type: "custom-node-deselected",
                data: this,
            });
        }
        this.editorNode.requestUpdate();
    }

    nodeSubscriptions = [];

    static components = new Map();

    static registerComponent(Component) {
        this.components.set(Component.name, Component);
    }

    static deserialize(ide, editor, definition) {
        return new this(
            ide,
            editor,
            this.components.get(definition.Component),
            definition.id
        );
    }

    serialize() {
        return {
            id: this.id,
            Component: this.Component.name,
        };
    }

    constructor(ide, editor, Component = GPT, id = uuidv4()) {
        super();
        this.id = id;
        this.ide = ide;
        this.editor = editor;
        this.workspaceId = editor.id;
        this.Component = Component;

        this.addInput("input", new Classic.Input(this.socket, "input"));
        this.addOutput("output", new Classic.Output(this.socket, "output"));

        this.inputs$ = new ReplaySubject(1);
        this.outputs$ = new ReplaySubject(1);
        this.parameters$ = new ReplaySubject(1);

        this.setupInputs();
        this.setupGlobals();
        this.setupParameters();
        this.setupCleanup();
        this.setupComponent();
    }

    setupComponent() {
        this.component = new this.Component();
        this.component.node = this;
    }

    getConnection$() {
        return this.editor.events$.pipe(
            filter(
                (event) =>
                    event.type === "connectioncreated" ||
                    event.type === "connectionremoved"
            ),
            filter((event) => event.data?.target === this.id),
            debug(this, "connection spy"),
            shareReplay(1)
        );
    }

    setupInputs() {
        this.connections$ = this.getConnection$();

        this.inputsSubscription = this.connections$
            .pipe(
                // scan to accumulate present state of nodes connected to
                // this node's inputs
                scan((acc, value) => {
                    if (value.type === "connectioncreated") {
                        acc.push(value.data);
                    } else if (value.type === "connectionremoved") {
                        acc = acc.filter((c) => c.id !== value.data.id);
                    }
                    return acc;
                }, []),
                map((connections) => {
                    return connections.map((connection) => {
                        const sourceNode = this.editor.editor.getNode(
                            connection.source
                        );
                        let sourceOutput = sourceNode.outputs$;
                        return sourceOutput;
                    });
                }),
                switchMap((outputs$) => {
                    return combineLatest(outputs$);
                }),
                map((allOutputs) => allOutputs.flat())
            )
            .subscribe(this.inputs$);

        this.inputs$.next([]);
    }

    setupGlobals() {
        this.globalsSubscription = this.parameters$
            .pipe(
                debug(this, "parameters spy"),
                tap((parameters) => {
                    const globals = parameters.filter(({ global }) => global);

                    if (globals.length === 0) {
                        return [];
                    }

                    if (!this.constructor.globals.has(this.Component)) {
                        this.constructor.globals.set(this.Component, new Map());
                    }

                    const globalMap = this.constructor.globals.get(
                        this.Component
                    );

                    for (const instance of globals) {
                        if (!globalMap.has(instance.label)) {
                            const globalSubject = new ReplaySubject(1);
                            globalMap.set(instance.label, globalSubject);
                        }
                        const globalSubject = globalMap.get(instance.label);

                        instance.subject.pipe(take(1)).subscribe((value) => {
                            globalSubject
                                .pipe(
                                    debug(this, "global global spy"),
                                    distinctUntilChanged()
                                )
                                .subscribe((value) => {
                                    instance.subject.next(value);
                                });

                            instance.subject
                                .pipe(
                                    debug(this, "global instance spy"),
                                    distinctUntilChanged(),
                                    filter(
                                        (value) =>
                                            JSON.stringify(value) !== "{}"
                                    )
                                )
                                .subscribe((value) => {
                                    globalSubject.next(value);
                                });
                        });
                    }
                })
            )
            .subscribe();
    }

    setupParameters() {
        this.parametersSubscription = combineLatest(
            this.parameters$,
            this.inputs$
        )
            .pipe(
                debug(this, "inputs spy"),
                switchScan(async (subs, [parameters, inputs]) => {
                    for (const sub of subs) {
                        sub.unsubscribe();
                    }

                    const _subs = [];
                    for (const input of inputs) {
                        const match = parameters.find(
                            (p) => p.type === input.type
                        );
                        if (match && match.type !== "prompt") {
                            match.subject.subscribe((value) => {
                                console.log(
                                    "debug order setupParameters",
                                    value,
                                    match.subject,
                                    match.node.id
                                );
                            });
                            _subs.push(
                                input.subject
                                    .pipe(
                                        filter(
                                            ({ fromStorage }) => !fromStorage
                                        )
                                    )
                                    .subscribe((value) => {
                                        console.log("match input", value);
                                        match.subject.next(value);
                                    })
                            );
                        }
                    }

                    return _subs;
                }, [])
            )
            .subscribe();
    }

    setupCleanup() {
        this.editor.events$
            .pipe(
                filter((event) => event.type === "noderemoved"),
                filter((event) => event.data.id === this.id),
                take(1)
            )
            .subscribe(() => {
                this.inputsSubscription.unsubscribe();
                this.parametersSubscription.unsubscribe();
            });
    }

    data() {}
}

ReteNode.registerComponent(GPT);
ReteNode.registerComponent(ChatInput);
ReteNode.registerComponent(InputNode);
ReteNode.registerComponent(OutputNode);
