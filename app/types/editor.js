export const EDITOR_CRUD = {
    label: "Editor CRUD",
    type: "editor-crud",
    schema: {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        properties: {
            create: {
                type: "object",
                properties: {
                    nodes: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                Component: {
                                    type: "string",
                                },
                                initialValues: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            type: {
                                                type: "string",
                                            },
                                            value: {
                                                type: "object",
                                            },
                                        },
                                        required: ["type", "value"],
                                    },
                                },
                            },
                            required: ["Component"],
                        },
                    },
                    connections: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                source: {
                                    type: "string",
                                },
                                target: {
                                    type: "string",
                                },
                            },
                            required: ["source", "target"],
                        },
                    },
                },
                required: ["nodes", "connections"],
            },
            delete: {
                type: "object",
                properties: {
                    nodes: {
                        type: "array",
                        items: {
                            type: "string",
                        },
                    },
                    connections: {
                        type: "array",
                        items: {
                            type: "string",
                        },
                    },
                },
                required: ["nodes", "connections"],
            },
        },
        required: ["create", "delete"],
    },
};

export const EDITOR_STATE = {
    label: "Editor State",
    type: "editor-state",
    schema: {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        properties: {
            nodes: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        id: {
                            type: "string",
                        },
                        selected: {
                            type: "boolean",
                        },
                        currentValues: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    type: {
                                        type: "string",
                                    },
                                    value: {
                                        type: "object",
                                    },
                                },
                                required: ["type", "value"],
                            },
                        },
                    },
                    required: ["id", "currentValues"],
                },
            },
            connections: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        id: {
                            type: "string",
                        },
                        source: {
                            type: "string",
                        },
                        target: {
                            type: "string",
                        },
                    },
                    required: ["id", "source", "target"],
                },
            },
            Components: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        type: {
                            type: "string",
                        },
                        parameters: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    type: {
                                        type: "string",
                                    },
                                    schema: {
                                        type: "object",
                                    },
                                },
                                required: ["type", "schema"],
                            },
                        },
                        outputs: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    type: {
                                        type: "string",
                                    },
                                    schema: {
                                        type: "object",
                                    },
                                },
                                required: ["type", "schema"],
                            },
                        },
                    },
                    required: ["type", "parameters", "outputs"],
                },
            },
        },
        required: ["nodes", "connections", "Components"],
    },
};
