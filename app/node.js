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
import "./flipper.js";
import "./compass.js";
import "./monaco.js";
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

    static registerComponent(Component, force = false) {
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
        this.components.set(Component.name, Component);
        this.onComponentsChanged?.(this.components);
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
        // this.setupParameters();
        this.setupCleanup();
        this.setupComponent();
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

export class NextReteNode extends ReteNode {
    constructor(ide, editor, Component = GPT, id = uuidv4()) {
        super(ide, editor, Component, id);
        this.addInput("parent", new Classic.Input(this.socket, "parent"));
        this.addOutput("child", new Classic.Output(this.socket, "child"));
    }
}

export class NextLitNode extends Node {
    static get styles() {
        return css`
            :host {
            }
            .tracker {
                position: relative;
            }
            bespeak-compass {
                position: absolute;
            }
        `;
    }
    async firstUpdated() {
        await this.updateComplete;

        this.data.editorNode = this;
    }

    // ...

    async connectedCallback() {
        super.connectedCallback();
        await this.updateComplete;
        // Create a ResizeObserver instance
        this.resizeObserver = new ResizeObserver((entries) => {
            for (let entry of entries) {
                // Get the previous width and height
                console.log(
                    entry,
                    entry.contentRect.width,
                    entry.contentRect.height
                );
                const prevWidth = this.parentElement.clientWidth;
                const prevHeight = this.parentElement.clientHeight;
                // this.shadowRoot.querySelector(".tracker").style.width =
                //     entry.contentRect.width + "px";
                // this.shadowRoot.querySelector(".tracker").style.height =
                //     entry.contentRect.height + "px";
                this.data.editor.area.resize(
                    this.data.id,
                    entry.contentRect.width,
                    entry.contentRect.height
                );

                // Set the parent element's width and height to match the observed element
                this.parentElement.style.width = `${entry.contentRect.width}px`;
                this.parentElement.style.height = `${entry.contentRect.height}px`;

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
                    // Update the transform style
                    this.parentElement.style.transform = `translate(${translateX}px, ${translateY}px)`;
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

    render() {
        const parents = this.data?.inputs?.parent || {};
        const children = this.data?.outputs?.child || {};
        const input = this.data?.inputs?.input || {};
        const output = this.data?.outputs?.output || {};

        return html`
            <div class="tracker">
                <bespeak-compass>
                    <div slot="north">
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
                    </div>
                    <div slot="south">
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
                    </div>
                    <div slot="east">
                        ${html`<ref-element
                            class="output-socket"
                            .data=${{
                                type: "socket",
                                side: "output",
                                key: children.label,
                                nodeId: this.data?.id,
                                payload: children.socket,
                            }}
                            .emit=${this.emit}
                            data-testid="output-socket"></ref-element>`}
                    </div>
                    <div slot="west">
                        ${html`<ref-element
                            class="input-socket"
                            .data=${{
                                type: "socket",
                                side: "input",
                                key: parents.label,
                                nodeId: this.data?.id,
                                payload: parents.socket,
                            }}
                            .emit=${this.emit}
                            data-testid="output-socket"></ref-element>`}
                    </div>
                    <div>
                        <bespeak-flipper class="front">
                            <div
                                slot="front"
                                style="width: 300px; height: 600px; background-color: green; padding: 1rem;">
                                Front
                            </div>
                            <div slot="back" style="padding: 1rem">
                                <bespeak-monaco-editor></bespeak-monaco-editor>
                            </div>
                        </bespeak-flipper>
                    </div>
                </bespeak-compass>
            </div>
        `;
    }
}

customElements.define("bespeak-next-node", NextLitNode);

ReteNode.registerComponent(GPT);
ReteNode.registerComponent(ChatFlowInput);
ReteNode.registerComponent(ChatFlowOutput);
ReteNode.registerComponent(DevDefault);
// ReteNode.registerComponent(FrequencyTable);
// ReteNode.registerComponent(CodeFrequencyTable);
ReteNode.registerComponent(Custom);
ReteNode.registerComponent(NodeMakerGPT);
// ReteNode.registerComponent(Puppeteer);
