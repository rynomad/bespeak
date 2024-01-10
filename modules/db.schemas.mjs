const GPT = await import("./gpt.mjs");

const keySchema = {
    title: "key schema",
    version: 0,
    type: "object",
    primaryKey: "module",
    properties: {
        module: {
            type: "string",
            maxLength: 255,
            primary: true,
        },
        data: {
            type: "object",
            additionalProperties: true,
        },
        session: {
            type: "string",
        },
    },
};

const inputSchema = {
    title: "input",
    version: 0,
    type: "object",
    primaryKey: "operable",
    properties: {
        operable: {
            type: "string",
            final: true,
            maxLength: 255,
        },
        data: {
            type: "object",
            additionalProperties: true,
        },
        module: {
            type: "string",
            maxLength: 255,
            final: true,
        },
        session: {
            type: "string",
        },
    },
};

const outputSchema = {
    title: "output",
    version: 0,
    type: "object",
    primaryKey: "operable",
    properties: {
        operable: {
            type: "string",
            final: true,
            maxLength: 255,
        },
        data: {
            type: "object",
            additionalProperties: true,
        },
        module: {
            type: "string",
            maxLength: 255,
        },
        session: {
            type: "string",
        },
    },
};

const configSchema = {
    title: "config schema",
    version: 0,
    type: "object",
    primaryKey: {
        // where should the composed string be stored
        key: "id",
        // fields that will be used to create the composed key
        fields: ["operable", "module"],
        // separator which is used to concat the fields values.
        separator: "|",
    },
    properties: {
        id: {
            type: "string",
            final: true,
            maxLength: 255,
        },
        operable: {
            type: "string",
            maxLength: 255,
            final: true,
        },
        module: {
            type: "string",
            maxLength: 255,
            final: true,
        },
        data: {
            type: "object",
            additionalProperties: true,
        },
    },
    required: ["operable", "module"],
    indexes: ["operable", "module"],
};

const metaSchema = {
    title: "meta schema",
    version: 0,
    type: "object",
    primaryKey: "operable",
    properties: {
        operable: {
            type: "string",
            final: true,
            maxLength: 255,
        },
        data: {
            type: "object",
            properties: {
                process: {
                    type: "string",
                    maxLength: 255,
                },
                ingress: {
                    type: "string",
                    maxLength: 255,
                },
                name: {
                    type: "string",
                    maxLength: 255,
                },
                description: {
                    type: "string",
                },
            },
        },
    },
    required: ["data"],
};

const moduleSchema = {
    title: "module schema",
    version: 0,
    type: "object",
    primaryKey: "id",
    properties: {
        id: {
            type: "string",
            maxLength: 255,
            final: true,
        },
        version: {
            type: "string",
            maxLength: 255,
        },
        type: {
            type: "string",
            maxLength: 255,
        },
        name: {
            type: "string",
            maxLength: 255,
        },
        description: {
            type: "string",
            maxLength: 255,
        },
        data: {
            type: "string",
        },
    },
    required: ["id"],
};

const stateSchema = {
    title: "state schema",
    version: 0,
    type: "object",
    primaryKey: "operable",
    properties: {
        operable: {
            type: "string",
            final: true,
            maxLength: 255,
        },
        session: {
            type: "string",
            maxLength: 255,
        },
        data: {
            type: "object",
            additionalProperties: true,
        },
    },
    required: ["id"],
};

export const config = {
    dbName: "operable",
    collections: {
        keys: {
            schema: keySchema,
        },
        config: {
            schema: configSchema,
        },
        meta: {
            schema: metaSchema,
        },
        modules: {
            schema: moduleSchema,
        },
        input: {
            schema: inputSchema,
        },
        output: {
            schema: outputSchema,
        },
        state: {
            schema: stateSchema,
        },
    },
};
