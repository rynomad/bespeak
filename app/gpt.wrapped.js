import ChatGPT, { quine } from "./gpt.js";
import { ComponentMixin } from "./component.js";

export const GPT = ComponentMixin(ChatGPT, undefined, quine, true);

customElements.define("bespeak-gpt-node", GPT);
