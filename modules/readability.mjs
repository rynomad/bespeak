import { of, catchError } from "https://esm.sh/rxjs";
import { switchMap } from "https://esm.sh/rxjs/operators";
import { Readability } from "https://esm.sh/@mozilla/readability";
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

export const key = "readability";
export const version = "0.0.1";
export const description =
    "Parses HTML and extracts readable text. Optionally reinserts links and images back into the parsed text.";

const createSchema = (properties) => () =>
    of({ type: "object", properties, additionalProperties: false });

export const configSchema = createSchema({
    insertLinks: {
        type: "boolean",
        description: "Whether to reinsert links back into the parsed text.",
    },
    insertImages: {
        type: "boolean",
        description: "Whether to reinsert images back into the parsed text.",
    },
});

export const inputSchema = createSchema({
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
});
export const outputSchema = createSchema({
    text: { type: "string", description: "The parsed text." },
});

const replaceContent = (doc, selector, configKey, config, article) => {
    console.log("REPLACE CONTENT", selector, configKey, config);
    if (!config[configKey]) return;
    doc.querySelectorAll(selector).forEach(({ textContent, outerHTML }) => {
        console.log("FOUND SELECTOR", selector, textContent, outerHTML);
        article.textContent = article.textContent.replace(
            textContent,
            outerHTML
        );
    });
};

const parseHTML =
    ({ config = {} } = {}) =>
    (input$) =>
        input$.pipe(
            switchMap(async ({ url, html }) => {
                const text = url
                    ? await fetch(url).then((res) => res.text())
                    : html;
                const doc = new DOMParser().parseFromString(text, "text/html");
                const article = new Readability(doc).parse();
                // console.log("ARTICLE", article.textContent);
                ["a", "img"].forEach((selector) => {
                    const configKey =
                        selector === "a" ? "insertLinks" : "insertImages";
                    console.log("SELECTOR", selector, config[configKey]);
                    replaceContent(doc, selector, configKey, config, article);
                });

                return { text: article?.textContent };
            }),
            catchError((error) => {
                return {
                    text: `Error: ${error}`,
                };
            })
        );

export default parseHTML;
