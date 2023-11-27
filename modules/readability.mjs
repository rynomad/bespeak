import { map } from "https://esm.sh/rxjs";
import Readability from "https://esm.sh/@mozilla/readability";
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

export const key = "parseHTML";
export const version = "0.0.1";
export const description = `Use @mozilla/readability and deno_dom to parse HTML and extract readable text. It is configurable to reinsert links and/or images back into the parsed text by replacing their text content or alt text with their respective HTML. You may provide either raw HTML or a URL to a webpage to parse."

Dependencies:

import { Readability } from "https://esm.sh/@mozilla/readability";
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";
`;

const parseHTML =
    ({ node, config, keys }) =>
    (input$) => {
        return input$.pipe(
            map((input) => {
                const doc = new DOMParser().parseFromString(
                    input.html,
                    "text/html"
                );
                const reader = new Readability(doc);
                const article = reader.parse();

                if (config && config.reinsertLinksAndImages) {
                    const links = Array.from(doc.getElementsByTagName("a"));
                    const images = Array.from(doc.getElementsByTagName("img"));

                    links.forEach((link) => {
                        article.textContent = article.textContent.replace(
                            link.textContent,
                            link.outerHTML
                        );
                    });

                    images.forEach((image) => {
                        article.textContent = article.textContent.replace(
                            image.alt,
                            image.outerHTML
                        );
                    });
                }

                node.log(`HTML Parsing done for node ${node.id}`);

                return {
                    id: node.id,
                    parsedHTML: article.textContent,
                };
            })
        );
    };

export const inputSchema =
    ({ node, config, keys }) =>
    (input$) => {
        return input$.pipe(
            map(() => ({
                type: "object",
                properties: {
                    html: {
                        type: "string",
                        description: "The HTML string to parse.",
                    },
                },
                required: ["html"],
            }))
        );
    };

export const configSchema =
    ({ node, config, keys }) =>
    (input$) => {
        return input$.pipe(
            map(() => ({
                type: "object",
                properties: {
                    reinsertLinksAndImages: {
                        type: "boolean",
                        description:
                            "Whether to reinsert links and images back into the parsed text content.",
                    },
                },
                required: ["reinsertLinksAndImages"],
            }))
        );
    };

export const keysSchema =
    ({ node, config, keys }) =>
    (input$) => {
        return of({
            type: "object",
            properties: {},
            description: "No keys are required for this operator.",
        });
    };

export const outputSchema =
    ({ node, config, keys }) =>
    (input$) => {
        return input$.pipe(
            map(() => ({
                type: "object",
                properties: {
                    id: {
                        type: "string",
                        description: "The id of the node.",
                    },
                    parsedHTML: {
                        type: "string",
                        description: "The parsed HTML text content.",
                    },
                },
                required: ["id", "parsedHTML"],
            }))
        );
    };

export const test = [
    {
        input: {
            html: "<html><body><h1>Title</h1><p>Content</p></body></html>",
        },
        config: {
            reinsertLinksAndImages: false,
        },
        expectedOutput: {
            id: "node1",
            parsedHTML: "Title\n\nContent",
        },
    },
    {
        input: {
            html: '<html><body><h1>Title</h1><p>Content <a href="https://example.com">link</a></p></body></html>',
        },
        config: {
            reinsertLinksAndImages: true,
        },
        expectedOutput: {
            id: "node1",
            parsedHTML:
                'Title\n\nContent <a href="https://example.com">link</a>',
        },
    },
    {
        input: {
            html: '<html><body><h1>Title</h1><p>Content <img src="https://example.com/image.jpg" alt="image"></p></body></html>',
        },
        config: {
            reinsertLinksAndImages: true,
        },
        expectedOutput: {
            id: "node1",
            parsedHTML:
                'Title\n\nContent <img src="https://example.com/image.jpg" alt="image">',
        },
    },
];

export default parseHTML;
