import BespeakComponent from "./component.js";

export default class NodeForm extends BespeakComponent {
    static output = {
        type: "object",
        properties: {
            node: { type: "object" },
        },
    };
}
