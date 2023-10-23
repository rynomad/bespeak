// bespeak/app/gpt-response.wrapped.js
import _GPTRender, { quine } from "./gpt-response.js";
import { NextNodeElementWrapper } from "./node-element-wrapper.js";

export const GPTRender = NextNodeElementWrapper(
    undefined,
    _GPTRender,
    quine,
    "./gpt-response.js",
    true
);

customElements.define("bespeak-gpt-response-node", GPTRender);
