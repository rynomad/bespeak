const originalFetch = window.fetch;

window.fetch = async (input, init = {}) => {
    let url = typeof input === "string" ? input : input.url;

    // check if url is same origin, if not, use cors proxy at localhost:8080
    const urlObj = new URL(url);
    if (
        urlObj.origin !== window.location.origin &&
        urlObj.origin !== "https://esm.sh"
    ) {
        console.log("ORIGIN", urlObj.origin);
        url = `http://localhost:8080/${url}`;
    }

    // If input is a Request object, clone it and change the url
    if (input instanceof Request) {
        input = new Request(url, init);
    } else {
        input = url;
    }

    return originalFetch(input, init);
};
