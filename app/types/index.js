export * from "./gpt.js";
export * from "./editor.js";
export * from "./frequency.js";
export const EXAMPLE = {
    label: "Example",
    type: "example",
    schema: {
        type: "object",
        properties: {
            text: {
                type: "string",
            },
            number: {
                type: "number",
            },
        },
    },
};
