import { LitElement, html, css } from "https://esm.sh/lit@2.0.1";
import { merge, tap } from "https://esm.sh/rxjs";
import { debug } from "./operators.js";

import "./pills.js";

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
    render() {
        return html`
            <bespeak-list>
                <slot></slot>
            </bespeak-list>
        `;
    }
}

customElements.define("bespeak-node-list", BespeakNodeList);
