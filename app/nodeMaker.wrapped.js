import NodeMaker, { quine } from "./gpt.js";
import { ComponentMixin } from "./component.js";

export const NodeMakerGPT = ComponentMixin(NodeMaker, undefined, quine, true);

customElements.define("bespeak-node-maker-node", NodeMakerGPT);
