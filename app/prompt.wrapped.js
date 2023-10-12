import Prompt, { quine } from "./prompt.js";
import { NextNodeElementWrapper } from "./node-element-wrapper.js";

export const PromptGPT = NextNodeElementWrapper(undefined, Prompt, quine, true);

customElements.define("bespeak-prompt-node", PromptGPT);
