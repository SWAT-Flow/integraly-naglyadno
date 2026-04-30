import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { decodeEscapedUnicode } from "../utils/decodeEscapedUnicode.js";
export function Card({ title, subtitle, footer, children }) {
    return (_jsxs("section", { className: "card", children: [_jsx("header", { className: "card-header", children: _jsxs("div", { children: [_jsx("h2", { children: decodeEscapedUnicode(title) }), subtitle ? _jsx("p", { children: decodeEscapedUnicode(subtitle) }) : null] }) }), _jsx("div", { className: "card-body", children: children }), footer ? _jsx("footer", { className: "card-footer", children: footer }) : null] }));
}
export function Button({ active = false, onClick, type = "button", disabled = false, className = "", children, }) {
    const content = typeof children === "string" ? decodeEscapedUnicode(children) : children;
    return (_jsx("button", { className: `button ${active ? "button-active" : ""} ${className}`.trim(), disabled: disabled, onClick: onClick, type: type, children: content }));
}
export function IconButton({ label, onClick, disabled = false, children }) {
    const decodedLabel = decodeEscapedUnicode(label);
    const content = typeof children === "string" ? decodeEscapedUnicode(children) : children;
    return (_jsx("button", { "aria-label": decodedLabel, className: "icon-button", disabled: disabled, onClick: onClick, title: decodedLabel, type: "button", children: content }));
}
export function SelectField({ label, value, options, onChange, disabled = false }) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);
    const selectedOption = options.find((option) => option.value === value) ?? options[0] ?? null;
    useEffect(() => {
        if (!open) {
            return;
        }
        const handlePointerDown = (event) => {
            if (!rootRef.current?.contains(event.target)) {
                setOpen(false);
            }
        };
        const handleEscape = (event) => {
            if (event.key === "Escape") {
                setOpen(false);
            }
        };
        globalThis.document?.addEventListener("pointerdown", handlePointerDown);
        globalThis.window?.addEventListener("keydown", handleEscape);
        return () => {
            globalThis.document?.removeEventListener("pointerdown", handlePointerDown);
            globalThis.window?.removeEventListener("keydown", handleEscape);
        };
    }, [open]);
    return (_jsxs("div", { ref: rootRef, className: "field select-field", children: [_jsx("span", { children: decodeEscapedUnicode(label) }), _jsxs("button", { "aria-expanded": open, "aria-haspopup": "listbox", className: "select-trigger", disabled: disabled, onClick: () => setOpen((current) => !current), title: selectedOption ? decodeEscapedUnicode(selectedOption.label) : undefined, type: "button", children: [_jsx("span", { className: "select-value", children: selectedOption?.selectedRender ?? selectedOption?.render ?? decodeEscapedUnicode(selectedOption?.label ?? "") }), _jsx("span", { className: `select-caret ${open ? "select-caret-open" : ""}`, "aria-hidden": "true", children: "\u25BE" })] }), open ? (_jsx("div", { className: "select-menu", role: "listbox", children: options.map((option) => (_jsx("button", { "aria-selected": option.value === value, className: `select-option ${option.value === value ? "select-option-active" : ""}`, onClick: () => {
                        onChange(option.value);
                        setOpen(false);
                    }, title: decodeEscapedUnicode(option.label), type: "button", children: option.render ?? decodeEscapedUnicode(option.label) }, option.value))) })) : null] }));
}
export function NumberField({ label, value, onChange, step = 0.1 }) {
    const inputRef = useRef(null);
    const [draft, setDraft] = useState(() => (Number.isFinite(value) ? String(value) : ""));
    useEffect(() => {
        if (inputRef.current === globalThis.document?.activeElement) {
            return;
        }
        setDraft(Number.isFinite(value) ? String(value) : "");
    }, [value]);
    return (_jsxs("label", { className: "field", children: [_jsx("span", { children: decodeEscapedUnicode(label) }), _jsx("input", { ref: inputRef, type: "number", value: draft, step: step, onBlur: () => setDraft(Number.isFinite(value) ? String(value) : ""), onChange: (event) => {
                    const next = event.target.value;
                    setDraft(next);
                    const parsed = Number(next);
                    onChange(next.trim() === "" || Number.isNaN(parsed) ? Number.NaN : parsed);
                } })] }));
}
export function MetricGrid({ metrics }) {
    return (_jsx("div", { className: "metric-grid", children: metrics.map((metric) => (_jsxs("div", { className: `metric-pill metric-${metric.tone ?? "slate"}`, children: [_jsx("span", { children: decodeEscapedUnicode(metric.label) }), _jsx("strong", { children: decodeEscapedUnicode(metric.value) })] }, `${metric.label}-${metric.value}`))) }));
}

