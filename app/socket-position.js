import { DOMSocketPosition } from "https://esm.sh/rete-render-utils";

export class BetterDomSocketPosition extends DOMSocketPosition {
    static getAbsolute(side) {
        const { x, y, k } = this.area.area.transform;
        const box = this.area.container.getBoundingClientRect();
        const halfWidth = box.width / 2 / k;
        const height = side === "output" ? 0 : box.height / k;

        return { x: halfWidth - x / k, y: height - y / k };
    }

    attach(scope) {
        if (this.area) return;
        if (!scope.hasParent()) return;
        this.area = scope.parentScope();

        const getAbsolute = BetterDomSocketPosition.getAbsolute.bind(this);

        // eslint-disable-next-line max-statements, complexity
        // eslint-disable-next-line max-statements, complexity
        this.area.addPipe(async (context) => {
            if (context.type === "rendered" && context.data.type === "socket") {
                const { nodeId, key, side, element } = context.data;

                const position = await this.calculatePosition(
                    nodeId,
                    side,
                    key,
                    element
                );

                if (position) {
                    this.sockets.add({ nodeId, key, side, element, position });
                    this.emitter.emit({ nodeId, key, side });
                }
            } else if (context.type === "unmount") {
                this.sockets.remove(context.data.element);
            } else if (context.type === "nodetranslated") {
                this.emitter.emit({ nodeId: context.data.id });
            } else if (context.type === "noderesized") {
                const { id: nodeId } = context.data;

                await Promise.all(
                    this.sockets
                        .snapshot()
                        .filter((item) => item.nodeId === context.data.id)
                        .map(async (item) => {
                            const { side, key, element } = item;
                            const position = await this.calculatePosition(
                                nodeId,
                                side,
                                key,
                                element
                            );

                            if (position) {
                                item.position = position;
                            }
                        })
                );
                this.emitter.emit({ nodeId });
            } else if (
                context.type === "render" &&
                context.data.type === "connection"
            ) {
                const { source, target } = context.data.payload;
                const nodeId = source || target;

                this.emitter.emit({ nodeId });
            }
            return context;
        });
    }
}
