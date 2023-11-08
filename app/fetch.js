const originalFetch = window.fetch;

window.fetch = async (input, init = {}) => {
    try {
        return await originalFetch(input, init);
    } catch (error) {
        // If it fails due to CORS, use the CORS proxy
        if (error.name === "TypeError") {
            let url = typeof input === "string" ? input : input.url;
            url = `https://thawing-plains-21424-06b99718f4d6.herokuapp.com/${url}`;

            // If input is a Request object, clone it and change the url
            if (input instanceof Request) {
                input = new Request(url, init);
            } else {
                input = url;
            }

            return originalFetch(input, init);
        }

        // If the error is not due to CORS, rethrow it
        throw error;
    }
};
