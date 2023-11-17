import {
    of,
    filter,
    map,
    distinctUntilChanged,
    withLatestFrom,
    switchMap,
} from "rxjs";
import { log } from "../util.mjs";

export const key = "systemConfigToModule";
export const version = "0.0.1";
export const description =
    "The systemConfigToModule operator takes a node system configuration object and returns the corresponding module and configuration for the node. it is configured with the role of the module to be configured and the collection in which the configuration is stored.";

export const configSchema = () =>
    of({
        type: "object",
        properties: {
            role: {
                type: "string",
                description: "The role of the configured module.",
                enum: ["ingress", "operator"],
            },
        },
        required: ["key", "collection"],
    });

const systemToConfiguredModule = ({ node, config }) => {
    const toolIds = ["system:db", "system:imports", "system:jsonPreset"];

    const tools$ = node.tools$.pipe(
        switchMap((tools) => {
            if (!toolIds.every((id) => tools.some((tool) => tool.id === id))) {
                return EMPTY;
            }

            return tools.reduce((acc, tool) => {
                acc[tool.id] = tool;
                return acc;
            });
        })
    );

    return pipe(
        node.log("systemToConfiguredModule start"),
        filter((system) => system?.[config.role]),
        map((system) => system[config.role]),
        distinctUntilChanged(),
        node.log(`systemToConfiguredModule got system.${config.role}`),
        withLatestFrom(tools$),
        node.log(`systemToConfiguredModule got db$ and imports$`),
        switchMap(([moduleId, tools]) => {
            of(moduleId).pipe(
                tools["system:imports"].operator(),
                node.log(`systemToConfiguredModule got module`),
                switchMap((module) =>
                    // TODO make this configurable
                    of([
                        {
                            operation: "findOne",
                            collection: "config",
                            params: {
                                selector: {
                                    node: this.node.id,
                                    module: moduleId,
                                },
                            },
                        },
                        {
                            operation: "findOne",
                            collection: "keys",
                            params: {
                                selector: {
                                    module: moduleId,
                                },
                            },
                        },
                    ]).pipe(
                        tools["system:db"].operator(),
                        node.log(
                            `systemToConfiguredModule got config$ and keys$`
                        ),
                        switchMap(([config$, keys$]) => {
                            combineLatest([
                                config$.pipe(
                                    node.log(
                                        `systemToConfiguredModule got config document`
                                    ),
                                    tools["system:jsonPreset"].operator({
                                        node,
                                        config: {
                                            module,
                                            schema: "config",
                                        },
                                    })
                                ),
                                keys$.pipe(
                                    node.log(
                                        `systemToConfiguredModule got keys document`
                                    ),
                                    tools["system:jsonPreset"].operator({
                                        node,
                                        config: {
                                            module,
                                            schema: "keys",
                                        },
                                    })
                                ),
                            ]).pipe(
                                map(([config, keys]) => {
                                    return {
                                        module,
                                        config,
                                        keys,
                                    };
                                })
                            );
                        }),
                        node.log(
                            `systemToConfiguredModule got module, config, and keys`
                        )
                    )
                )
            );
        }),
        node.log(`systemToConfiguredModule completed`)
    );
};

export default systemToConfiguredModule;
