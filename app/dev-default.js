import { LitElement, html } from "https://esm.sh/lit@2.8.0";
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
import { EDITOR_CRUD, EDITOR_STATE } from "./types/editor.js";

export class DevDefault extends LitElement {
    static get name() {
        return this.toString().match(/\w+/g)[1];
    }

    static parameters = [CONFIG];

    static outputs = [EDITOR_CRUD];

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

        const parameters = this.constructor.parameters.map(
            (p) => new Stream(this._node, p)
        );

        this.config$ = new Stream(this._node, CONFIG);
        this._node.parameters$.next(parameters);
        this._node.outputs$.next(outputs);

        const upstreamChat$ = this._node.inputs$.pipe(
            map((inputs) => inputs.find((input) => input.type === CHAT.type))
        );

        this.gptPipeline = combineLatest(
            this._node.parameters$,
            this._node.inputs$
        )
            .pipe(
                debug(this, "default dev chat input"),
                map((all) => all.flat()),
                filter((all) => all.length >= 3),
                switchMap((all) =>
                    all
                        .find((stream) => stream.type === PROMPT.type)
                        .subject.pipe(
                            debug(this, "default dev chat input prompt"),
                            map((data) => ({
                                stream: all.find(
                                    (stream) => stream.type === PROMPT.type
                                ),
                                data,
                            })),
                            withLatestFrom(
                                ...all
                                    .filter(
                                        (stream) => stream.type !== PROMPT.type
                                    )
                                    .map((stream) =>
                                        stream.subject.pipe(
                                            debug(
                                                this,
                                                "default dev chat input stream"
                                            ),
                                            map((data) => ({
                                                stream,
                                                data,
                                            }))
                                        )
                                    )
                            )
                        )
                ),
                filter((all) =>
                    all.some(
                        (v) =>
                            v.stream.type === PROMPT.type &&
                            v.data.content &&
                            !v.data.fromStorage
                    )
                ),
                debug(this, "default dev chat input past filter"),
                map((all) => {
                    const config = all.find(
                        ({ stream }) => stream.type === CONFIG.type
                    );
                    const prompt = all.find(
                        ({ stream }) => stream.type === PROMPT.type
                    );
                    const state = all.find(
                        ({ stream }) => stream.type === EDITOR_STATE.type
                    );

                    const source = state.data.nodes.find(
                        (n) =>
                            n.selected ||
                            !state.data.connections.some(
                                (c) => c.source === n.id
                            )
                    );
                    return {
                        create: {
                            nodes: [
                                {
                                    Component: "GPT",
                                    from: source?.id,
                                    initialValues: [
                                        {
                                            name: config.stream.type,
                                            type: config.stream.type,
                                            value: config.data,
                                        },
                                        {
                                            name: prompt.stream.type,
                                            type: prompt.stream.type,
                                            value: prompt.data,
                                        },
                                    ],
                                },
                            ],
                        },
                    };
                }),
                debug(this, "default dev crud output")
            )
            .subscribe(
                outputs.find((o) => o.type === EDITOR_CRUD.type).subject
            );
    }

    render() {
        return html`<div style="font-size: 1.3rem; font-weight: bold;">
            Default Chat Input
        </div>`;
    }
}

customElements.define("bespeak-default-dev-node", DevDefault);
