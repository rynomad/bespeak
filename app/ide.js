// Import LitElement and html helper function
import { LitElement, html, css } from "https://esm.sh/lit@2.8.0";
import { v4 as uuid } from "https://esm.sh/uuid";
import { BehaviorSubject } from "https://esm.sh/rxjs";

import "./stream-renderer.js";
import "./chat.js";
import "./db.js";
import "./workspace.js";
import "./pallet.js";
import "./icons/fa.js";
class IDEElement extends LitElement {
    static get styles() {
        return css`
            :host {
                display: flex;
                height: 100vh;
                width: 100vw;
            }
            bespeak-pallet {
                flex: 1;
                max-width: 300px;
                overflow: auto;
            }
            bespeak-workspace {
                flex: 3;
            }
        `;
    }

    static get properties() {
        return {
            activeWorkspace: { type: String },
        };
    }

    workspaces$ = new BehaviorSubject([]);
    activeWorkspace$ = new BehaviorSubject(null);

    get db() {
        const dbElement = this.shadowRoot.querySelector("bespeak-db");
        return dbElement ? dbElement : null;
    }

    constructor() {
        super();
        this.activeWorkspace = null;
        this.newWorkspace = this.newWorkspace.bind(this);
        this.deleteWorkspace = this.deleteWorkspace.bind(this);

        window.ide = this;
    }

    async connectedCallback() {
        super.connectedCallback();
        await this.updateComplete;
        const workspaces = (await this.db.getAll("workspaces")).filter(
            ({ id }) => !id.endsWith("dev")
        );
        this.workspaces$.next(workspaces);
        if (workspaces.length > 0) {
            this.loadWorkspace(workspaces[0].id);
        } else {
            this.newWorkspace();
        }
    }

    async newWorkspace() {
        const workspace = {
            id: uuid(),
            name: "New Canvas",
            nodes: [],
            connections: [],
        };
        await this.db.put("workspaces", workspace);
        this.workspaces$.next(await this.db.getAll("workspaces"));
        this.loadWorkspace(workspace.id);
    }

    async saveWorkspace(workspace) {
        await this.db.put("workspaces", workspace);
        this.workspaces$.next(await this.db.getAll("workspaces"));
    }

    async loadWorkspace(id) {
        this.activeWorkspace = id;
        this.activeWorkspace$.next(id);
        this.requestUpdate();
    }

    async deleteWorkspace(id) {
        await this.db.delete("workspaces", id);
        const workspaces = await this.db.getAll("workspaces");
        this.workspaces$.next(workspaces);
        if (this.activeWorkspace === id) {
            if (workspaces.length > 0) {
                this.loadWorkspace(workspaces[0].id);
            } else {
                this.newWorkspace();
            }
        }
    }

    updated(changedProperties) {
        if (changedProperties.has("activeWorkspace")) {
            this.requestUpdate();
        }
    }

    getCanvasById(id) {
        return this.canvasCache[id] ? this.canvasCache[id].canvas : null;
    }

    render() {
        return html`
            <bespeak-db></bespeak-db>
            <bespeak-pallet .ide=${this}></bespeak-pallet>
            <bespeak-workspace
                .ide=${this}></bespeak-canvas>
        `;
    }
}

// Define the new element
customElements.define("bespeak-ide", IDEElement);
