import { LitElement, html, css } from "https://esm.sh/lit";
import { PropagationStopper } from "../mixins.js";

class NodesIcon extends PropagationStopper(LitElement) {
    static styles = css``;
    render() {
        return html`
            <svg
                xmlns="http://www.w3.org/2000/svg"
                height="1em"
                viewBox="0 0 576 512">
                <path
                    d="M0 80C0 53.5 21.5 32 48 32h96c26.5 0 48 21.5 48 48V96H384V80c0-26.5 21.5-48 48-48h96c26.5 0 48 21.5 48 48v96c0 26.5-21.5 48-48 48H432c-26.5 0-48-21.5-48-48V160H192v16c0 1.7-.1 3.4-.3 5L272 288h96c26.5 0 48 21.5 48 48v96c0 26.5-21.5 48-48 48H272c-26.5 0-48-21.5-48-48V336c0-1.7 .1-3.4 .3-5L144 224H48c-26.5 0-48-21.5-48-48V80z" />
            </svg>
        `;
    }
}

customElements.define("bespeak-nodes-icon", NodesIcon);
