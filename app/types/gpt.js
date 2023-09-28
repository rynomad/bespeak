import React from "https://esm.sh/react@18.2.0?bundle";

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

export const PROMPT = {
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
};

export const CHAT = {
    label: "Chat History",
    type: "chat",
    schema: {
        type: "object",
        properties: {
            messages: {
                type: "array",
                items: {
                    oneOf: [
                        PROMPT.schema,
                        {
                            type: "array",
                            items: PROMPT.schema,
                        },
                    ],
                },
            },
        },
    },
};

export const CONFIG = {
    label: "Chat GPT",
    type: "config",
    name: "config",
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
};

export const API_KEY = {
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
                description: "https://platform.openai.com/account/api-keys",
            },
        },
        required: ["api_key"],
    },
    uiSchema: {
        api_key: {
            "ui:widget": "password",
        },
    },
};
