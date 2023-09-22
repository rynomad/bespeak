import { LitElement, html, css } from "https://esm.sh/lit@2.0.1";
import { Editor } from "./editor.js";
import { structures } from "https://esm.sh/rete-structures";
import { ReteNode } from "./node.js";
import { GPT } from "./gpt.js";
import { debug } from "./operators.js";
import { Stream } from "./stream.js";
import {
    Subject,
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
                display: block;
                width: 100%;
                height: 100%;
            }
        `;
    }

    constructor() {
        super();
        this.chatInputSubject = new Subject();
        this.editor$ = new Subject();
        this.chatFocus$ = new Subject();
        this.chatBlur$ = new Subject();
    }

    connectedCallback() {
        super.connectedCallback();

        this.setupEditor();
        this.setupChat();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.chatSubscription.unsubscribe();
    }

    async setupChat() {
        await this.updateComplete;

        this.nextTarget$ = new Subject();

        this.firstNode$ = this.editor$.pipe(
            filter((editor) => editor !== undefined),
            map((editor) => {
                const node = new ReteNode(this.ide, editor);
                return node;
            }),
            tap((node) => {
                this.nextTarget$.next(node);
            })
        );

        this.nextTarget$
            .pipe(withLatestFrom(this.editor$))
            .subscribe(([node, editor]) => {
                node.parameters$.next(
                    GPT.parameters.map((param) => new Stream(node, param))
                );

                editor.events$.next({
                    type: "custom-node-selected",
                    data: node,
                });
            });

        this.chatFocus$
            .pipe(withLatestFrom(this.nextTarget$, this.editor$))
            .subscribe(([_, node, editor]) => {
                editor.events$.next({
                    type: "custom-node-selected",
                    data: node,
                });
            });

        this.chatInputSubject
            .pipe(
                withLatestFrom(this.editor$, this.firstNode$),
                switchScan(
                    async ({ nextTarget }, [message, editor, firstTarget]) => {
                        const target = nextTarget || firstTarget;

                        const source =
                            editor.editor.nodes.find((n) => n.selected) ||
                            editor.structures.leaves().nodes().pop();
                        await editor.addNode(target, source);
                        nextTarget = new ReteNode(this.ide, editor);
                        this.nextTarget$.next(nextTarget);

                        return { target, nextTarget, message };
                    },
                    {}
                ),
                switchMap(({ target, message }) => {
                    return combineLatest(
                        from(Promise.resolve(message)),
                        target.parameters$.pipe(
                            map((params) =>
                                params.find(({ type }) => type === "prompt")
                            )
                        )
                    );
                }),
                debug(this, "canvas chat spy")
            )
            .subscribe(([message, prompt$]) => {
                prompt$.subject.pipe(take(1)).subscribe((prompt) => {
                    prompt$.subject.next(message);
                });
            });
    }

    async setupEditor() {
        await this.updateComplete;
        this.activeWorkspaceSubscription = this.ide.activeWorkspace$
            .pipe(debug(this, "ide"))
            .subscribe((id) => {
                const editor = document.createElement("bespeak-editor");
                editor.id = id;
                editor.ide = this.ide;

                this.replaceChildren(editor);
                this.editor$.next(editor);
            });
    }

    render() {
        return html`<slot></slot>`;
    }
}

customElements.define("bespeak-canvas", BespeakCanvas);
