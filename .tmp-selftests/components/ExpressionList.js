import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { decodeEscapedUnicode } from "../utils/decodeEscapedUnicode.js";
import { Button, Card } from "./ui.js";
import { ExpressionRow } from "./ExpressionRow.js";
export function ExpressionList({ expressions, activeId, editorRequest, inputRefs, onActivate, onAdd, onChange, onDelete, onToggleVisible, }) {
    return (_jsx(Card, { title: "\\u0412\\u044b\\u0440\\u0430\\u0436\\u0435\\u043d\\u0438\\u044f", subtitle: "\\u0412\\u0432\\u043e\\u0434\\u0438\\u0442\\u0435 \\u0444\\u043e\\u0440\\u043c\\u0443\\u043b\\u044b, \\u0441\\u043a\\u0440\\u044b\\u0432\\u0430\\u0439\\u0442\\u0435 \\u043b\\u0438\\u043d\\u0438\\u0438 \\u0438 \\u0443\\u0434\\u0430\\u043b\\u044f\\u0439\\u0442\\u0435 \\u0441\\u0442\\u0440\\u043e\\u043a\\u0438 \\u0442\\u0430\\u043a \\u0436\\u0435, \\u043a\\u0430\\u043a \\u0432 \\u0433\\u0440\\u0430\\u0444\\u0438\\u0447\\u0435\\u0441\\u043a\\u043e\\u043c \\u043a\\u0430\\u043b\\u044c\\u043a\\u0443\\u043b\\u044f\\u0442\\u043e\\u0440\\u0435.", footer: _jsx(Button, { onClick: onAdd, children: "\\u0414\\u043e\\u0431\\u0430\\u0432\\u0438\\u0442\\u044c" }), children: _jsxs("div", { className: "expression-list", children: [expressions.map((expression) => (_jsx(ExpressionRow, { active: expression.id === activeId, editorRequest: editorRequest, expression: expression, inputRef: (node) => {
                        inputRefs.current[expression.id] = node;
                    }, onActivate: () => onActivate(expression.id), onChange: (value) => onChange(expression.id, value), onDelete: () => onDelete(expression.id), onToggleVisible: () => onToggleVisible(expression.id) }, expression.id))), !expressions.length ? (_jsx("div", { className: "empty-state", children: decodeEscapedUnicode("\u0421\u043f\u0438\u0441\u043e\u043a \u043f\u0443\u0441\u0442. \u0414\u043e\u0431\u0430\u0432\u044c\u0442\u0435 \u043f\u0435\u0440\u0432\u0443\u044e \u0444\u0443\u043d\u043a\u0446\u0438\u044e.") })) : null] }) }));
}

