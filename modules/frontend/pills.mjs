import { html, LitElement, css } from "https://esm.sh/lit";

class BespeakNodePill extends LitElement {
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
        this.title = this.definition?.key;
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
