import { LitElement, html, css } from "https://esm.sh/lit@2.8.0";
import BespeakComponent from "./component.js";
import _ from "https://esm.sh/lodash";

class FlowInput extends BespeakComponent {
    icon = "angle-down";

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

    onPipe() {
        super.onPipe();

        for (const sub of this.backSubs) {
            sub.unsubscribe();
        }

        this.backSubs = Array.from(this.pipedTo).map((obj) =>
            obj.back$.subscribe((val) => {
                this.requestUpdate();
            })
        );

        this.requestUpdate();
    }

    renderBack() {
        return html`
            <div class="flex-container">
                ${Array.from(this.pipedTo).map(
                    (obj) => html`
                        <div class="flex-item">${obj.renderBack()}</div>
                    `
                )}
            </div>
        `;
    }
}

export default FlowInput;

// leave this here for now
export async function quine() {
    const response = await fetch(import.meta.url);
    const source = await response.text();
    return source;
}
