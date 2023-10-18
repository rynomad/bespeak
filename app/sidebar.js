import { html, css, LitElement } from "https://esm.sh/lit@2.8.0";
import { repeat } from "https://esm.sh/lit/directives/repeat.js";
import {
    Subject,
    switchMap,
    filter,
    scan,
    tap,
    debounceTime,
    combineLatest,
    distinctUntilChanged,
    withLatestFrom,
    merge,
    map,
    take,
} from "https://esm.sh/rxjs@7.3.0";
import { Stream } from "./stream.js";
import { deepEqual } from "https://esm.sh/fast-equals";
import "./tabs.js";
import "./yaml.js";
import "./form.js";
import { debug } from "./operators.js";
import { Types } from "./types.js";

import "https://esm.sh/@dile/dile-pages/dile-pages.js";
import "https://esm.sh/@dile/dile-tabs/dile-tabs.js";
import { NextReteNode } from "./node.js";
class MySidebar extends LitElement {
    static get properties() {
        return {
            ide: { type: Object },
            id: { type: String },
            config: { type: Object, hasChanged: (n, o) => !deepEqual(o, n) },
            configSchema: {
                type: Object,
                hasChanged: (n, o) => !deepEqual(o, n),
            },
            keyNodes: { type: Array },
            target: { type: Object },
        };
    }
    static styles = css`
        :host {
            display: block;
            right: 0;
            top: 0;
            min-width: 27rem;
            max-width: 27rem;
            height: 100%;
            z-index: 999;
            background-color: #fff;
            box-shadow: 0 0 1rem rgba(0, 0, 0, 0.1);
            overflow-y: auto;
            position: relative;
        }

        #overlay {
            transition: opacity 0.3s ease-in-out;
        }

        #overlay.hidden {

            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            opacity: 0
            opacity: 0;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 998;
            pointer-events: none;
        }

        md-tabs {
            height: calc(
                100% - 4rem
            ); /* Subtract the height of the tabs from the sidebar height */
        }

        .content {
            padding: 1rem;
            height: 100%;
            overflow-y: auto; /* Add overflow-y to the content to create a scrollbar within the sidebar */
        }
    `;

    show() {
        return new Promise((resolve) => {
            if (!this.shadowRoot) resolve();
            let overlay = this.shadowRoot.querySelector("#overlay");
            if (!overlay.classList.contains("hidden")) {
                resolve();
                return;
            }
            overlay.classList.remove("hidden");
            overlay.addEventListener("transitionend", () => resolve(), {
                once: true,
            });
        });
    }

    hide() {
        return new Promise((resolve) => {
            if (!this.shadowRoot) resolve();
            let overlay = this.shadowRoot.querySelector("#overlay");
            if (overlay.classList.contains("hidden")) {
                resolve();
                return;
            }
            overlay.classList.add("hidden");
            overlay.addEventListener("transitionend", () => resolve(), {
                once: true,
            });
        });
    }
    constructor() {
        super();
        this.editor$ = new Subject();
        this.configSchema$ = new Subject();
        this.config$ = new Subject();
        this.inputs$ = new Subject();
        this.outputs$ = new Subject();
        this.types = Types;
        this.keyNodes = [];
        this.hide();
    }

    updated(changedProperties) {
        if (changedProperties.has("config")) {
            this.config$.next(this.config);
        }
    }

    async connectedCallback() {
        super.connectedCallback();
        Types.onChange = () => {
            this.requestUpdate();
        };
        this.addEventListener("mouseover", () => (this.mouseInSidebar = true));
        this.addEventListener("mouseout", () => (this.mouseInSidebar = false));

        await this.updateComplete;

        let nodesList = [];

        this.editor$
            .pipe(
                switchMap(({ editor, devEditor }) => editor.events$),
                filter(
                    (event) =>
                        event.type === "saved" || event.type === "hydrated"
                ),
                withLatestFrom(this.editor$),
                debounceTime(200),
                switchMap(([_, { editor }]) => {
                    const nodes = editor.editor
                        .getNodes()
                        .filter((n) => n instanceof NextReteNode);

                    return combineLatest(
                        nodes.map((n) =>
                            n.editorNode.customElement$.pipe(map((data) => n))
                        )
                    );
                }),
                switchMap((nodes) => {
                    nodesList = nodes;
                    const unique = new Map();
                    nodes
                        .filter((node) => node.editorNode.name)
                        .forEach((node) => {
                            unique.set(node.editorNode.name, node);
                        });

                    this.keySchemaNodes = Array.from(unique.values());
                    return combineLatest(
                        this.keySchemaNodes.map((n) =>
                            n.editorNode.keysSchema$.pipe(
                                withLatestFrom(n.editorNode.keys$),
                                map(([schema, keys]) => ({
                                    node: n,
                                    schema,
                                    keys,
                                    stream: new Stream(
                                        {
                                            ...n,
                                            db: n.db,
                                            id: "keys-",
                                        },
                                        { schema, name: n.editorNode.name }
                                    ),
                                }))
                            )
                        )
                    );
                }),
                tap((nodes) => {
                    this.keyNodes = nodes;
                }),
                scan((acc, nodes) => {
                    acc.forEach((sub) => sub.unsubscribe());
                    acc = nodes.map((node) =>
                        node.stream.subject.subscribe((keys) => {
                            nodesList
                                .filter(
                                    (n) =>
                                        n.editorNode.name ===
                                        node.node.editorNode.name
                                )
                                .forEach((n) => n.editorNode.keys$.next(keys));
                            node.keys = keys;
                            this.keyNodes = [...this.keyNodes];
                        })
                    );
                    return acc;
                }, [])
            )
            .subscribe();

        this.editor$
            .pipe(
                switchMap(({ editor, devEditor }) =>
                    merge(editor.events$, devEditor.events$)
                ),
                filter((event) =>
                    [
                        "chat-focus",
                        "chat-blur",
                        "custom-node-selected",
                        "node-selected",
                    ].some((type) => event.type === type)
                ),
                filter(() => !this.mouseInSidebar),
                withLatestFrom(this.editor$),

                scan((acc, [event, { editor, devEditor }]) => {
                    let target = null;
                    let hide = true;
                    if (event.type === "chat-focus") {
                        target = devEditor.selected();
                    } else if (event.type === "chat-blur") {
                        target = editor.selected();
                    } else {
                        target = event.data;
                    }

                    this.target = target;
                    if (target && target.editorNode.configSchema$) {
                        acc.forEach((sub) => sub.unsubscribe());
                        acc = [
                            target.editorNode.configSchema$.subscribe(
                                this.configSchema$
                            ),
                            target.editorNode.config$
                                .pipe(take(1))
                                .subscribe((config) =>
                                    this.config$.next(config)
                                ),

                            this.config$
                                .pipe(distinctUntilChanged())
                                .subscribe((config) =>
                                    target.editorNode.config$.next(config)
                                ),
                        ];
                        this.show();
                        this.requestUpdate();
                    } else {
                        acc = [];
                        this.hide();
                    }
                    return acc;
                }, [])
            )
            .subscribe();

        this.configSchema$
            .pipe(
                distinctUntilChanged(),
                debug(this, "sidebar parameters spy"),
                tap((schema) => {
                    this.configSchema = schema;
                })
            )
            .subscribe();

        this.config$
            .pipe(
                distinctUntilChanged(),
                debug(this, "sidebar config spy"),
                tap((config) => {
                    this.config = config;
                })
            )
            .subscribe();
    }

    get tabs() {
        return ["Config", "Keys"];
    }

    get openTab() {
        return this.tabs[this.activeTabIndex] || "Config";
    }

    render() {
        return html`
            <div
                id="overlay"
                class="${this.classList.contains("hidden")
                    ? "hidden"
                    : ""}"></div>
            <div class="content">
                <!-- Render the data as JSON for demonstration -->
                <dile-tabs
                    id="select2"
                    attrForSelected="name"
                    selectorId="selector"
                    selected="${this.openTab}">
                    ${this.tabs.map(
                        (label, index) => html`
                            <dile-tab
                                icon="label_important"
                                name=${label}
                                ${this.activeTabIndex === index ? "active" : ""}
                                >${label}</dile-tab
                            >
                        `
                    )}
                </dile-tabs>
                <dile-pages
                    attrForSelected="name"
                    selectorId="selector"
                    selected="${this.openTab}">
                    <div name="Config">
                        <div>${this.target?.id}</div>
                        <bespeak-form
                            nodeId=${this.target?.id}
                            .onChange=${(event) => {
                                this.config = event.formData;
                            }}
                            .props=${{
                                name: this.target?.editorNode?.name,
                                schema: this.configSchema || {},
                                formData: this.config || {},
                            }}></bespeak-form>
                    </div>
                    <div name="Keys">
                        ${repeat(
                            this.keyNodes.filter(
                                ({ schema }) => schema?.properties
                            ),
                            ({ stream }) => stream.node.id,
                            ({
                                node,
                                schema,
                                keys,
                                stream,
                            }) => html`<bespeak-form
                                nodeId=${this.target?.id}
                                .onChange=${(event) => {
                                    node.editorNode.keys$.next(event.formData);
                                    stream.subject.next(event.formData);
                                }}
                                .props=${{
                                    name: node.editorNode?.name,
                                    schema,
                                    uiSchema: Object.keys(
                                        schema.properties || {}
                                    ).reduce((uiSchema, key) => {
                                        uiSchema[key] = {
                                            "ui:widget": "password",
                                        };
                                        return uiSchema;
                                    }, {}),
                                    formData: stream.formData || keys,
                                }}></bespeak-form>`
                        )}
                    </div>
                </dile-pages>
            </div>
        `;
    }
}

customElements.define("bespeak-sidebar", MySidebar);
