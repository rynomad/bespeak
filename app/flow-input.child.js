import { LitElement, html, css } from "https://esm.sh/lit@2.8.0";
import BespeakComponent from "./component.js";
import _ from "https://esm.sh/lodash";
import { FlexContainer } from "./flex.js";

class FlowInput extends BespeakComponent {
    icon = "angle-down";

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
            <bespeak-flex-container
                .objs=${Array.from(this.pipedTo)}></bespeak-flex-container>
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
