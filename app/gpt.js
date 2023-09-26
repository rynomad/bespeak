import { LitElement, html, css } from "https://esm.sh/lit";
import {
    BehaviorSubject,
    filter,
    map,
    take,
    tap,
    combineLatest,
    switchMap,
    scan,
    Subject,
    debounceTime,
} from "https://esm.sh/rxjs";
import OpenAI from "https://esm.sh/openai";
import { sanitizeAndRenderYaml } from "./util.js";

import { Stream } from "./stream.js";
import { debug } from "./operators.js";
import "./stream-renderer.js";

const UpDownWidget = (props) => {
    return React.createElement("input", {
        type: "number",
        className: "widget form-control",
        step: "0.1",
        value: props.value,
        required: props.required,
        onChange: (event) => props.onChange(event.target.valueAsNumber),
    });
};

const CHAT = {
    label: "Chat History",
    type: "chat",
    schema: {
        type: "object",
        properties: {
            messages: {
                type: "array",
                items: {
                    oneOf: [
                        {
                            type: "object",
                            properties: {
                                role: {
                                    type: "string",
                                    enum: ["system", "user", "assistant"],
                                },
                                content: {
                                    type: "string",
                                },
                            },
                            required: ["role", "content"],
                        },
                        {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    role: {
                                        type: "string",
                                        enum: ["system", "user", "assistant"],
                                    },
                                    content: {
                                        type: "string",
                                    },
                                },
                                required: ["role", "content"],
                            },
                        },
                    ],
                },
            },
        },
    },
};

export class GPT extends LitElement {
    static get name() {
        return this.toString().match(/\w+/g)[1];
    }
    static parameters = [
        {
            label: "api_key",
            type: "api_key",
            name: "OpenAI API Key",
            global: true,
            schema: {
                $schema: "http://json-schema.org/draft-07/schema#",
                type: "object",
                properties: {
                    api_key: {
                        type: "string",
                        title: "Key",
                        minLength: 51,
                        maxLength: 51,
                        description:
                            "https://platform.openai.com/account/api-keys",
                    },
                },
                required: ["api_key"],
            },
            uiSchema: {
                api_key: {
                    "ui:widget": "password",
                },
            },
        },
        {
            label: "Chat GPT",
            type: "config",
            chainable: true,
            display: false,
            showSubmit: true,
            schema: {
                $schema: "http://json-schema.org/draft-07/schema#",
                type: "object",
                properties: {
                    model: {
                        type: "string",
                        default: "gpt-4",
                        enum: ["gpt-4", "gpt-3.5-turbo-0613"],
                    },
                    context: {
                        type: "string",
                        enum: ["yes", "no"],
                        default: "yes",
                        description:
                            "Include the context from connected nodes in the chat history? If yes, the context will be included in the chat history as a system message. In the future, you will have more granular control via templates directly in the chat box.",
                    },
                    chooser: {
                        type: "string",
                        enum: ["single", "all"],
                        default: "single",
                        description:
                            'This has no effect unless there are messages with multiple choices in the chat history. If "single", the first choice is used in each case where there are multiple. If "all", all results are included in the history, as a series of assistand messages.',
                    },
                    temperature: {
                        type: "number",
                        minimum: 0,
                        maximum: 2,
                        default: 0.4,
                    },
                    quantity: {
                        type: "number",
                        minimum: 1,
                        maximum: 10,
                        default: 1,
                    },
                },
                required: ["model"],
            },
            uiSchema: {
                model: {},
                temperature: {
                    "ui:widget": "updown",
                },
                stream: {},
            },
            widgets: {
                updown: UpDownWidget,
            },
        },
        {
            label: "Prompt",
            type: "prompt",
            schema: {
                type: "object",
                properties: {
                    content: {
                        type: "string",
                    },
                    role: {
                        type: "string",
                        enum: ["user", "system", "assistant"],
                    },
                },
            },
        },
        CHAT,
    ];

    static outputs = [{ ...CHAT, label: "Chat History (Output)" }];

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

        this.parametersSubscription = this.node.parameters$
            .pipe(
                tap((parameters) => {
                    this.prompt$ = parameters.find(
                        (p) => p.type === "prompt"
                    ).subject;
                    this.config$ = parameters.find(
                        (p) => p.type === "config"
                    ).subject;
                    this.apiKey$ = parameters.find(
                        (p) => p.type === "api_key"
                    ).subject;
                    this.requestUpdate();

                    this.prompt$.subscribe((v) => console.log("prompt", v));
                })
            )
            .subscribe();

        this.chatStream$ = new Subject();

        this.gptPipeline = combineLatest(
            this.node.parameters$,
            this.node.inputs$
        ).pipe(
            debug(this, "got parameters and input streams"),
            switchMap((all) =>
                combineLatest(
                    all.flat().map((stream) =>
                        stream.subject.pipe(
                            map((data) => ({
                                stream,
                                data,
                            })),
                            // debounceTime(100),
                            stream.global
                                ? filter((v) => Object.keys(v.data).length > 0)
                                : tap(() => {}),
                            stream.global ? take(1) : tap(() => {})
                        )
                    )
                )
            ),
            debug(this, "got parameters and input values"),
            filter(
                ([api_key, _, prompt, chat]) =>
                    api_key.data.api_key &&
                    prompt.data.content &&
                    !(prompt.data.fromStorage && chat.data.fromStorage)
            ),
            debug(this, "got parameters and input values past filter"),
            debounceTime(100),
            switchMap(async ([api_key, config, prompt, chat, ...context]) => {
                const openai = new OpenAI({
                    apiKey: api_key.data.api_key,
                    dangerouslyAllowBrowser: true,
                });

                const contextMessages = context
                    .filter(
                        (s) =>
                            !["chat", "prompt", "config", "api_key"].includes(
                                s.stream.type
                            ) && s.data.messages
                    )
                    .map((stream) => {
                        return {
                            role: "system",
                            content: sanitizeAndRenderYaml(stream.data),
                        };
                    });

                const messages = (chat.data.messages || [])
                    .map((message) =>
                        !Array.isArray(message) || config.chooser === "all"
                            ? message
                            : message[0]
                    )
                    .concat(
                        config.data.context === "yes" ? contextMessages : []
                    )
                    .concat({
                        role: prompt.data.role || "user",
                        content: prompt.data.content,
                    })
                    .flat();

                const options = {
                    model: config.data.model,
                    temperature: config.data.temperature,
                    n: config.data.quantity,
                    messages,
                };

                const remainder = options.n - 1;

                const streamOptions = {
                    ...options,
                    stream: true,
                    n: 1,
                };

                const remainderOptions = {
                    ...options,
                    n: options.n - 1,
                };

                const stream = await openai.chat.completions.create(
                    streamOptions
                );

                let streamContent = "";
                let streamSubject = new BehaviorSubject(streamContent);

                this.chatStream$.next(streamSubject);

                const allResponses = (
                    await Promise.all([
                        (async () => {
                            for await (const part of stream) {
                                const delta =
                                    part.choices[0]?.delta?.content || "";
                                streamContent += delta;
                                streamSubject.next(streamContent);
                            }
                            return streamContent;
                        })(),
                        (async () => {
                            if (remainder > 0) {
                                const e = await openai.chat.completions.create(
                                    remainderOptions
                                );
                                const choices = e.choices.map(
                                    (e) => e.message.content
                                );
                                return choices;
                            }
                            return [];
                        })(),
                    ])
                )
                    .flat()
                    .map((e) => ({
                        role: "assistant",
                        content: e,
                    }));

                return {
                    messages: [...messages, allResponses],
                };
            })
        );

        this.outputsSubscription = this.node.outputs$
            .pipe(
                debug(this, "got output streams"),
                take(1),
                map((outputs) =>
                    outputs.filter((o) => o.type === "chat").pop()
                ),
                debug(this, "got output chat stream"),
                tap((output) => {
                    output.subject.pipe(take(1)).subscribe((value) => {
                        if (
                            value === output.dataFromStorage &&
                            value.messages
                        ) {
                            const lastMessage = JSON.parse(
                                JSON.stringify(value.messages)
                            )
                                .pop()
                                ?.pop?.()?.content;

                            this.chatStream$.next(
                                new BehaviorSubject(lastMessage)
                            );
                        }
                    });
                }),
                map((outputStream) =>
                    this.gptPipeline.subscribe(outputStream.subject)
                ),
                scan((acc, value) => {
                    if (acc) {
                        acc.unsubscribe();
                    }
                    return value;
                })
            )
            .subscribe();

        const outputs = this.constructor.outputs.map(
            (p) => new Stream(this.node, p)
        );

        this.node.parameters$.subscribe((parameters) => {
            this.node.outputs$.next([
                ...parameters.filter((p) => !p.global),
                ...outputs,
            ]);
        });

        this.node.parameters$.next(
            this.constructor.parameters.map((p) => new Stream(this.node, p))
        );
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        // TODO: we can't rely on connection to unsubscribe because rete plays fast and loose with element to move it around the canvas
        // this.parametersSubscription.unsubscribe();
        // this.outputsSubscription.unsubscribe();
    }

    handleFocus() {
        this.node.selected = true;
        const node = this.node;
        this.node.editor.selector.add({
            id: this.node.id,
            unselect() {
                node.selected = false;
            },
            translate() {},
        });
        this.node.editorNode.emit({ type: "focus", data: this.node });
    }

    handleBlur() {
        this.node.editorNode.emit({ type: "blur", data: this.node });
    }

    focus() {
        this.shadowRoot.querySelector("bespeak-chat")?.focus();
    }

    static styles = css`
        :host {
            display: block;
        }
    `;

    render() {
        return html`
            ${this.prompt$
                ? html`<bespeak-chat
                      .handleFocus=${this.handleFocus.bind(this)}
                      .handleBlur=${this.handleBlur.bind(this)}
                      .subject=${this.prompt$}></bespeak-chat>`
                : ""}
            <bespeak-stream-renderer
                .subject=${this.chatStream$}></bespeak-stream-renderer>
        `;
    }
}

customElements.define("bespeak-gpt-node", GPT);
