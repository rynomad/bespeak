import {
    BehaviorSubject,
    of,
    merge,
    takeUntil,
    withLatestFrom,
    switchMap,
    map,
    filter,
    tap,
    pluck,
    distinctUntilChanged,
    combineLatest,
    EMPTY,
} from "https://esm.sh/rxjs";
import { z } from "zod";

export const key = "flow";
export const version = "1.0.0";
export const description =
    "This operator encapsulates a flow of other operables.";

export const config = () => {
    const schema = z.object({
        operables: z
            .array(z.string())
            .min(1, "At least one operable is required"),
        connections: z
            .object({
                stream: z
                    .array(
                        z.object({
                            from: z.string(),
                            to: z.string(),
                        })
                    )
                    .default([]),
                tools: z
                    .array(
                        z.object({
                            from: z.string(),
                            to: z.string(),
                        })
                    )
                    .default([]),
            })
            .default({ stream: [], tools: [] }),
        input: z.string().optional(),
        output: z.string().optional(),
    });

    return of(schema);
};

const getIOTool = (operable, role) =>
    combineLatest(
        operable.io.tools$,
        operable.read.config$.pipe(pluck(role), distinctUntilChanged())
    ).pipe(
        switchMap(([tools, name]) => {
            const tool = tools.find(
                (tool) => tool.id.split("-").pop() === name
            );
            return tool ? of(tool) : EMPTY;
        })
    );

export const input = (operable) => {
    return combineLatest(
        operable.io.tools$,
        operable.read.config$.pipe(pluck("input"), distinctUntilChanged())
    ).pipe(
        switchMap(([tools, id]) => {
            const inputTool = tools.find((tool) => tool.id === id);
            return inputTool ? of(inputTool.schema.input$) : of(z.any());
        }),
        map((schema) => schema || z.any())
    );
};

export const output = (operable) => {
    return combineLatest(
        operable.io.tools$,
        operable.read.config$.pipe(pluck("output"), distinctUntilChanged())
    ).pipe(
        switchMap(([tools, id]) => {
            const outputTool = tools.find((tool) => tool.id === id);
            return outputTool ? of(outputTool.schema.output$) : of(z.any());
        }),
        map((schema) => schema || z.any())
    );
};

const setup = (operable) => {
    const currentConfig$ = new BehaviorSubject({
        operables: [],
        connections: {
            stream: [],
            tools: [],
        },
    });
    const Operable = operable.constructor;

    operable.read.config$
        .pipe(takeUntil(operable.destroy$))
        .subscribe((newConfig) => {
            const tools$ = operable.io.tools$;
            const oldConfig = currentConfig$.getValue();
            if (
                newConfig &&
                JSON.stringify(newConfig) !== JSON.stringify(oldConfig)
            ) {
                currentConfig$.next(newConfig);
                const { operables } = newConfig;

                // insert and new tools
                for (const name of operables) {
                    const id = `${operable.id}-${name}`;
                    if (!tools$.getValue().find((tool) => tool.id === id)) {
                        tools$.next([...tools$.getValue(), new Operable(id)]);
                    }
                }

                // remove old tools
                for (const tool of tools$.getValue()) {
                    if (!operables.includes(tool.id.split("-").pop())) {
                        tool.destroy();
                        tool.io.upstream$.getValue().forEach((upstream) => {
                            upstream.disconnect(tool);
                        });
                        tool.io.downstream$.getValue().forEach((downstream) => {
                            tool.disconnect(downstream);
                        });
                        tool.io.tools$.getValue().forEach((_tool) => {
                            tool.remove(_tool);
                        });
                        tool.io.users$.getValue().forEach((user) => {
                            user.remove(tool);
                        });

                        tools$.next(
                            tools$.getValue().filter((t) => t.id !== tool.id)
                        );
                    }
                }

                const newTools = tools$.getValue();
                const findTool = (tools, name) =>
                    tools.find((tool) => tool.id === `${operable.id}-${name}`);

                const getDiff = (aConnections, bConnections) => {
                    return aConnections.filter(
                        ({ from, to }) =>
                            !bConnections.some(
                                ({ from: bFrom, to: bTo }) =>
                                    from === bFrom && to === bTo
                            )
                    );
                };

                const toAddStream = getDiff(
                    newConfig.connections.stream,
                    oldConfig.connections.stream
                );

                const toRemoveStream = getDiff(
                    oldConfig.connections.stream,
                    newConfig.connections.stream
                );

                const toAddTools = getDiff(
                    newConfig.connections.tools,
                    oldConfig.connections.tools
                );

                const toRemoveTools = getDiff(
                    oldConfig.connections.tools,
                    newConfig.connections.tools
                );

                const manageConnection = ({ from, to }, action) => {
                    const fromOperable = findTool(newTools, from);
                    const toOperable = findTool(newTools, to);
                    if (fromOperable && toOperable) {
                        fromOperable[action](toOperable);
                    }
                };

                toAddStream.forEach((connection) => {
                    manageConnection(connection, "connect");
                });

                toRemoveStream.forEach((connection) => {
                    manageConnection(connection, "disconnect");
                });

                toAddTools.forEach((connection) => {
                    manageConnection(connection, "use");
                });

                toRemoveTools.forEach((connection) => {
                    manageConnection(connection, "remove");
                });
            }
        });
};

export default function FlowConstructor(operable) {
    setup(operable);

    return (input$) => {
        const inputFlow$ = combineLatest(
            input$,
            getIOTool(operable, "input")
        ).pipe(
            tap(([inputValue, target]) => {
                if (target) {
                    target.input$.next(inputValue);
                }
            }),
            filter(() => false)
        );

        const outputFlow$ = getIOTool(operable, "output").pipe(
            switchMap((target) => {
                return target ? target.output$ : of(null);
            })
        );

        return merge(inputFlow$, outputFlow$);
    };
}
