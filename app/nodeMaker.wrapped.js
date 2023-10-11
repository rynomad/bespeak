import NodeMaker, { quine } from "./nodeMaker.js";
import { NextNodeElementWrapper } from "./node-element-wrapper.js";

export const NodeMakerGPT = NextNodeElementWrapper(
    undefined,
    NodeMaker,
    quine,
    true
);

customElements.define("bespeak-node-maker-node", NodeMakerGPT);
