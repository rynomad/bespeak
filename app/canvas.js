import { LitElement, html, css } from "https://esm.sh/lit@2.0.1";
import { Editor } from "./editor.js";
import { structures } from "https://esm.sh/rete-structures";
import { ReteNode } from "./node.js";
import { GPT } from "./gpt.js";
import { debug } from "./operators.js";
import { Stream } from "./stream.js";
import {
    Subject,
    ReplaySubject,
    combineLatest,
    from,
    skipUntil,
    switchMap,
    Observable,
    withLatestFrom,
    switchScan,
    map,
    filter,
    take,
    tap,
} from "https://esm.sh/rxjs";

import "./editor.js";

class BespeakCanvas extends LitElement {
    static get styles() {
        return css`
            :host {
                display: flex;
                flex-direction: column;
                flex-grow: 1;
                height: 100%;
            }
        `;
    }

    constructor() {
        super();
        this.chatInput$ = new Subject();
        this.editor$ = new Subject();
        this.chatFocus$ = new Subject();
        this.chatBlur$ = new Subject();
    }

    connectedCallback() {
        super.connectedCallback();

        this.setupEditor();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.chatSubscription.unsubscribe();
    }

    async setupEditor() {
        await this.updateComplete;
        this.activeWorkspaceSubscription = this.ide.activeWorkspace$
            .pipe(debug(this, "ide"))
            .subscribe((id) => {
                const editor = document.createElement("bespeak-editor");
                editor.id = id;
                editor.ide = this.ide;
                editor.canvas = this;
                editor.collapsable = false;
                editor.open = true;

                const devEditor = document.createElement("bespeak-editor");
                devEditor.id = id + "-dev";
                devEditor.ide = this.ide;
                devEditor.canvas = this;
                devEditor.collapsable = true;
                devEditor.open = true;
                devEditor.status = "waiting";
                devEditor.inputs$ = new ReplaySubject(1);
                devEditor.outputs$ = new ReplaySubject(1);

                const chat = document.createElement("bespeak-chat");
                chat.ide = this.ide;
                chat.clearMessage = true;
                chat.handleFocus = this.chatFocus$.next.bind(this.chatFocus$);
                chat.handleBlur = this.chatBlur$.next.bind(this.chatBlur$);

                this.replaceChildren(editor, chat, devEditor);
            });
    }

    render() {
        return html`<slot></slot>`;
    }
}

customElements.define("bespeak-canvas", BespeakCanvas);
