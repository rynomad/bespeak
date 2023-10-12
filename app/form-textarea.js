import React, { Component } from "https://esm.sh/react@18.2.0";
import { utils } from "https://esm.sh/@rjsf/core@3.2.0";
const { getDisplayLabel } = utils;

class AutoGrowTextarea extends Component {
    constructor(props) {
        super(props);
        this.state = { value: props.value };

        this.handleChange = this.handleChange.bind(this);
        this.handleFocus = this.handleFocus.bind(this);
        this.handleBlur = this.handleBlur.bind(this);
    }

    handleChange(e) {
        e.target.style.height = "inherit";
        e.target.style.height = `${e.target.scrollHeight + 3}px`;
        this.props.onChange(e.target.value);
    }

    handleFocus(e) {
        this.props.onFocus(this.props.id, e.target.value);
    }

    handleBlur(e) {
        this.props.onBlur(this.props.id, e.target.value);
    }

    handleKeyDown(e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            e.target.blur();
        }
    }

    render() {
        return React.createElement("textarea", {
            ...this.props,
            value: this.props.value,
            onChange: this.handleChange,
            onFocus: this.handleFocus,
            onBlur: this.handleBlur,
            onKeyDown: this.handleKeyDown.bind(this),
            className: "form-control",
            rows: 4,
        });
    }
}

export function TextAreaWidget(props) {
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
        React.createElement(AutoGrowTextarea, {
            id: id,
            readOnly: readonly,
            disabled: disabled,
            required: required,
            onChange: onChange,
            onFocus: onFocus,
            onBlur: onBlur,
            value,
        }),
    ]);
}
