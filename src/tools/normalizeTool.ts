import { X_LIMITS } from "../constants";
import { supportsInfiniteBounds } from "../math/bounds";
import { asFinite, clamp } from "../math/numeric";
import type { CompiledExpression, SampleMode, ToolMode, ToolState } from "../types";

const TOOL_MODES: ToolMode[] = [
  "none",
  "under",
  "between",
  "riemann",
  "trap",
  "volume",
  "newtonLeibniz",
  "averageValue",
];
const SAMPLE_MODES: SampleMode[] = ["left", "mid", "right"];

function normalizeBound(value: unknown, fallback: number, preserveInfinity: boolean): number {
  const numeric = typeof value === "number" ? value : Number(value);

  if (Number.isNaN(numeric)) {
    return fallback;
  }
  if (numeric === Number.POSITIVE_INFINITY) {
    return preserveInfinity ? Number.POSITIVE_INFINITY : X_LIMITS[1];
  }
  if (numeric === Number.NEGATIVE_INFINITY) {
    return preserveInfinity ? Number.NEGATIVE_INFINITY : X_LIMITS[0];
  }

  return clamp(numeric, X_LIMITS[0], X_LIMITS[1]);
}

function pickExpression(
  requestedId: string | null | undefined,
  availableIds: string[],
  fallbackId: string | null,
): string | null {
  if (requestedId && availableIds.includes(requestedId)) {
    return requestedId;
  }
  return fallbackId;
}

export function normalizeTool(rawTool: Partial<ToolState>, validExpressions: CompiledExpression[]): ToolState {
  const availableIds = validExpressions.map((expression) => expression.id);
  const fallbackA = availableIds[0] ?? null;
  const fallbackB = availableIds[1] ?? fallbackA;

  const mode = TOOL_MODES.includes(rawTool.mode as ToolMode) ? (rawTool.mode as ToolMode) : "none";

  let exprA = pickExpression(rawTool.exprA, availableIds, fallbackA);
  let exprB = pickExpression(rawTool.exprB, availableIds, fallbackB);

  if (
    mode === "under" ||
    mode === "riemann" ||
    mode === "trap" ||
    mode === "volume" ||
    mode === "newtonLeibniz" ||
    mode === "averageValue"
  ) {
    if (!exprA) {
      exprA = fallbackA;
    }
  }

  if (mode === "volume") {
    exprB = rawTool.exprB && availableIds.includes(rawTool.exprB) ? rawTool.exprB : null;
    if (!rawTool.exprB && exprB === exprA && availableIds.length > 1) {
      exprB = availableIds.find((id) => id !== exprA) ?? null;
    }
  }

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

  const preserveInfinity = supportsInfiniteBounds(mode);
  const a = normalizeBound(rawTool.a, -2, preserveInfinity);
  const b = normalizeBound(rawTool.b, 2, preserveInfinity);
  const n = Math.max(2, Math.round(asFinite(rawTool.n, 8)));
  const sample = SAMPLE_MODES.includes(rawTool.sample as SampleMode) ? (rawTool.sample as SampleMode) : "mid";

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
