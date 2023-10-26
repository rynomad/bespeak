import { LitElement, html, css } from "https://esm.sh/lit@2.8.0";
import { merge, tap, map } from "https://esm.sh/rxjs";
import { debug } from "./operators.js";
import { ChatFlowInput, ChatFlowOutput, ReteNode } from "./node.js";

import "./pills.js";
import { DevDefault } from "./dev-default.js";

class BespeakList extends LitElement {
    static styles = css`
        :host {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
        }
    `;

    render() {
        return html`<slot></slot>`;
    }
}

customElements.define("bespeak-list", BespeakList);

class BespeakWorkspaceList extends LitElement {
    static properties = {
        ide: { type: Object },
    };

    async connectedCallback() {
        super.connectedCallback();
        await this.updateComplete;
        this.subscriptions = merge(
            this.ide.workspaces$.pipe(
                debug(this, "workspaces"),
                tap((result) => {
                    this.workspaces = result;
                    this.requestUpdate();
                })
            ),
            this.ide.activeWorkspace$.pipe(
                debug(this, "activeWorkspace"),
                tap((id) => {
                    this.activeWorkspace = id;
                    this.requestUpdate();
                })
            )
        ).subscribe();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.subscriptions.unsubscribe();
    }

    render() {
        return html`
            <bespeak-list>
                <slot></slot>
                ${this.workspaces
                    ?.filter(({ id }) => !id.endsWith("dev"))
                    .map(
                        (workspace) =>
                            html`<bespeak-workspace-pill
                                .workspace=${workspace}
                                .active=${this.activeWorkspace === workspace.id}
                                .ide=${this.ide}></bespeak-workspace-pill>`
                    )}
            </bespeak-list>
        `;
    }
}
customElements.define("bespeak-workspace-list", BespeakWorkspaceList);

class BespeakNodeList extends LitElement {
    static properties = {
        components: { type: Array },
        workspaces: { type: Array },
        ide: { type: Object },
    };

    constructor() {
        super();
        this.components = Array.from(ReteNode.components.values())
            .filter(
                (component) =>
                    ![ChatFlowInput, ChatFlowOutput, DevDefault].includes(
                        component.Component
                    )
            )
            .map(({ Component }) => Component);

        ReteNode.onComponentsChanged = (components) => {
            this.components = Array.from(components.values()).filter(
                (component) =>
                    ![ChatFlowInput, ChatFlowOutput, DevDefault].includes(
                        component
                    )
            );
            this.requestUpdate();
        };
    }

    connectedCallback() {
        super.connectedCallback();
        this.ide?.workspaces$
            .pipe(
                map((workspaces) =>
                    workspaces.filter(({ nodes }) =>
                        nodes.some((node) =>
                            [
                                "flow-input",
                                "flow-output",
                                "flow-owners",
                                "flow-assets",
                            ].some((name) => name === node.Component)
                        )
                    )
                )
            )
            .subscribe((workspaces) => {
                this.workspaces = workspaces;
            });
    }

    render() {
        return html`
            <bespeak-list>
                <slot></slot>
                ${this.components.map(
                    ({ Component }) =>
                        html`<bespeak-node-pill
                            .component=${Component}></bespeak-node-pill>`
                )}
                ${this.workspaces?.map(
                    (workspace) =>
                        html`<bespeak-node-pill
                            .workspace=${workspace}></bespeak-node-pill>`
                )}
            </bespeak-list>
        `;
    }
}

customElements.define("bespeak-node-list", BespeakNodeList);
