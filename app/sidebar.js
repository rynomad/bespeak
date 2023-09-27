import { html, css, LitElement } from "https://esm.sh/lit@2.0.2";
import {
    Subject,
    switchMap,
    filter,
    scan,
    tap,
    switchScan,
    combineLatest,
    distinctUntilChanged,
    withLatestFrom,
    merge,
} from "https://esm.sh/rxjs@7.3.0";
import "./tabs.js";
import "./yaml.js";
import "./form.js";
import { debug } from "./operators.js";

import "https://esm.sh/@dile/dile-pages/dile-pages.js";
import "https://esm.sh/@dile/dile-tabs/dile-tabs.js";
class MySidebar extends LitElement {
    static get properties() {
        return {
            ide: { type: Object },
            id: { type: String },
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
        this.parameters$ = new Subject();
        this.inputs$ = new Subject();
        this.outputs$ = new Subject();
        this.hide();
    }

    async connectedCallback() {
        super.connectedCallback();

        this.addEventListener("mouseover", () => (this.mouseInSidebar = true));
        this.addEventListener("mouseout", () => (this.mouseInSidebar = false));

        await this.updateComplete;
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

                switchScan(async (acc, [event, { editor, devEditor }]) => {
                    let target = null;
                    let hide = true;
                    if (event.type === "chat-focus") {
                        target = devEditor.findConfigurable();
                    } else if (event.type === "chat-blur") {
                        target = editor.selected();
                    } else {
                        target = event.data;
                    }

                    if (target) {
                        acc.forEach((sub) => sub.unsubscribe());
                        acc = [
                            target.parameters$.subscribe(this.parameters$),
                            target.inputs$.subscribe(this.inputs$),
                            target.outputs$.subscribe(this.outputs$),
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

        this.parameters$
            .pipe(
                debug(this, "sidebar parameters spy"),
                tap((streams) => {
                    this.globals = streams.filter(({ global }) => global);
                    this.config = streams.filter(
                        ({ type }) => type === "config"
                    );
                })
            )
            .subscribe();

        // combineLatest(this.inputs$, this.outputs$)
        //     .pipe(
        //         debug(this, "sidebar io spy"),
        //         switchMap(([inputs, outputs]) => {
        //             const inputValues = inputs.map((stream) =>
        //                 stream.subject.pipe((data) => {
        //                     stream.data = data;
        //                     return stream;
        //                 })
        //             );

        //             const outputValues = outputs.map((stream) =>
        //                 stream.subject.pipe((data) => {
        //                     stream.data = data;
        //                     return stream;
        //                 })
        //             );
        //             return combineLatest(
        //                 combineLatest(...inputValues),
        //                 combineLatest(...outputValues)
        //             );
        //         }),
        //         tap(([inputs, outputs]) => {
        //             this.data = {
        //                 inputs: inputs.reduce((acc, [stream]) => {
        //                     acc[stream.label || stream.name] = {
        //                         description: stream.description,
        //                         data: stream.data,
        //                     };
        //                     return acc;
        //                 }, {}),
        //                 outputs: outputs.reduce((acc, [stream]) => {
        //                     acc[stream.label || stream.name] = {
        //                         description: stream.description,
        //                         data: stream.data,
        //                     };
        //                     return acc;
        //                 }, {}),
        //             };

        //             this.requestUpdate();
        //         })
        //     )
        //     .subscribe();
    }

    // updated(changedProperties) {
    //     if (changedProperties.has("ide")) {
    //         this.ideSubscription?.unsubscribe();
    //         this.ideSubscription = this.ide
    //             .pipe(

    get tabs() {
        return ["Config", "Global"];
    }

    get openTab() {
        return this.tabs[this.activeTabIndex] || "Global";
    }

    get configOpen() {
        return this.activeTabIndex === 0;
    }

    get globalOpen() {
        return this.activeTabIndex === 1;
    }

    get debugOpen() {
        return this.activeTabIndex === 2;
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
                        ${this.config?.map(
                            (entry) =>
                                html`<div>${entry.node.id}</div>
                                    <bespeak-form
                                        nodeId=${entry.node.id}
                                        .props=${entry}></bespeak-form>`
                        )}
                    </div>
                    <div name="Global">
                        ${this.globals?.map(
                            (entry) =>
                                html`<bespeak-form
                                    nodeId=${entry.node.id}
                                    .props=${entry}></bespeak-form>`
                        )}
                    </div>
                </dile-pages>
            </div>
        `;
    }
}

customElements.define("bespeak-sidebar", MySidebar);
