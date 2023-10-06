import * as kiwi from "https://esm.sh/@lume/kiwi";

export function layout(nodes, connections) {
    // Create a solver
    const solver = new kiwi.Solver();

    // Create variables for the nodes
    const nodeVars = nodes.map((node) => ({
        ...node,
        width: node._width,
        height: node._height,
        x: new kiwi.Variable(),
        y: new kiwi.Variable(),
        distanceToCorner: Math.sqrt(
            Math.pow(node.width / 2, 2) + Math.pow(node.height / 2, 2)
        ),
    }));

    const parentsMap = new Map();
    const inputsMap = new Map();

    // Create parents and inputs maps
    connections.forEach((connection) => {
        if (
            connection.sourceOutput === "assets" &&
            connection.targetInput === "owners"
        ) {
            const children = parentsMap.get(connection.source) || new Set();
            children.add(connection.target);
            parentsMap.set(connection.source, children);
        } else if (
            connection.sourceOutput === "output" &&
            connection.targetInput === "input"
        ) {
            const inputs = inputsMap.get(connection.source) || new Set();
            inputs.add(connection.target);
            inputsMap.set(connection.source, inputs);
        }
    });

    // Add constraints for the parents map
    parentsMap.forEach((children, parent) => {
        const parentNode = nodeVars.find((node) => node.id === parent);
        const childrenNodes = Array.from(children).map((child) =>
            nodeVars.find((node) => node.id === child)
        );

        // Sort children by the number of their own children, least to most
        childrenNodes.sort(
            (a, b) =>
                (parentsMap.get(a.id)?.size || 0) -
                (parentsMap.get(b.id)?.size || 0)
        );

        // All children should have the same x value as each other
        childrenNodes.forEach((childNode, index) => {
            if (index === 0) {
                // The first child's y value should be equal to the parent's y value
                solver.addConstraint(
                    new kiwi.Constraint(
                        childNode.y,
                        kiwi.Operator.Eq,
                        parentNode.y,
                        kiwi.Strength.strong
                    )
                );
            } else {
                // The rest should have y value greater than the sum of half the previous height plus half of its own height
                const prevNode = childrenNodes[index - 1];
                solver.addConstraint(
                    new kiwi.Constraint(
                        childNode.y,
                        kiwi.Operator.Ge,
                        new kiwi.Expression(
                            prevNode.y,
                            prevNode.height / 2,
                            childNode.height / 2,
                            30
                        ),
                        kiwi.Strength.required
                    )
                );
            }

            // All children's x values should be greater than half the parent x value + half of the parent width + half the child width + 30
            solver.addConstraint(
                new kiwi.Constraint(
                    childNode.x,
                    kiwi.Operator.Ge,
                    new kiwi.Expression(
                        parentNode.x,
                        parentNode.width / 2,
                        childNode.width / 2,
                        30
                    ),
                    kiwi.Strength.strong
                )
            );
        });
    });

    // Add constraints for the inputs map
    inputsMap.forEach((inputs, source) => {
        const sourceNode = nodeVars.find((node) => node.id === source);
        const inputNodes = Array.from(inputs).map((input) =>
            nodeVars.find((node) => node.id === input)
        );

        // Sort inputs by the number of their own inputs, least to most
        inputNodes.sort(
            (a, b) =>
                (inputsMap.get(a.id)?.size || 0) -
                (inputsMap.get(b.id)?.size || 0)
        );

        // All inputs should have the same y value as each other
        inputNodes.forEach((inputNode, index) => {
            if (index === 0) {
                // The first input's x value should be equal to the source's x value
                solver.addConstraint(
                    new kiwi.Constraint(
                        inputNode.x,
                        kiwi.Operator.Eq,
                        sourceNode.x,
                        kiwi.Strength.strong
                    )
                );
            } else {
                // The rest should have x value greater than the sum of half the previous width plus half of its own width
                const prevNode = inputNodes[index - 1];
                solver.addConstraint(
                    new kiwi.Constraint(
                        inputNode.x,
                        kiwi.Operator.Ge,
                        new kiwi.Expression(
                            prevNode.x,
                            prevNode.width / 2,
                            inputNode.width / 2,
                            30
                        ),
                        kiwi.Strength.required
                    )
                );
            }

            // All inputs' y values should be greater than half the source y value + half of the source height + half the input height + 30
            solver.addConstraint(
                new kiwi.Constraint(
                    inputNode.y,
                    kiwi.Operator.Ge,
                    new kiwi.Expression(
                        sourceNode.y,
                        sourceNode.height / 2,
                        inputNode.height / 2,
                        30
                    ),
                    kiwi.Strength.strong
                )
            );
        });
    });

    // Solve the constraints
    solver.updateVariables();

    let overlapsExist = true;
    let i = 0;
    while (i < 10 && overlapsExist) {
        i++;
        overlapsExist = false;
        for (let i = 0; i < nodeVars.length; i++) {
            for (let j = i + 1; j < nodeVars.length; j++) {
                const nodeA = nodeVars[i];
                const nodeB = nodeVars[j];

                // Check if nodes overlap
                if (
                    Math.abs(nodeA.x.value() - nodeB.x.value()) <
                        (nodeA.width + nodeB.width) / 2 &&
                    Math.abs(nodeA.y.value() - nodeB.y.value()) <
                        (nodeA.height + nodeB.height) / 2
                ) {
                    overlapsExist = true;

                    // Add constraint to move the node further to the right
                    if (nodeA.x.value() > nodeB.x.value()) {
                        solver.addConstraint(
                            new kiwi.Constraint(
                                nodeA.x,
                                kiwi.Operator.Ge,
                                new kiwi.Expression(
                                    nodeB.x,
                                    nodeB.width / 2,
                                    nodeA.width / 2,
                                    30
                                ),
                                kiwi.Strength.required
                            )
                        );
                    } else {
                        solver.addConstraint(
                            new kiwi.Constraint(
                                nodeB.x,
                                kiwi.Operator.Ge,
                                new kiwi.Expression(
                                    nodeA.x,
                                    nodeA.width / 2,
                                    nodeB.width / 2,
                                    30
                                ),
                                kiwi.Strength.required
                            )
                        );
                    }
                }
            }
        }

        // Solve the constraints again if overlaps exist
        if (overlapsExist) {
            solver.updateVariables();
        }
    }

    // Return the new positions of the nodes
    return nodeVars.map((node) => ({
        id: node.id,
        x: node.x.value() - node.width / 2,
        y: node.y.value() - node.height / 2,
        width: node.width,
        height: node.height,
        children: [],
    }));
}
