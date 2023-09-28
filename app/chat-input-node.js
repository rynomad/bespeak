import { LitElement, html } from "https://esm.sh/lit";
import { PROMPT, CHAT, CONFIG } from "./types/gpt.js";
import { ReteNode } from "./node.js";
import { Stream } from "./stream.js";
import {
    map,
    filter,
    withLatestFrom,
    switchMap,
    combineLatest,
    from,
    take,
    tap,
} from "https://esm.sh/rxjs";
import { debug } from "./operators.js";

export class ChatInput extends LitElement {
    static get name() {
        return this.toString().match(/\w+/g)[1];
    }

    static parameters$ = [CONFIG];

    static outputs = [PROMPT, CHAT];

    static get properties() {
        return {
            _node: { type: Object },
        };
    }

    async connectedCallback() {
        super.connectedCallback();
        await this.updateComplete;

        if (this.initialized) {
            return;
        }

        this.initialized = true;

        const outputs = this.constructor.outputs.map(
            (p) => new Stream(this._node, p)
        );

        this.config$ = new Stream(this._node, CONFIG);
        this._node.parameters$.next([this.config$]);

        this._node.outputs$.next(outputs);

        const upstreamChat$ = this._node.inputs$.pipe(
            map((inputs) => inputs.find((input) => input.type === CHAT.type))
        );

        this._node.editor.canvas.chatInput$
            .pipe(
                filter(() => {
                    return (
                        this._node.editor.structures
                            .outgoers(this._node.id)
                            .nodes().length > 0
                    );
                }),
                debug("downstream chat input spy"),
                withLatestFrom(upstreamChat$),
                switchMap(([chatInput, upstreamChat]) => {
                    return combineLatest(
                        from([chatInput]),
                        upstreamChat?.subject || from([[]])
                    );
                })
            )
            .subscribe(([message, upstreamChat]) => {
                for (const output of outputs) {
                    if (output.type === PROMPT.type) {
                        output.subject.next(message);
                    } else if (output.type === CHAT.type) {
                        output.subject.next([...upstreamChat, message]);
                    }
                }
            });

        this._node.editor.canvas.chatInput$
            .pipe(
                filter(() => {
                    return (
                        this._node.editor.structures
                            .outgoers(this._node.id)
                            .nodes().length === 0
                    );
                }),
                debug(this, "default chat input spy"),
                tap(async (message) => {
                    const target = new ReteNode(
                        this._node.ide,
                        this._node.editor
                    );
                    const source =
                        this._node.editor.editor.nodes.find(
                            (n) => n.selected && n !== this._node
                        ) ||
                        this._node.editor.structures
                            .leaves()
                            .nodes()
                            .find((n) => n !== this._node);
                    await this._node.editor.addNode(target, source);

                    target.component.prompt = message;
                    if (source && source.component.config) {
                        target.component.config = source.component.config;
                    }
                })
            )
            .subscribe();
    }

    render() {
        return html`<div style="font-size: 1.3rem; font-weight: bold;">
            Chat Input
        </div>`;
    }
}

customElements.define("bespeak-chat-input-node", ChatInput);
