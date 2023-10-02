export * from "./types/index.js";
import * as _types from "./types/index.js";
export const Types = new Map();

Object.keys(_types).forEach((key) => {
    Types.set(_types[key].type, _types[key]);
});
