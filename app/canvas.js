import { LitElement, html, css } from "https://esm.sh/lit@2.0.1";
import { Editor } from "./editor.js";
import { structures } from "https://esm.sh/rete-structures";
import { InputNodeComponent, ReteNode } from "./node.js";
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
    debounceTime,
    scan,
    take,
    tap,
} from "https://esm.sh/rxjs";

import "./editor.js";
import { EDITOR_CRUD, EDITOR_STATE } from "./types/editor.js";
import { PROMPT } from "./types/gpt.js";

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
        this.editor$ = new Subject();
        this.chatFocus$ = new Subject();
        this.chatBlur$ = new Subject();
        this.editorCrud$ = new Subject();
        this.editorState$ = new Subject();
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

        this.editor$
            .pipe(
                debug(this, "editor"),
                switchMap(({ editor }) => {
                    return editor.state$;
                }),
                debug(this, "editor state")
            )
            .subscribe(this.editorState$);

        this.activeWorkspaceSubscription = this.ide.activeWorkspace$
            .pipe(
                debug(this, "ide"),
                scan((subs, id) => {
                    for (const sub of subs) {
                        sub.unsubscribe();
                    }
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
                    devEditor.open = false;
                    devEditor.status = "waiting";
                    devEditor.inputs$ = new ReplaySubject(1);
                    devEditor.outputs$ = new ReplaySubject(1);

                    this.editor$.next({ editor, devEditor });
                    const chat = document.createElement("bespeak-chat");
                    chat.ide = this.ide;
                    chat.clearMessage = true;
                    chat.handleFocus = this.chatFocus$.next.bind(
                        this.chatFocus$
                    );
                    chat.handleBlur = this.chatBlur$.next.bind(this.chatBlur$);

                    const devInputs = [PROMPT, EDITOR_STATE].map(
                        (def) => new Stream(devEditor, def)
                    );

                    const prompt$ = devInputs.find(
                        (input) => input.type === PROMPT.type
                    );

                    const editorState$ = devInputs.find(
                        (input) => input.type === EDITOR_STATE.type
                    );

                    devEditor.inputs$.next(devInputs);

                    const _subs = [
                        this.chatFocus$
                            .pipe(
                                debounceTime(100),
                                debug(this, "handle chat focus"),
                                map(() => ({
                                    type: "chat-focus",
                                }))
                            )
                            .subscribe(devEditor.events$),
                        this.chatBlur$
                            .pipe(
                                debounceTime(100),
                                debug(this, "handle chat blur"),
                                map(() => ({
                                    type: "chat-blur",
                                }))
                            )
                            .subscribe(devEditor.events$),
                        chat.subject.subscribe(prompt$.subject),
                        this.editorState$.subscribe(editorState$.subject),
                        devEditor.outputs$
                            .pipe(
                                filter((outputs) =>
                                    outputs.some(
                                        (o) => o.type === EDITOR_CRUD.type
                                    )
                                ),
                                switchMap(
                                    (outputs) =>
                                        outputs.find(
                                            (output) =>
                                                output.type === EDITOR_CRUD.type
                                        )?.subject
                                )
                            )
                            .subscribe(this.editorCrud$),
                    ];

                    this.replaceChildren(editor, chat, devEditor);
                    chat.focus();

                    return _subs;
                }, [])
            )
            .subscribe();

        this.editorCrud$
            .pipe(
                withLatestFrom(this.editor$),
                debug(this, "editor crud"),
                tap(([crud, { editor }]) => {
                    editor.crud$.next(crud);
                })
            )
            .subscribe();
    }

    render() {
        return html`<slot></slot>`;
    }
}

customElements.define("bespeak-canvas", BespeakCanvas);
