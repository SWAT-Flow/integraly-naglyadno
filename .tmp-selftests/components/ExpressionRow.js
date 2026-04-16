import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { memo, useLayoutEffect, useState } from "react";
import { formatExpressionText } from "../math/parser.js";
import { decodeEscapedUnicode } from "../utils/decodeEscapedUnicode.js";
function ExpressionRowComponent({ expression, active, editorRequest, onActivate, onChange, onDelete, onToggleVisible, inputRef, }) {
    const [isEditing, setIsEditing] = useState(active);
    useLayoutEffect(() => {
        setIsEditing(active);
    }, [active, editorRequest]);
    const visibilityLabel = expression.visible
        ? "\u0421\u043a\u0440\u044b\u0442\u044c \u0433\u0440\u0430\u0444\u0438\u043a"
        : "\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0433\u0440\u0430\u0444\u0438\u043a";
    const selectRowLabel = "\u0412\u044b\u0431\u0440\u0430\u0442\u044c \u0441\u0442\u0440\u043e\u043a\u0443 \u0432\u044b\u0440\u0430\u0436\u0435\u043d\u0438\u044f";
    const editRowLabel = "\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0432\u044b\u0440\u0430\u0436\u0435\u043d\u0438\u0435";
    const deleteLabel = "\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0432\u044b\u0440\u0430\u0436\u0435\u043d\u0438\u0435";
    const previewPrefix = expression.orientation === "xOfY" ? "x = " : "y = ";
    const displayText = expression.text.trim()
        ? `${previewPrefix}${formatExpressionText(expression.normalized || expression.text)}`
        : `${previewPrefix}\u2026`;
    return (_jsxs("div", { className: `expression-row ${active ? "expression-row-active" : ""}`, children: [_jsxs("div", { className: "expression-main", children: [_jsx("button", { "aria-label": selectRowLabel, className: "expression-swatch", onClick: onActivate, style: { backgroundColor: expression.color }, type: "button" }), _jsx("div", { className: "expression-entry", children: isEditing ? (_jsxs("div", { className: "expression-editor", children: [_jsx("div", { className: `expression-live-preview ${expression.text.trim() ? "" : "expression-display-empty"}`, children: displayText }), _jsx("input", { ref: inputRef, className: "expression-input expression-input-overlay", onBlur: () => setIsEditing(false), onChange: (event) => onChange(event.target.value), onFocus: () => {
                                        onActivate();
                                        setIsEditing(true);
                                    }, placeholder: "y = sin(x)", spellCheck: false, type: "text", value: expression.text })] })) : (_jsx("button", { "aria-label": editRowLabel, className: "expression-display", onClick: onActivate, type: "button", children: _jsx("span", { className: `expression-display-text ${expression.text.trim() ? "" : "expression-display-empty"}`, children: displayText }) })) }), _jsx("button", { "aria-label": visibilityLabel, className: "expression-action", onClick: onToggleVisible, title: visibilityLabel, type: "button", children: expression.visible ? "On" : "Off" }), _jsx("button", { "aria-label": deleteLabel, className: "expression-action", onClick: onDelete, title: deleteLabel, type: "button", children: "\u00d7" })] }), expression.error ? _jsx("div", { className: "expression-error", children: decodeEscapedUnicode(expression.error) }) : null] }));
}
export const ExpressionRow = memo(ExpressionRowComponent);

