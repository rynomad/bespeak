import { Observable, of } from "https://esm.sh/rxjs";
import { map } from "https://esm.sh/rxjs/operators";
import { Readability } from "https://esm.sh/@mozilla/readability";
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

export const version = "0.0.1";
export const description =
    "Parses HTML and extracts readable text. Optionally reinserts links and images back into the parsed text.";

export const configSchema = ({ node, config, keys }) =>
    of({
        type: "object",
        properties: {
            insertLinks: {
                type: "boolean",
                description:
                    "Whether to reinsert links back into the parsed text.",
            },
            insertImages: {
                type: "boolean",
                description:
                    "Whether to reinsert images back into the parsed text.",
            },
        },
        additionalProperties: false,
    });

export const keysSchema = ({ node, config, keys }) =>
    of({
        type: "object",
        properties: {},
        additionalProperties: false,
    });

export const inputSchema = ({ node, config, keys }) =>
    of({
        type: "object",
        properties: {
            url: {
                type: "string",
                format: "uri",
                description:
                    "URL of the webpage to parse. If provided, the HTML property should not be.",
            },
            html: {
                type: "string",
                description:
                    "Raw HTML to parse. If provided, the URL property should not be.",
            },
        },
        additionalProperties: false,
    });

export const outputSchema = ({ node, config, keys }) =>
    of({
        type: "object",
        properties: {
            text: {
                type: "string",
                description: "The parsed text.",
            },
        },
        additionalProperties: false,
    });

export const test = async () => {
    const cases = [
        {
            input: {
                html: '<html><body><h1>Hello world</h1><a href="https://example.com">Example</a></body></html>',
            },
            config: {
                insertLinks: true,
            },
            expectedOutput: {
                text: 'Hello world <a href="https://example.com">Example</a>',
            },
        },
        {
            input: {
                html: '<html><body><h1>Hello world</h1><img src="https://example.com/image.jpg" alt="Example image"></body></html>',
            },
            config: {
                insertImages: true,
            },
            expectedOutput: {
                text: 'Hello world <img src="https://example.com/image.jpg" alt="Example image">',
            },
        },
        {
            input: {
                html: '<html><body><h1>Hello world</h1><a href="https://example.com">Example</a><img src="https://example.com/image.jpg" alt="Example image"></body></html>',
            },
            config: {
                insertLinks: true,
                insertImages: true,
            },
            expectedOutput: {
                text: 'Hello world <a href="https://example.com">Example</a> <img src="https://example.com/image.jpg" alt="Example image">',
            },
        },
    ];

    const teardown = () => {};

    return { cases, teardown };
};

const parseHTML =
    ({ node, config = {}, keys = {} }) =>
    (input$) => {
        return new Observable((subscriber) => {
            input$
                .pipe(
                    map((input) => {
                        let doc;
                        if (input.url.startsWith("http")) {
                            const response = fetch(input.url).then((res) =>
                                res.text()
                            );
                            doc = new DOMParser().parseFromString(
                                response,
                                "text/html"
                            );
                        } else {
                            doc = new DOMParser().parseFromString(
                                input.html,
                                "text/html"
                            );
                        }

                        const reader = new Readability(doc);
                        const article = reader.parse();

                        if (config.insertLinks) {
                            const links = doc.querySelectorAll("a");
                            links.forEach((link) => {
                                article.textContent =
                                    article.textContent.replace(
                                        link.textContent,
                                        link.outerHTML
                                    );
                            });
                        }

                        if (config.insertImages) {
                            const images = doc.querySelectorAll("img");
                            images.forEach((img) => {
                                article.textContent =
                                    article.textContent.replace(
                                        img.alt,
                                        img.outerHTML
                                    );
                            });
                        }

                        return { text: article.textContent };
                    }),
                    node.log("parseHTML done")
                )
                .subscribe({
                    next: (value) => subscriber.next(value),
                    error: (err) => subscriber.error(err),
                    complete: () => subscriber.complete(),
                });
        });
    };

export default parseHTML;
