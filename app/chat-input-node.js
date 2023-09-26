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
            node: { type: Object },
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
            (p) => new Stream(this.node, p)
        );

        this.config$ = new Stream(this.node, CONFIG);
        this.node.parameters$.next([this.config$]);

        this.node.outputs$.next(outputs);

        const upstreamChat$ = this.node.inputs$.pipe(
            map((inputs) => inputs.find((input) => input.type === CHAT.type))
        );

        this.node.editor.canvas.chatInput$
            .pipe(
                filter(() => {
                    return (
                        this.node.editor.structures
                            .outgoers(this.node.id)
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

        this.node.editor.canvas.chatInput$
            .pipe(
                filter(() => {
                    return (
                        this.node.editor.structures
                            .outgoers(this.node.id)
                            .nodes().length === 0
                    );
                }),
                debug(this, "default chat input spy"),
                tap(async (message) => {
                    const target = new ReteNode(
                        this.node.ide,
                        this.node.editor
                    );
                    const source =
                        this.node.editor.editor.nodes.find(
                            (n) => n.selected && n !== this.node
                        ) ||
                        this.node.editor.structures
                            .leaves()
                            .nodes()
                            .find((n) => n !== this.node);
                    await this.node.editor.addNode(target, source);

                    target.parameters$
                        .pipe(
                            take(1),
                            withLatestFrom(source?.parameters$ || from([[]]))
                        )
                        .subscribe(([params, sourceParams]) => {
                            const prompt$ = params.find(
                                ({ type }) => type === PROMPT.type
                            );
                            const config$ = params.find(
                                ({ type }) => type === CONFIG.type
                            );

                            const sourceConfig$ = sourceParams.find(
                                ({ type }) => type === CONFIG.type
                            );

                            config$.subject
                                .pipe(
                                    take(1),
                                    withLatestFrom(
                                        sourceConfig$.subject ||
                                            this.config$.subject
                                    )
                                )
                                .subscribe(([_, config]) => {
                                    config$.subject.next(config);
                                    prompt$.subject
                                        .pipe(take(1))
                                        .subscribe(() => {
                                            prompt$.subject.next(message);
                                        });
                                });
                        });
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
