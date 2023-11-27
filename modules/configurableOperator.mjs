import { of, pipe } from "https://esm.sh/rxjs";
import {
    map,
    tap,
    filter,
    distinctUntilChanged,
} from "https://esm.sh/rxjs/operators";

export const key = "configurableOperator";
export const version = "0.0.1";
export const description =
    "A configurable operator that can become any other RxJS operator that takes a single function as an argument";

export const configSchema = () => {
    return of({
        description:
            'An object with properties "operatorName" and "funcString"',
        type: "object",
        properties: {
            operatorName: {
                type: "string",
                enum: [
                    "map",
                    "tap",
                    "filter",
                    "distinctUntilChanged",
                    "scan",
                    "reduce",
                ],
            },
            funcString: {
                type: "string",
            },
            seed: {},
        },
        required: ["operatorName", "funcString"],
    });
};

export const inputSchema = () => {
    return of({
        description: "Any input object",
        type: "object",
        properties: {},
        additionalProperties: true,
    });
};

export const outputSchema = () => {
    return of({
        description: "Any output object",
        type: "object",
        properties: {},
        additionalProperties: true,
    });
};

export const test = [
    {
        input: { value: 1 },
        config: { operatorName: "map", funcString: "value.value * 2" },
        expectedOutput: { value: 2 },
    },
    {
        input: { value: 3 },
        config: { operatorName: "map", funcString: "value.value + 5" },
        expectedOutput: { value: 8 },
    },
    {
        input: { value: 5 },
        config: { operatorName: "filter", funcString: "value.value > 3" },
        expectedOutput: { value: 5 },
    },
    {
        input: { value: 2 },
        config: { operatorName: "filter", funcString: "value.value > 3" },
        expectedOutput: null, // The value does not pass the filter
    },
];

export default ({ node, config = {}, keys = {} }) =>
    (input$) => {
        // console.log("configurableOperator", config);
        const func = new Function("value", `return ${config.funcString};`);
        let operator;

        switch (config.operatorName) {
            case "map":
                operator = map(func);
                break;
            case "tap":
                operator = tap(func);
                break;
            case "filter":
                operator = filter(func);
                break;
            case "distinctUntilChanged":
                operator = distinctUntilChanged(func);
                break;
            default:
                throw new Error(`Unsupported operator: ${config.operatorName}`);
        }

        return input$.pipe(operator, node.log(`${config.operatorName} done`));
    };
