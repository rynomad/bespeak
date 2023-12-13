import { map, switchMap, catchError } from "https://esm.sh/rxjs";
import { from, of } from "https://esm.sh/rxjs";

const getText = async (path) => {
    try {
        path = path.replace("./", "");
        const cwd = Deno.realPathSync(".");
        return await Deno.readTextFile(`${cwd}/${path}`);
    } catch (e) {
        console.warn(e);
        return await fetch(path).then((res) => res.text());
    }
};

export const key = "fs";
export const version = "0.0.1";
export const description =
    "The fs operator gives access to the a single folder on the filesystem. It uses the Deno fs api.";

export const configSchema = () =>
    of({
        type: "object",
        properties: {
            directory: {
                type: "string",
                description: "The directory of the files.",
            },
        },
        required: ["directory"],
        additionalProperties: false,
    });

export const inputSchema = () =>
    of({
        type: "object",
        properties: {
            file: {
                type: "string",
                description: "The file string e.g. readme.md",
            },
        },
        required: ["file"],
        additionalProperties: false,
    });

export const outputSchema = () =>
    of({
        type: "object",
        properties: {
            contents: {
                type: "string",
                description: "The contents of the file",
            },
        },
        required: ["contents"],
        additionalProperties: false,
    });

export const operator =
    ({ node, config, keys }) =>
    (input$) =>
        input$.pipe(
            map(({ file }) => `${config.directory}/${file}`),
            switchMap((filePath) =>
                from(getText(filePath)).pipe(
                    map((contents) => ({ contents })),
                    catchError((error) => of({ error: error.message }))
                )
            )
        );

export const test = async () => {
    // setup
    const directory = ".";
    const file = "test.txt";
    await Deno.writeTextFile(`${directory}/${file}`, "Hello, world!");

    // test cases
    const cases = [
        {
            name: "reads file contents",
            node: {},
            config: { directory },
            keys: {},
            input: { file },
            output: { contents: "Hello, world!" },
        },
        {
            name: "handles file not found",
            node: {},
            config: { directory },
            keys: {},
            input: { file: "nonexistent.txt" },
            output: { error: "No such file or directory (os error 2)" },
        },
    ];

    // teardown
    const teardown = async () => {
        await Deno.remove(`${directory}/${file}`);
    };

    return { cases, teardown };
};

export default operator;
