import type { ToolMode } from "../types";

function formatFinite(value: number, digits = 5): string {
  const normalized = value.toFixed(digits).replace(/\.?0+$/, "");
  return normalized === "-0" ? "0" : normalized;
}

export function orderBounds(a: number, b: number): [number, number] {
  return a <= b ? [a, b] : [b, a];
}

export function hasInfiniteBounds(a: number, b: number): boolean {
  return !Number.isFinite(a) || !Number.isFinite(b);
}

export function supportsInfiniteBounds(mode: ToolMode): boolean {
  return mode !== "none";
}

export function supportsFiniteOnlyBounds(mode: ToolMode): boolean {
  return mode === "between" || mode === "averageValue" || mode === "riemann" || mode === "trap";
}

export function formatBoundText(value: number, digits = 3): string {
  if (value === Number.POSITIVE_INFINITY) {
    return "+∞";
  }
  if (value === Number.NEGATIVE_INFINITY) {
    return "-∞";
  }
  return formatFinite(value, digits);
}

export function formatBoundInput(value: number): string {
  if (value === Number.POSITIVE_INFINITY) {
    return "∞";
  }
  if (value === Number.NEGATIVE_INFINITY) {
    return "-∞";
  }
  return Number.isFinite(value) ? formatFinite(value, 6) : "";
}

export function formatBoundTex(value: number, digits = 3): string {
  if (value === Number.POSITIVE_INFINITY) {
    return "\\infty";
  }
  if (value === Number.NEGATIVE_INFINITY) {
    return "-\\infty";
  }
  return formatFinite(value, digits);
}

export function formatIntervalText(a: number, b: number, digits = 3): string {
  const [left, right] = orderBounds(a, b);
  return `[${formatBoundText(left, digits)}; ${formatBoundText(right, digits)}]`;
}

export function parseBoundInput(raw: string): number {
  const normalized = raw.trim().toLowerCase();
  if (!normalized) {
    return Number.NaN;
  }
  if (normalized === "∞" || normalized === "+∞" || normalized === "inf" || normalized === "+inf") {
    return Number.POSITIVE_INFINITY;
  }
  if (normalized === "-∞" || normalized === "-inf") {
    return Number.NEGATIVE_INFINITY;
  }
  const parsed = Number(normalized.replace(",", "."));
  return Number.isNaN(parsed) ? Number.NaN : parsed;
}

export function estimatePreviewBounds(a: number, b: number): [number, number] {
  const [left, right] = orderBounds(a, b);
  if (Number.isFinite(left) && Number.isFinite(right)) {
    return [left, right];
  }

  if (Number.isFinite(left) && right === Number.POSITIVE_INFINITY) {
    return [left, left + 8];
  }

  if (left === Number.NEGATIVE_INFINITY && Number.isFinite(right)) {
    return [right - 8, right];
  }

  return [-6, 6];
}
