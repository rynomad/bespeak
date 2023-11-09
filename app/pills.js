import { LitElement, html, css } from "https://esm.sh/lit@2.8.0";
import { ReteNode } from "./node.child.js";
import Swal from "https://esm.sh/sweetalert2";
class BespeakWorkspacePill extends LitElement {
    static styles = css`
        :host {
            display: flex;
            align-items: center;
            width: 100%;
        }

        .pill-container {
            display: flex;
            align-items: center;
            flex-grow: 1;
            padding: 10px;
            width: 100%;
            border: 1px solid #ccc;
            border-radius: 5px;
            cursor: pointer;
            margin: 10px;
        }

        .pill-container:hover {
            background-color: #f0f0f0;
        }
        .pill-container.active {
            background-color: #f0f0f0;
        }

        .name {
            flex-grow: 1;
            margin-right: 10px;
        }

        .icons {
            display: flex;
            align-items: center;
        }

        .edit-icon,
        .trash-icon,
        .download-icon {
            margin-left: 5px;
            cursor: pointer;
        }

        .edit-icon:hover,
        .trash-icon:hover {
            color: blue;
        }

        .editable {
            border: none;
            outline: none;
            background-color: transparent;
            cursor: text;
        }
    `;

    static properties = {
        workspace: { type: Object },
        active: { type: Boolean },
        ide: { type: Object },
    };

    constructor() {
        super();
        this.editable = false;
        this.name = "";
    }

    updated(changedProperties) {
        if (changedProperties.has("workspace")) {
            this.name = this.workspace.name;
            this.requestUpdate();
        }

        if (changedProperties.has("active")) {
            this.requestUpdate();
        }
    }

    handleDownload(e) {
        e.stopPropagation();
        e.preventDefault();
        const dataStr =
            "data:text/json;charset=utf-8," +
            encodeURIComponent(
                `export default ${JSON.stringify(this.workspace, null, 2)};`
            );
        const downloadAnchorNode = document.createElement("a");
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute(
            "download",
            this.workspace.name + ".js"
        );
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    connectedCallback() {
        super.connectedCallback();
        this.name = this.workspace.name;
    }

    handleClick() {
        if (!this.editable) {
            this.ide.loadWorkspace(this.workspace.id);
        }
    }

    async handleEdit(e) {
        e.stopPropagation();
        e.preventDefault();
        this.editable = true;
        this.requestUpdate();
        await this.updateComplete;
        const inputElement = this.shadowRoot.querySelector(".editable");

        inputElement.focus();
        inputElement.select();
    }

    handleDelete(e) {
        e.stopPropagation();
        e.preventDefault();
        Swal.fire({
            title: "Are you sure?",
            text: "You won't be able to revert this!",
            icon: "warning",
            showCancelButton: true,
        }).then((result) => {
            if (result.isConfirmed) {
                this.ide.deleteWorkspace(this.workspace.id);
            }
        });
    }

    handleBlur() {
        this.editable = false;
        const newName = this.shadowRoot.querySelector(".editable").value;
        this.ide.saveWorkspace({ ...this.workspace, name: newName });
        this.requestUpdate();
    }

    render() {
        return html`
            <div
                class="pill-container ${this.active ? "active" : ""}"
                @click=${this.handleClick}>
                <div class="name">
                    ${this.editable
                        ? html`<input
                              class="editable"
                              value=${this.name}
                              @blur=${this.handleBlur} />`
                        : html`${this.name}`}
                </div>
                <div class="icons">
                    <div class="edit-icon" @click=${this.handleEdit}>✏️</div>
                    <div class="trash-icon" @click=${this.handleDelete}>🗑️</div>
                    <div class="download-icon" @click=${this.handleDownload}>
                        ⬇️
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define("bespeak-workspace-pill", BespeakWorkspacePill);

class BespeakNodePill extends LitElement {
    static styles = BespeakWorkspacePill.styles;

    static properties = {
        title: { type: String },
        definition: { type: Object },
        workspace: { type: Object },
    };

    constructor() {
        super();
        this.name = "";
    }

    connectedCallback() {
        super.connectedCallback();
        this.title = this.definition?.Component.title;
    }

    async updated(changedProperties) {
        if (changedProperties.has("workspace")) {
            setTimeout(async () => {
                const def = await ReteNode.getComponent("subflow");
                def.config = {
                    workspace: this.workspace.id,
                };

                this.definition = def;
                this.title = `SubFlow: ${this.workspace.name}`;
            }, 1000);
        }
    }

    handleDragStart(event) {
        event.dataTransfer.setData(
            "text/plain",
            JSON.stringify(this.definition)
        );
        const dragImage = event.currentTarget.cloneNode(true);
        dragImage.style.position = "absolute";
        dragImage.style.top = "-1000px";
        document.body.appendChild(dragImage);
        event.dataTransfer.setDragImage(dragImage, 0, 0);
    }

    render() {
        return html`
            <div
                class="pill-container"
                draggable="true"
                @dragstart=${this.handleDragStart}>
                <div class="name">${this.title}</div>
            </div>
        `;
    }
}

customElements.define("bespeak-node-pill", BespeakNodePill);
