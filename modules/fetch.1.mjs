import { z } from "zod";
import {
    from,
    switchMap,
    catchError,
    of,
    combineLatest,
    map,
    tap,
    withLatestFrom,
    startWith,
} from "https://esm.sh/rxjs";
import { Readability } from "https://esm.sh/@mozilla/readability";

export const key = "fetch";
export const version = "1.0.0";
export const type = "process";
export const description =
    "An operator that fetches HTML content from a specified URL, parses it using readability.js, and optionally reinserts image and/or anchor tags into the parsed content.";

export const input = () =>
    of(
        z.object({
            url: z.string().url(),
            includeImages: z.boolean().optional(),
            includeLinks: z.boolean().optional(),
        })
    );

export const output = () =>
    of(
        z.object({
            title: z.string(),
            content: z.string(),
            textContent: z.string(),
            length: z.number(),
            excerpt: z.string().optional(),
            siteName: z.string().optional(),
        })
    );

export const config = () =>
    of(
        z.object({
            includeImages: z.boolean().optional(),
            includeLinks: z.boolean().optional(),
        })
    );

export const keys = () =>
    of(
        z.object({
            useProxy: z.boolean().optional(),
            proxy: z.string().url().optional(),
        })
    );

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
        if (localStorage.getItem("PROXY_EXTENSION_ID")) {
            return from(
                import("https://esm.sh/gh/rynomad/lpc@11ca84012e")
            ).pipe(
                map(({ ChromeExtensionTransport, Client }) => {
                    console.log(
                        "CHROME EXTENSION TRANSPORT",
                        ChromeExtensionTransport
                    );
                    const transport = new ChromeExtensionTransport(
                        localStorage.getItem("PROXY_EXTENSION_ID")
                    );

                    const fetch = Client.create("fetch", transport);
                    return { DOMParser, fetch };
                })
            );
        }
        return of({ DOMParser: window.DOMParser, fetch });
    } else {
        return from(
            import("https://deno.land/x/deno_dom/deno-dom-wasm.ts")
        ).pipe(map(({ DOMParser }) => ({ DOMParser, fetch })));
    }
};

export default function fetchReadabilityOperator(operable) {
    const status = statusOperator(operable);
    const setup$ = setupOperator(operable);

    return (input$) =>
        combineLatest(
            input$,
            operable.read.config$.pipe(startWith({})),
            operable.read.keys$.pipe(startWith({})),
            setup$
        ).pipe(
            switchMap(([input, config, keys, { fetch }]) => {
                console.log("INPUT", input, keys, fetch);
                const includeImages = [true, false].includes(
                    input.includeImages
                )
                    ? input.includeImages
                    : config.includeImages;

                const includeLinks = [true, false].includes(input.includeLinks)
                    ? input.includeLinks
                    : config.includeLinks;

                const fetchUrl =
                    keys?.useProxy && keys?.proxy
                        ? `${keys.proxy}/${input.url}`
                        : input.url;

                operable.write.state$.next({
                    state: "started",
                    message: `Issuing fetch...`,
                });
                return from(fetch(fetchUrl)).pipe(
                    switchMap((response) => response.text()),
                    withLatestFrom(setup$),
                    switchMap(([html, { DOMParser }]) => {
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

                        if (includeImages) {
                            replaceContent(
                                doc,
                                "img",
                                "includeImages",
                                input,
                                article
                            );
                            // Logic to reinsert images
                        }
                        if (includeLinks) {
                            replaceContent(
                                doc,
                                "a",
                                "includeLinks",
                                input,
                                article
                            );
                            // Logic to reinsert links
                        }

                        operable.write.state$.next({
                            state: "stopped",
                            message: article.content,
                        });
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
