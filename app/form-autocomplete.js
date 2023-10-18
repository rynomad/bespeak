import React, { useState } from "https://esm.sh/react@18.2.0";
import { Typeahead } from "https://esm.sh/react-bootstrap-typeahead?deps=react@18.2.0,react-dom@18.2.0";

export function AutoCompleteWidget(props) {
    const { schema, id, value, onChange, disabled, readonly } = props;
    const [inputValue, setInputValue] = useState(value || "");

    // Handle selection from the typeahead component
    const handleSelect = (selected) => {
        if (selected && selected.length > 0) {
            onChange(selected[0].label); // Directly use the label as the value
            setInputValue(selected[0].label);
        } else {
            onChange("");
            setInputValue("");
        }
    };

    // Handle direct changes to the text input
    const handleInputChange = (text) => {
        setInputValue(text);
        if (!text) {
            onChange(""); // Clear the value when text is empty
        }
    };

    return React.createElement(Typeahead, {
        id: id,
        labelKey: "label",
        options: schema.enum.map((val) => ({ label: val })),
        selected: inputValue ? [{ label: inputValue }] : [],
        onInputChange: handleInputChange,
        onChange: handleSelect,
        disabled: disabled || readonly,
    });
}
