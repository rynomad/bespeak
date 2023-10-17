import Dropzone, { quine } from "./dropzone.js";
import { NextNodeElementWrapper } from "./node-element-wrapper.js";

export const DropZone = NextNodeElementWrapper(
    undefined,
    Dropzone,
    quine,
    "./dropzone.js",
    true
);

customElements.define("bespeak-drop-zone", DropZone);
