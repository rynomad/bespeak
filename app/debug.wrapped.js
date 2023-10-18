import _Debug, { quine } from "./debug.js";
import { NextNodeElementWrapper } from "./node-element-wrapper.js";

export const Debug = NextNodeElementWrapper(
    undefined,
    _Debug,
    quine,
    "./debug.js",
    true
);

customElements.define("bespeak-debug", Debug);
