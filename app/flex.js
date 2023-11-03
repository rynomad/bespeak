import { LitElement, html, css } from "https://esm.sh/lit@2.8.0";

export class FlexContainer extends LitElement {
    static properties = {
        objs: { type: Array },
    };

    static styles = css`
        :host {
            max-width: 70vw;
            display: block;
            margin: auto;
        }
        .flex-container {
            display: flex;
            flex-wrap: wrap;
            justify-content: flex-start;
        }
        .flex-item {
            flex-basis: calc(
                25% - 10px
            ); /* Adjusts the base width minus margin */
            margin: 5px; /* Provides space between flex items */
            box-sizing: border-box;
        }
        @media (max-width: 70vw) {
            .flex-item {
                flex-basis: calc(
                    50% - 10px
                ); /* Adjusts for fewer columns on smaller screens */
            }
        }
    `;

    render() {
        return html`
            <div class="flex-container">
                ${Array.from(this.objs).map(
                    (obj) => html`
                        <div class="flex-item">${obj.renderBack()}</div>
                    `
                )}
            </div>
        `;
    }
}

customElements.define("bespeak-flex-container", FlexContainer);
