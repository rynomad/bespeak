import React, { Component } from "https://esm.sh/react@18.2.0";
import { AutoGrowTextarea } from "./form-textarea.mjs"; // Adjust the import path

class JsonAutoGrowTextarea extends Component {
    constructor(props) {
        super(props);
        this.handleChange = this.handleChange.bind(this);
    }

    handleChange(value) {
        let parsedValue = {};
        try {
            parsedValue = JSON.parse(value);
        } catch (error) {
            console.warn("Failed to parse JSON:", error);
        }

        this.props.onChange(parsedValue);
    }

    render() {
        return React.createElement(AutoGrowTextarea, {
            ...this.props,
            onChange: this.handleChange,
            value: JSON.stringify(this.props.value, null, 2),
        });
    }
}

export function JsonTextAreaWidget(props) {
    const {
        id,
        required,
        readonly,
        disabled,
        onChange,
        onFocus,
        onBlur,
        value,
    } = props;

    return React.createElement("div", { className: "mb-3" }, [
        React.createElement(JsonAutoGrowTextarea, {
            id: id,
            readOnly: readonly,
            disabled: disabled,
            required: required,
            onChange: onChange,
            onFocus: onFocus,
            onBlur: onBlur,
            value: value,
        }),
    ]);
}
