import GPTCall, { quine } from "./gpt.js";
import { NextNodeElementWrapper } from "./node-element-wrapper.js";

export const GPT = NextNodeElementWrapper(undefined, GPTCall, quine, true);

customElements.define("bespeak-gpt-node", GPT);
