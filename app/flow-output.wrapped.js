import _FlowOutput, { quine } from "./flow-output.js";
import { NextNodeElementWrapper } from "./node-element-wrapper.js";

export const FlowOutput = NextNodeElementWrapper(
    undefined,
    _FlowOutput,
    quine,
    "./flow-output.js",
    true
);

customElements.define("bespeak-flow-output", FlowOutput);
