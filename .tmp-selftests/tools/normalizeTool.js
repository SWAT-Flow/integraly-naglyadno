import { X_LIMITS } from "../constants.js";
import { asFinite, clamp } from "../math/numeric.js";
const TOOL_MODES = ["none", "under", "between", "riemann", "trap", "volume"];
const SAMPLE_MODES = ["left", "mid", "right"];
function normalizeBound(value, fallback) {
    const numeric = typeof value === "number" ? value : Number(value);
    if (Number.isNaN(numeric)) {
        return fallback;
    }
    if (numeric === Number.POSITIVE_INFINITY) {
        return X_LIMITS[1];
    }
    if (numeric === Number.NEGATIVE_INFINITY) {
        return X_LIMITS[0];
    }
    return clamp(numeric, X_LIMITS[0], X_LIMITS[1]);
}
function pickExpression(requestedId, availableIds, fallbackId) {
    if (requestedId && availableIds.includes(requestedId)) {
        return requestedId;
    }
    return fallbackId;
}
export function normalizeTool(rawTool, validExpressions) {
    const availableIds = validExpressions.map((expression) => expression.id);
    const fallbackA = availableIds[0] ?? null;
    const fallbackB = availableIds[1] ?? fallbackA;
    const mode = TOOL_MODES.includes(rawTool.mode) ? rawTool.mode : "none";
    let exprA = pickExpression(rawTool.exprA, availableIds, fallbackA);
    let exprB = pickExpression(rawTool.exprB, availableIds, fallbackB);
    if (mode === "between") {
        if (!exprA) {
            exprA = fallbackA;
        }
        if (!exprB) {
            exprB = availableIds.find((id) => id !== exprA) ?? fallbackB;
        }
        if (exprA === exprB && availableIds.length > 1) {
            exprB = availableIds.find((id) => id !== exprA) ?? exprB;
        }
    }
    const a = normalizeBound(rawTool.a, -2);
    const b = normalizeBound(rawTool.b, 2);
    const n = Math.max(2, Math.round(asFinite(rawTool.n, 8)));
    const sample = SAMPLE_MODES.includes(rawTool.sample) ? rawTool.sample : "mid";
    return {
        mode,
        exprA,
        exprB,
        a,
        b,
        n,
        sample,
    };
}

