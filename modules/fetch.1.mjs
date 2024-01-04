import { z } from "zod";
import {
    from,
    switchMap,
    catchError,
    of,
    combineLatest,
    map,
    withLatestFrom,
} from "https://esm.sh/rxjs";
import { Readability } from "https://esm.sh/@mozilla/readability";

export const key = "fetch-readability-operator";
export const version = "1.0.0";
export const description =
    "An operator that fetches HTML content from a specified URL, parses it using readability.js, and optionally reinserts image and/or anchor tags into the parsed content.";

export const inputSchema = z.object({
    url: z.string().url(),
    includeImages: z.boolean().optional().default(false),
    includeLinks: z.boolean().optional().default(false),
});

export const outputSchema = z.object({
    title: z.string(),
    content: z.string(),
    textContent: z.string(),
    length: z.number(),
    excerpt: z.string().optional(),
    siteName: z.string().optional(),
});

export const keysSchema = z.object({
    proxy: z.string().url().optional(),
});

const statusOperator = (operable) => {
    return {
        success: (message, detail) => {
            operable.status$.next({
                status: "success",
                message,
                detail,
            });
        },
        error: (message, detail) => {
            operable.status$.next({
                status: "error",
                message,
                detail,
            });
        },
        debug: (message, detail) => {
            operable.status$.next({
                status: "debug",
                message,
                detail,
            });
        },
        info: (message, detail) => {
            operable.status$.next({
                status: "info",
                message,
                detail,
            });
        },
    };
};

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

const setupOperator = (operable) => {
    if (window.DOMParser) {
        return of(window.DOMParser);
    } else {
        return from(
            import("https://deno.land/x/deno_dom/deno-dom-wasm.ts")
        ).pipe(map(({ DOMParser }) => DOMParser));
    }
};

export default function fetchReadabilityOperator(operable) {
    const status = statusOperator(operable);
    const setup$ = setupOperator(operable);

    return (input$) =>
        combineLatest(input$, operable.read.keys$).pipe(
            switchMap(([input, keys]) => {
                console.log("INPUT", input, keys);
                const fetchUrl = keys?.proxy
                    ? `${keys.proxy}/${input.url}`
                    : input.url;
                return from(fetch(fetchUrl)).pipe(
                    switchMap((response) => response.text()),
                    withLatestFrom(setup$),
                    switchMap(([html, DOMParser]) => {
                        const doc = new DOMParser().parseFromString(
                            html,
                            "text/html"
                        );
                        const reader = new Readability(doc);
                        const article = reader.parse();
                        if (!article) {
                            throw new Error(
                                "Failed to parse the article using Readability"
                            );
                        }

                        if (input.includeImages) {
                            replaceContent(
                                doc,
                                "img",
                                "includeImages",
                                input,
                                article
                            );
                            // Logic to reinsert images
                        }
                        if (input.includeLinks) {
                            replaceContent(
                                doc,
                                "a",
                                "includeLinks",
                                input,
                                article
                            );
                            // Logic to reinsert links
                        }

                        status.success(
                            "Article fetched and parsed successfully",
                            { url: input.url }
                        );

                        return of({
                            title: article.title,
                            content: article.content,
                            textContent: article.textContent,
                            length: article.textContent.length,
                            excerpt: article.excerpt,
                            siteName: article.siteName,
                        });
                    }),
                    catchError((error) => {
                        status.error("Error fetching or parsing article", {
                            error: error.message,
                            url: input.url,
                        });
                        return of({});
                    })
                );
            })
        );
}
