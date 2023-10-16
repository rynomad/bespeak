const originalFetch = window.fetch;

async function hashBody(body) {
    if (!body) return "no-body";

    let data;
    if (body instanceof Blob) {
        data = await body.arrayBuffer();
    } else if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
        data = body;
    } else if (body instanceof FormData) {
        const formDataEntries = Array.from(body.entries());
        const encodedFormData = formDataEntries
            .map(
                ([key, value]) =>
                    `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
            )
            .join("&");
        const encoder = new TextEncoder();
        data = encoder.encode(encodedFormData);
    } else if (body instanceof URLSearchParams) {
        const encoder = new TextEncoder();
        data = encoder.encode(body.toString());
    } else if (typeof body === "string") {
        const encoder = new TextEncoder();
        data = encoder.encode(body);
    } else {
        throw new Error("Unsupported body type");
    }

    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

    return hashHex;
}

window.fetch = async (input, init = {}) => {
    const error = new Error();
    const stack = error.stack || "";
    const blobUrlMatch = stack.match(/blob:[^\s]+/);
    const blobUrl = blobUrlMatch ? blobUrlMatch[0] : "no-blob-url";

    if (input instanceof Request) {
        input = new Request(input, init);
        init = {};
    }

    init.headers = new Headers(init.headers || {});

    const bodyHash = await hashBody(await init.body);
    init.headers.append("x-body-hash", bodyHash);
    init.headers.append("x-element-cache", blobUrl);
    init.headers.append("Vary", "x-element-cache, x-body-hash");

    return originalFetch(input, init);
};
