import { PROMPT } from "./gpt.js";
export const FREQUENCY_TABLE = {
    label: "Frequency Table",
    type: "frequencyTable",
    schema: {
        type: "object",
        patternProperties: {
            "^\\d+$": { type: "number" },
        },
        additionalProperties: false,
    },
};

export const CODE_FREQUENCY_TABLE = {
    label: "Code Frequency Table",
    type: "code_frequency_table",
    schema: {
        type: "object",
        properties: {
            groups: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        minifiedCode: { type: "string" },
                        failedToMinify: { type: "boolean" },
                        messages: {
                            type: "array",
                            items: PROMPT.schema,
                        },
                    },
                },
            },
        },
    },
};
