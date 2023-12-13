import { combineLatest, EMPTY, from, of, catchError, concatMap } from "rxjs";
import Node from "http://localhost:3002/modules/node.mjs";
import * as DefaultIngress from "./ingress.mjs";
import { deepEqual } from "https://esm.sh/fast-equals";

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
        fields: ["node", "module"],
        // separator which is used to concat the fields values.
        separator: "|",
    },
    properties: {
        id: {
            type: "string",
            final: true,
            maxLength: 255,
        },
        node: {
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
    required: ["node", "module"],
    indexes: ["node", "module"],
};

const systemSchema = {
    title: "system schema",
    version: 0,
    type: "object",
    primaryKey: "id",
    properties: {
        id: {
            type: "string",
            final: true,
            maxLength: 255,
        },
        process: {
            type: "string",
            maxLength: 255,
            default: `${GPT.key}@${GPT.version}`,
        },
        ingress: {
            type: "string",
            maxLength: 255,
            default: `${DefaultIngress.key}@${DefaultIngress.version}`,
        },
        name: {
            type: "string",
            maxLength: 255,
        },
        description: {
            type: "string",
        },
    },
    required: ["process", "ingress"],
    indexes: ["process", "ingress"],
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
            final: true,
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
    required: ["id", "version"],
    indexes: ["version"],
};

export const config = {
    dbName: "requine",
    collections: {
        keys: {
            schema: keySchema,
        },
        config: {
            schema: configSchema,
        },
        system: {
            schema: systemSchema,
        },
        modules: {
            schema: moduleSchema,
        },
    },
};
