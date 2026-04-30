import { jsx as _jsx } from "react/jsx-runtime";
import katex from "katex";
import { decodeEscapedUnicode } from "../utils/decodeEscapedUnicode.js";
export function FormulaCard({ tex, displayMode = true, className = "" }) {
    if (!tex) {
        return null;
    }
    const normalizedTex = decodeEscapedUnicode(tex);
    return (_jsx("div", { className: `formula-card ${displayMode ? "" : "formula-inline"} ${className}`.trim(), dangerouslySetInnerHTML: {
            __html: katex.renderToString(normalizedTex, { displayMode, throwOnError: false }),
        } }));
}

