import ExampleComponent, { quine } from "./example.js";
import { ComponentMixin } from "./component.js";

export const Example = ComponentMixin(ExampleComponent, undefined, quine, true);

customElements.define("bespeak-example-node", Example);
