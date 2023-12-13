import defaults from "https://esm.sh/defaults";
import { jsonPreset } from "https://esm.sh/json-schema-preset";

export const getText = async (path) => {
    try {
        const cwd = Deno.realPathSync(".");
        return await Deno.readTextFile(`${cwd}/${path}`);
    } catch (e) {
        console.warn(e);
        return await fetch(path).then((res) => res.text());
    }
};
