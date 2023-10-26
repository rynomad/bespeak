import { Presets as LitPresets } from "https://esm.sh/gh/rynomad/rete-lit-plugin/dist/rete-litv-plugin.esm.local.js";
import { ClassicPreset as Classic } from "https://esm.sh/rete";
import { css } from "https://esm.sh/lit@2.8.0";
import { html, LitElement } from "https://esm.sh/lit@2.8.0";
import {
    ReplaySubject,
    filter,
    shareReplay,
    scan,
    map,
    switchMap,
    switchScan,
    take,
    debounceTime,
    combineLatest,
    distinctUntilChanged,
    tap,
    takeUntil,
    merge,
} from "https://esm.sh/rxjs";
import { GPT } from "./gpt.wrapped.js";
import { debug } from "./operators.js";
import { v4 as uuidv4 } from "https://esm.sh/uuid";
import { DevDefault } from "./dev-default.js";
import { CodeFrequencyTable, FrequencyTable } from "./frequency.js";
import { Custom } from "./custom.js";
// import { Puppeteer } from "./puppeteer.js";
import { classMap } from "https://esm.sh/lit/directives/class-map.js";
import { PropagationStopper } from "./mixins.js";
import { NodeMakerGPT } from "./nodeMaker.wrapped.js";
import { NextNodeElementWrapper } from "./node-element-wrapper.js";
import { getSource, generateSchemaFromValue } from "./util.js";
import { deepEqual } from "https://esm.sh/fast-equals";
import _ from "https://esm.sh/lodash";
import { Stream } from "./stream.js";
import "./flipper.js";
import "./compass.js";
import "./monaco.js";
import "./mixins.js";
import { PromptGPT } from "./prompt.wrapped.js";
import { TextAreaWidget } from "./form-textarea.js";
import { FlowInput } from "./flow-input.wrapped.js";
import { FlowOutput } from "./flow-output.wrapped.js";
import { Debug } from "./debug.wrapped.js";
import { GPTRender } from "./gpt-response.wrapped.js";

class WrenchIcon extends PropagationStopper(LitElement) {
    static get properties() {
        return {
            data: { type: Object },
            emit: { type: Function },
            iconVisible: { type: Boolean, reflect: true }, // Add reflect: true
        };
    }

    constructor() {
        super();
        this.clickHandler = this.clickHandler.bind(this);
    }

    clickHandler() {
        this.toggleIcon();
    }
    render() {
        return html`<button class="icon" @click=${this.clickHandler}>
            ${this.iconVisible ? "🔍" : "🔎"}
        </button>`;
    }

    static get styles() {
        return css`
            .button {
                width: 1rem;
                height: 1rem;
                transition: opacity 0.5s;
            }
            .icon:hover {
                opacity: 1;
            }
        `;
    }
}

customElements.define("wrench-icon", WrenchIcon);
export class Node extends LitPresets.classic.Node {
    static get properties() {
        return {
            data: { type: Object },
            emit: { type: Function },
            iconVisible: { type: Boolean, reflect: true }, // Add reflect: true
        };
    }

    nodeStyles() {
        return "";
    }

    constructor() {
        super();
        this.test = Math.random();
        this.constructedAt = Date.now();
        this.iconVisible = false;
        this.toggleIcon = this.toggleIcon.bind(this);

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
    // Add this method to your class
    toggleIcon() {
        this.iconVisible = !this.iconVisible;
        this.data.component.iconvisible = this.iconVisible;
        this.requestUpdate();
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
            this.data.component.iconvisible = this.iconVisible;
            this.data.component.toggleIcon = this.toggleIcon.bind(this);
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
                    transition: transform 1s;
                }
                :host([iconvisible]) {
                    transform: rotateY(180deg);
                }
                wrench-icon {
                    align-self: flex-end;
                    cursor: pointer;
                    transition: opacity 0.5s;
                }

                wrench-icon.rotated {
                    align-self: flex-start;
                }
                wrench-icon:hover {
                    opacity: 1;
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
        const classes = {
            node: true,
            selected: this.data?.selected,
            rotate: this.iconVisible,
        };
        const input = this.data?.inputs?.input || {};
        const output = this.data?.outputs?.output || {};
        // consol   e.log("rerender Transf  ormNode");
        return html`
            <div class=${classMap(classes)} data-testid="node">
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

                    <wrench-icon
                        .toggleIcon=${this.toggleIcon}
                        .iconVisible=${this.iconVisible}
                        class=${this.iconVisible
                            ? "rotated"
                            : ""}></wrench-icon>
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
                    ["zoomed", "translated", "editor-open"].includes(event.type)
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
        const halfWidth = box.width / 2 / k;
        const height = 0;
        return { x: halfWidth - x / k, y: height - y / k };
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
                    ["zoomed", "translated", "editor-open"].includes(event.type)
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
        const halfWidth = box.width / 2 / k;
        const height = (box.height - 30) / k;
        return { x: halfWidth - x / k, y: height - y / k };
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

export class ChatFlowInput extends LitElement {
    static styles = css`
        :host {
            display: none;
        }
    `;

    render() {
        return html`<slot></slot>`;
    }
}

customElements.define("bespeak-input-node-component", ChatFlowInput);

export class ChatFlowOutput extends LitElement {
    static styles = css`
        :host {
            display: none;
        }
    `;

    render() {
        return html`<slot></slot>`;
    }
}

customElements.define("bespeak-output-node-component", ChatFlowOutput);

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
        return this.component?.parentElement
            ? this.component.parentElement.clientWidth
            : 0;
    }

    get height() {
        return this.component?.parentElement
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

    static registerComponent(Component, force = false) {
        if (typeof Component === "string") {
            import(Component).then((module) => {
                this.components.set(module.default.name, {
                    Component: module.default,
                    file: Component,
                });
                this.onComponentsChanged?.(this.components);
            });
        } else {
            const isExisting = this.components.get(Component.name);
            if (isExisting && !force) {
                if (["Chat GPT", "Custom"].includes(Component.name)) {
                    throw new Error(
                        "You cannot overwrite a hard-coded node, you must change the name of the class"
                    );
                } else {
                    throw new Error(
                        "A node with this name already exists, do you want to overwrite it? You can change the name of the class to create a new node type."
                    );
                }
            }
            this.components.set(Component.name, {
                Component,
            });
        }

        // this.onComponentsChanged?.(this.components);
    }

    static deserialize(ide, editor, definition) {
        const node = new this(
            ide,
            editor,
            definition.Component instanceof Function
                ? definition.Component
                : this.components.get(definition.Component),
            definition.id
        );

        if (definition.initialValues && definition.initialValues.length > 0) {
            node.parameters$
                .pipe(
                    take(1),
                    tap((params) => {
                        for (const param of params) {
                            const value = definition.initialValues.find(
                                ({ type }) => type === param.type
                            )?.value;
                            if (value) {
                                param.subject.next(value);
                            }
                        }
                    })
                )
                .subscribe();
        }

        return node;
    }

    serialize() {
        return {
            id: this.id,
            Component: this.Component.name,
            selected: this.selected,
        };
    }

    constructor(ide, editor, Component, id = uuidv4()) {
        super();
        this.id = id;
        this.ide = ide;
        this.editor = editor;
        this.workspaceId = editor.id;
        this.Component = Component;

        this.addInput("input", new Classic.Input(this.socket, "input", true));
        this.addOutput("output", new Classic.Output(this.socket, "output"));

        this.inputs$ = new ReplaySubject(1);
        this.outputs$ = new ReplaySubject(1);
        this.parameters$ = new ReplaySubject(1);

        this.setupInputs();
        // this.setupGlobals();
        // this.setupParameters();
        // this.setupCleanup();
        // this.setupComponent();
    }

    setupComponent() {
        this.component = new this.Component();
        this.component._node = this;
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
                debug(this, "parameters inputs spy"),
                switchScan(async (subs, [parameters, inputs]) => {
                    for (const sub of subs) {
                        sub.unsubscribe();
                    }

                    const _subs = [];
                    for (const input of inputs) {
                        const match = parameters.find(
                            (p) => p.type === input.type
                        );
                        if (match && match.type !== "specification") {
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

export class NextReteNode extends ReteNode {
    static deserialize(ide, editor, definition) {
        const node = new this(ide, editor, undefined, definition.id);

        return node;
    }

    serialize() {
        return {
            id: this.id,
            Component: this.editorNode.customElement?.tagName,
            selected: this.selected,
        };
    }

    constructor(ide, editor, source, id = uuidv4()) {
        super(ide, editor, source, id);
        this.addInput("owners", new Classic.Input(this.socket, "owners", true));
        this.addOutput("assets", new Classic.Output(this.socket, "assets"));
        this.hydrate$ = new Stream(this, Object, "node-meta");
        this.removed$ = this.editor.events$.pipe(
            filter(
                (event) =>
                    event.type === "noderemoved" && event.data.id === this.id
            ),
            shareReplay(1)
        );

        if (source) {
            this.source = source;
        }
    }

    get width() {
        return this.editorNode.width;
    }

    get height() {
        return this.editorNode.height;
    }

    get x() {
        // center of parentElement
        const transform = window.getComputedStyle(
            this.editorNode.parentElement
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
        // center of parentElement
        const transform = window.getComputedStyle(
            this.editorNode.parentElement
        ).transform;

        // Extract the translate values from the matrix
        const matrix = transform.match(/matrix\((.+)\)/);
        if (matrix) {
            const values = matrix[1].split(", ");
            let translateY = parseFloat(values[5]);

            return translateY + this.height / 2;
        }
    }

    setupInputs() {
        this.inputsSubscription = this.editor.events$
            .pipe(
                filter(
                    (event) =>
                        event.type === "connectioncreated" ||
                        event.type === "connectionremoved"
                ),
                filter(
                    (event) =>
                        event.data?.target === this.id ||
                        event.data?.source === this.id
                ),
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
                        const node = this.editor.editor.getNode(
                            connection.source !== this.id
                                ? connection.source
                                : connection.target
                        );

                        return { node, connection };
                    });
                }),
                switchMap((nodes) =>
                    combineLatest(
                        nodes.map(({ node, connection }) =>
                            merge(
                                node.editorNode.customElement$,
                                node.editorNode.subflowEditor$
                            ).pipe(map(() => ({ node, connection })))
                        )
                    )
                )
            )
            .subscribe((nodes) => {
                this.editorNode.connectedNodes = nodes;
            });
    }
}

function transformSource(source) {
    const baseUrl = new URL(".", import.meta.url).href;
    return source.replace(
        /import\s+(.*?)?\s+from\s+['"](.*?)['"]/g,
        (match, importList, importPath) => {
            if (importPath.startsWith(".")) {
                const absoluteUrl = new URL(importPath, baseUrl).href;
                if (importList) {
                    return `import ${importList} from "${absoluteUrl}"`;
                } else {
                    return `import "${absoluteUrl}"`;
                }
            }
            return match;
        }
    );
}
export class NextLitNode extends Node {
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
        const hasChanged = (newV, oldV) => !deepEqual(newV, oldV);
        return {
            ...super.properties,
            source: { type: String },
            element: { type: Object },
            specification: { type: String },
            chat: { type: Array },
            input: { type: Object, hasChanged },
            output: { type: Object, hasChanged },
            owners: { type: Array },
            assets: { type: Array },
            error: { type: Error },
            customElement: { type: Object },
            connectedNodes: { type: Array },
            ports: { type: Array },
            inputSchema: {
                type: Object,
                hasChanged,
            },
            configSchema: {
                type: Object,
                hasChanged,
            },
            keysSchema: {
                type: Object,
                hasChanged,
            },
            config: {
                type: Object,
                hasChanged,
            },
            keys: {
                type: Object,
                hasChanged,
            },
        };
    }

    get name() {
        return this.customElement?.name;
    }

    get id() {
        return this.data.id;
    }

    get defaultConfig() {
        return this.customElement?.defaultConfig || {};
    }

    async firstUpdated() {
        await this.updateComplete;
        this.keysSchema$.next({});
        this.configSchema$.next({});
        this.keys$.next({});
        this.data.editorNode = this;
        if (this.data.source) {
            this.source = this.data.source;
        }

        this.data.hydrate$.subject
            .pipe(
                filter((value) => value && value.source),
                take(1),
                tap((value) => {
                    const {
                        source,
                        output,
                        inputSchema,
                        config,
                        keysSchema,
                        specification,
                        chat,
                    } = value;
                    if (source) {
                        this.source = source;
                    }
                    if (output) {
                        this.output = output;
                    }
                    if (inputSchema) {
                        this.inputSchema = inputSchema;
                    }
                    if (config) {
                        this.config = config;
                        this.config$.next(config);
                    } else {
                        this.config = this.defaultConfig;
                    }
                    if (keysSchema) {
                        this.keysSchema = keysSchema;
                        this.keysSchema$.next(keysSchema);
                    }
                    if (specification) {
                        this.specification = specification;
                    }
                    if (chat) {
                        this.chat = chat;
                    }
                })
            )
            .subscribe();

        this.config$
            .pipe(
                debug(this, "config spy"),
                distinctUntilChanged(deepEqual),
                takeUntil(this.data.removed$),
                tap((config) => {
                    this.config = config;
                })
            )
            .subscribe();

        this.keys$
            .pipe(
                debug(this, "keys spy"),
                distinctUntilChanged(deepEqual),
                takeUntil(this.data.removed$),
                tap((keys) => {
                    this.keys = keys;
                })
            )
            .subscribe();

        merge(
            this.output$,
            this.inputSchema$,
            this.source$,
            this.config$,
            this.specification$,
            this.chat$,
            this.customElement$,
            this.subflowEditor$
        )
            .pipe(
                debounceTime(100),
                map(() => this.serialize()),
                filter(() => this.source),
                tap(this.propagateOwnersAndAssets.bind(this)),
                takeUntil(this.data.removed$)
            )
            .subscribe(this.data.hydrate$.subject);
    }

    get selected() {
        return this.data?.selected;
    }

    constructor() {
        super();
        this.connectedNodes = [];
        this.owners = [];
        this.assets = [];
        this.chat = [];

        this.output$ = new ReplaySubject(1);
        this.error$ = new ReplaySubject(1);
        this.specification$ = new ReplaySubject(1);
        this.chat$ = new ReplaySubject(1);
        this.owners$ = new ReplaySubject(1);
        this.source$ = new ReplaySubject(1);
        this.keys$ = new ReplaySubject(1);
        this.config$ = new ReplaySubject(1);
        this.inputSchema$ = new ReplaySubject(1);
        this.configSchema$ = new ReplaySubject(1);
        this.keysSchema$ = new ReplaySubject(1);
        this.customElement$ = new ReplaySubject(1);
        this.subflowEditor$ = new ReplaySubject(1);
    }

    serialize() {
        return {
            node: this.id,
            source: this.source,
            output: this.output,
            specification: this.specification,
            chat: this.chat,
            inputSchema: this.inputSchema,
            config: this.config,
            keysSchema: this.keysSchema,
        };
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        if (this.element) {
            this.element.input = this.input;
            // this.element.inputSchema = this.inputSchema;
            this.element.owners = this.owners;
            this.element.assets = this.assets;
            this.element.config = this.config;
            this.element.keys = this.keys;
            this.element.output = this.output || this.element.output;
            this.element.specification = this.specification;
            this.element.chat = this.chat;
        }

        if (
            !changedProperties.has("owners") &&
            !changedProperties.has("assets")
        ) {
            this.propagateOwnersAndAssets();
        }

        if (changedProperties.has("error")) {
            console.error(this.error);
            this.error$.next(this.error);
        }

        if (changedProperties.has("specification") && this.specification) {
            this.specification$.next(this.specification);
        }

        if (changedProperties.has("chat")) {
            this.chat$.next(this.chat);
        }

        if (changedProperties.has("output")) {
            this.output$.next(this.output || {});
        }

        if (changedProperties.has("source")) {
            this.source$.next(this.source);
            this.updateElement();
        }

        if (changedProperties.has("inputSchema")) {
            this.inputSchema$.next(this.inputSchema);
        }

        if (changedProperties.has("customElement")) {
            this.customElement$.next(this.customElement);
        }

        if (changedProperties.has("connectedNodes")) {
            if (this.connectedNodes) {
                this.assets = this.connectedNodes
                    .filter(
                        ({ connection: { source, sourceOutput } }) =>
                            source === this.id && sourceOutput === "assets"
                    )
                    .map(({ node }) => node.editorNode.element);

                this.owners = this.connectedNodes
                    .filter(
                        ({
                            connection: { target, targetInput, sourceOutput },
                        }) => target === this.id && sourceOutput === "assets"
                    )
                    .map(({ node }) => node.editorNode.element);

                setTimeout(this.propagateOwnersAndAssets.bind(this), 100);

                if (this.inputSubscription) {
                    this.inputSubscription.unsubscribe();
                }
                const inputs = this.connectedNodes.filter(
                    ({ connection: { target, targetInput } }) =>
                        target === this.id && targetInput === "input"
                );

                if (inputs.length) {
                    // TODO this may lock if an upstream node never provides output
                    this.inputSubscription = combineLatest(
                        inputs
                            .sort((a, b) => a.node.id.localeCompare(b.node.id))
                            .map(({ node }) => node.editorNode.output$)
                    )
                        .pipe(map(this.deepMerge))
                        .subscribe((data) => {
                            this.input = data;
                            this.inputSchema = generateSchemaFromValue(data);

                            if (this.subflowEditor) {
                                const inputNode =
                                    this.subflowEditor.getInputNode();

                                if (inputNode) {
                                    inputNode.editorNode.output = data;
                                    // inputNode.editorNode.inputSchema = this.inputSchema;
                                }
                            }
                        });
                } else {
                    this.input = {};
                    this.inputSchema = {
                        type: "object",
                        additionalProperties: true,
                    };
                }
                this.requestUpdate();
            }
        }

        if (changedProperties.has("configSchema") && this.configSchema) {
            this.configSchema$.next(this.configSchema);
        }

        if (changedProperties.has("keysSchema") && this.keysSchema) {
            this.keysSchema$.next(this.keysSchema);
        }
    }

    propagateOwnersAndAssets() {
        this.owners.forEach((owner) => {
            owner.assets = Array.from(owner.assets);
        });

        this.assets.forEach((asset) => {
            asset.owners = Array.from(asset.owners);
        });
    }

    deepMerge(objects) {
        return _.mergeWith({}, ...objects, (objValue, srcValue) => {
            if (!objValue) {
                return srcValue;
            }

            if (objValue instanceof Set) {
                objValue.add(srcValue);
            } else {
                return new Set([objValue, srcValue]);
            }
        });
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
                this.data.editor.area.resize(
                    this.data.id,
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

                    this.data.editor.area.translate(this.data.id, {
                        x: translateX,
                        y: translateY,
                    });
                }
            }
        });

        // Start observing the current element
        this.resizeObserver.observe(
            this.shadowRoot.querySelector("bespeak-compass")
        );
    }

    disconnectedCallback() {
        super.disconnectedCallback();

        // Stop observing when the element is disconnected
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
    }

    nodeStyles() {
        return "";
    }

    async updateWorkspaceElement(sourceCode) {
        const editor = (this.subflowEditor =
            this.shadowRoot.querySelector("bespeak-editor"));

        this.subflowSubscriptions?.forEach((sub) => sub.unsubscribe());

        editor.events$
            .pipe(
                filter(({ type }) => type === "hydrated"),
                take(1),
                switchMap(() => {
                    const nodes = editor.editor.getNodes();
                    return combineLatest(
                        ...nodes.map((node) =>
                            merge(
                                node.editorNode.customElement$,
                                node.editorNode.subflowEditor$
                            ).pipe(map(() => node))
                        )
                    );
                }),
                tap((nodes) => {
                    const connections = editor.editor.getConnections();
                    let ports = [];
                    const output = nodes.find(
                        (node) =>
                            node.editorNode.customElement?.tagName ===
                            "flow-output"
                    );

                    if (output) {
                        ports.push("output");

                        // const outputConnections = connections.filter(
                        //     (c) => (c.target = output.id)
                        // );

                        // const outputElements = outputConnections
                        //     .map((c) => c.source)
                        //     .map((id) => editor.editor.getNode(id))
                        //     .map((node) => node.editorNode.element)
                        //     .filter((e) => e);

                        // this.shadowRoot
                        //     .querySelector(".container")
                        //     .replaceChildren(...outputElements);
                    }

                    const input = nodes.find(
                        (node) =>
                            node.editorNode.customElement?.tagName ===
                            "flow-input"
                    );

                    if (input) {
                        ports.push("input");
                    }

                    if (input && output) {
                        const icon = document.createElement("fa-icon");
                        icon.size = "5rem";
                        icon.icon = output.editorNode.config.icon;
                        input.editorNode.output$
                            .pipe(takeUntil(this.data.removed$))
                            .subscribe((data) => {
                                icon.animation = "spin-y";
                            });

                        output.editorNode.output$
                            .pipe(takeUntil(this.data.removed$))
                            .subscribe((data) => {
                                icon.animation = "";
                            });

                        this.shadowRoot
                            .querySelector(".container")
                            .replaceChildren(icon);
                    }

                    const assets = nodes.find(
                        (node) =>
                            node.editorNode.customElement?.tagName ===
                            "flow-assets"
                    );

                    if (assets) {
                        ports.push("assets");
                    }

                    const owners = nodes.find(
                        (node) =>
                            node.editorNode.customElement?.tagName ===
                            "flow-owners"
                    );

                    if (owners) {
                        ports.push("owners");
                    }

                    this.ports = ports;

                    this.subflowSubscriptions = [
                        output.editorNode.output$.subscribe((output) => {
                            this.output = output;
                        }),
                    ];
                })
            )
            .subscribe(this.subflowEditor$);
    }

    async updateElement() {
        // Get the source code from the editor
        const sourceCode = this.source;

        if (sourceCode.startsWith("workspace:")) {
            return this.updateWorkspaceElement(sourceCode);
        }
        this.lastUpdated = Date.now();

        // Transform the source code to handle relative imports
        const transformedSource = transformSource(sourceCode);

        if (transformedSource === (await this.element?.quine?.())) {
            return;
        }
        // Create a blob from the transformed source code
        const blob = new Blob([transformedSource], {
            type: "text/javascript",
        });

        // Create a URL for the blob
        const blobUrl = URL.createObjectURL(blob);

        // Generate a random hex nonce
        const nonce = Math.floor(Math.random() * 0xfffff).toString(16);

        // Import the module from the blob URL
        const module = await import(blobUrl).catch((error) => {
            this.error = error;
            if (this.element) {
                this.element.error = error;
            }
            return null;
        });

        if (!module) {
            return;
        }
        // Create the custom element
        this.customElement = NextNodeElementWrapper(
            this,
            module.default,
            getSource(blobUrl),
            blobUrl
        );

        this.keysSchema = this.customElement.keys;
        this.configSchema = this.customElement.config;
        // Define the custom element
        customElements.define(
            `bespeak-custom-${this.customElement.tagName}-${this.data.id}-${nonce}`,
            this.customElement
        );

        // Attach the custom element
        this.element = new this.customElement(this.id);
        this.ports = this.element.ports;
        this.element.source = sourceCode;
        this.shadowRoot
            .querySelector(".container")
            .replaceChildren(this.element);
    }

    async onToggle(face) {
        const editor = this.shadowRoot.querySelector("bespeak-monaco-editor");
        if (face === "front") {
            this.source = editor.getValue();
            editor.visible = false;
        } else {
            editor.visible = true;
        }
    }

    render() {
        const owners = this.data?.inputs?.parents || {};
        const assets = this.data?.outputs?.assets || {};
        const input = this.data?.inputs?.input || {};
        const output = this.data?.outputs?.output || {};

        return html`
            <div class="tracker" @click=${() => console.log("tracker click")}>
                <bespeak-compass>
                    ${this.ports?.includes("input")
                        ? html`<div slot="north">
                              ${html`<ref-element
                                  class="input-socket"
                                  .data=${{
                                      type: "socket",
                                      side: "input",
                                      key: input.label,
                                      nodeId: this.data?.id,
                                      payload: input.socket,
                                  }}
                                  .emit=${this.emit}
                                  data-testid="input-socket"></ref-element>`}
                          </div>`
                        : ""}
                    ${this.ports?.includes("output")
                        ? html`<div slot="south">
                              ${html`<ref-element
                                  class="output-socket"
                                  .data=${{
                                      type: "socket",
                                      side: "output",
                                      key: output.label,
                                      nodeId: this.data?.id,
                                      payload: output.socket,
                                  }}
                                  .emit=${this.emit}
                                  data-testid="output-socket"></ref-element>`}
                          </div>`
                        : ""}
                    ${this.ports?.includes("assets")
                        ? html`<div slot="east">
                              ${html`<ref-element
                                  class="output-socket"
                                  .data=${{
                                      type: "socket",
                                      side: "output",
                                      key: assets.label,
                                      nodeId: this.data?.id,
                                      payload: assets.socket,
                                  }}
                                  .emit=${this.emit}
                                  data-testid="output-socket"></ref-element>`}
                          </div>`
                        : ""}
                    ${this.ports?.includes("owners")
                        ? html`<div slot="west">
                              ${html`<ref-element
                                  class="input-socket"
                                  .data=${{
                                      type: "socket",
                                      side: "input",
                                      key: owners.label,
                                      nodeId: this.data?.id,
                                      payload: owners.socket,
                                  }}
                                  .emit=${this.emit}
                                  data-testid="output-socket"></ref-element>`}
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
                            <div slot="back" style="padding: 1.5rem">
                                <bespeak-form
                                    .props=${{
                                        schema: {
                                            type: "object",
                                            properties: {
                                                value: {
                                                    type: "string",
                                                    title: "Specification",
                                                },
                                            },
                                        },
                                        uiSchema: {
                                            value: {
                                                "ui:widget": "textarea",
                                                "ui:options": {
                                                    label: "Specification",
                                                },
                                            },
                                        },
                                        formData: { value: this.specification },
                                    }}
                                    .onChange=${(e) => {
                                        this.specification = e.formData.value;
                                    }}></bespeak-form>
                                ${this.source?.startsWith("workspace:")
                                    ? html`<bespeak-editor
                                          .ide=${this.data.ide}
                                          .open=${true}
                                          .id=${this.source
                                              .split(":")
                                              .pop()}></bespeak-editor>`
                                    : html`<bespeak-monaco-editor
                                          .value=${this
                                              .source}></bespeak-monaco-editor>`}
                            </div>
                        </bespeak-flipper>
                    </div>
                </bespeak-compass>
            </div>
        `;
    }
}

customElements.define("bespeak-next-node", NextLitNode);

// NextReteNode.registerComponent(PromptGPT);
// NextReteNode.registerComponent(GPT);
// NextReteNode.registerComponent(GPTRender);
// // NextReteNode.registerComponent(NodeMakerGPT);
// NextReteNode.registerComponent(FlowInput);
// NextReteNode.registerComponent(FlowOutput);
// NextReteNode.registerComponent(Debug);

NextReteNode.registerComponent("./gpt.child.js");
NextReteNode.registerComponent("./gpt-response.child.js");
NextReteNode.registerComponent("./prompt.child.js");
