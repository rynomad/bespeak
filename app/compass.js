import { LitElement, html, css } from "https://esm.sh/lit";
import { PropagationStopper } from "./mixins.js";
class FiveSlotElement extends LitElement {
    static styles = css`
        :host {
            display: flex;
            position: relative;
            width: fit-content;
            justify-content: center;
            align-items: center;
        }
        .content {
            position: relative;
        }
        ::slotted([slot="north"]) {
            position: absolute;
            top: -18px;
            z-index: 1;
        }
        ::slotted([slot="south"]) {
            position: absolute;
            bottom: -18px;
            z-index: 1;
        }
        ::slotted([slot="east"]) {
            position: absolute;
            right: -18px;
            z-index: 1;
        }
        ::slotted([slot="west"]) {
            position: absolute;
            left: -18px;
            z-index: 1;
        }
    `;

    render() {
        return html`
            <slot name="north"></slot>
            <slot name="south"></slot>
            <slot name="east"></slot>
            <slot name="west"></slot>
            <slot></slot>
        `;
    }
}

customElements.define("bespeak-compass", FiveSlotElement);
