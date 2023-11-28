import { Observable, of, pipe, tap } from "https://esm.sh/rxjs";

export const version = "0.0.1";
export const description =
    "Dynamically import JavaScript code as a module from a provided string of source code. It creates a Blob URL from the source code, imports it as a module, and returns the imported module. If any error occurs during the import process, it captures and returns the error.";

export function configSchema({ node, config, keys }) {
    return of({
        type: "object",
        properties: {},
        required: [],
    });
}

export function keysSchema({ node, config, keys }) {
    return of({
        type: "object",
        properties: {},
        required: [],
    });
}

export function inputSchema({ node, config, keys }) {
    return of({
        type: "object",
        properties: {
            sourceCode: {
                type: "string",
                description:
                    "JavaScript source code to be imported as a module",
            },
        },
        required: ["sourceCode"],
    });
}

export function outputSchema({ node, config, keys }) {
    return of({
        type: "object",
        properties: {
            module: {
                type: "object",
                description: "Imported JavaScript module",
            },
            error: {
                type: "object",
                description: "Error occurred during the import process",
            },
        },
        required: ["module", "error"],
    });
}

export const test = async () => {
    const cases = [
        {
            input: {
                sourceCode: 'export const hello = "world";',
            },
            config: {},
            keys: {},
            expectedOutput: {
                module: {
                    hello: "world",
                },
            },
        },
        {
            input: {
                sourceCode:
                    "export default function add(a, b) { return a + b; }",
            },
            config: {},
            keys: {},
            expectedOutput: {
                module: {
                    default: function add(a, b) {
                        return a + b;
                    },
                },
            },
        },
        {
            input: {
                sourceCode: "export default 42;",
            },
            config: {},
            keys: {},
            expectedOutput: {
                module: {
                    default: 42,
                },
            },
        },
    ];

    const teardown = () => {};

    return { cases, teardown };
};

export default function createImportModuleFromSourceOperator({
    node,
    config,
    keys,
}) {
    return (input$) =>
        new Observable((observer) => {
            input$
                .pipe(
                    tap(() =>
                        node.log("Starting importModuleFromSourceOperator")
                    )
                )
                .subscribe({
                    next(inputMessage) {
                        const sourceCode = inputMessage.sourceCode;
                        const blob = new Blob([sourceCode], {
                            type: "text/javascript",
                        });
                        const url = URL.createObjectURL(blob);

                        import(url)
                            .then((module) => {
                                observer.next({ module });
                                URL.revokeObjectURL(url);
                                node.log("importModuleFromSourceOperator done");
                            })
                            .catch((err) => {
                                observer.error({ error: err });
                                URL.revokeObjectURL(url);
                                node.log(
                                    "importModuleFromSourceOperator error"
                                );
                            });
                    },
                    error(err) {
                        observer.error({ error: err });
                        node.log("importModuleFromSourceOperator error");
                    },
                    complete() {
                        observer.complete();
                        node.log("importModuleFromSourceOperator complete");
                    },
                });
        });
}
