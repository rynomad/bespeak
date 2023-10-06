import {
    AutoArrangePlugin,
    ArrangeAppliers,
} from "https://esm.sh/rete-auto-arrange-plugin";

export class DoubleApplier extends ArrangeAppliers.TransitionApplier {
    async apply(nodes, offset = { x: 0, y: 0 }) {
        const correctNodes = this.getValidShapes(nodes);

        await Promise.all(
            correctNodes.map(({ id, x, y, width, height, children }) => {
                const hasChilden = children && children.length;
                const needsLayout = this.props?.needsLayout
                    ? this.props.needsLayout(id)
                    : true;
                const forceSelf = !hasChilden || needsLayout;

                return Promise.all([
                    hasChilden &&
                        this.apply(children, {
                            x: offset.x + x,
                            y: offset.y + y,
                        }),
                    forceSelf && this.resizeNode(id, width, height),
                    forceSelf &&
                        this.translateNode(id, offset.x + x, offset.y + y),
                ]);
            })
        );
    }
}
