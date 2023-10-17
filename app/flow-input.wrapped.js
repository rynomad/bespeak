import Flowinput, { quine } from "./flow-input.js";
import { NextNodeElementWrapper } from "./node-element-wrapper.js";

export const FlowInput = NextNodeElementWrapper(
    undefined,
    Flowinput,
    quine,
    "./flow-input.js",
    true
);

customElements.define("bespeak-flow-input", FlowInput);
