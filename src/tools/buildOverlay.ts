import { COLORS } from "../constants";
import { buildIntervals, findRoots, midpointIntegral, sortAB, uniqueSorted } from "../math/numeric";
import { expressionToTex, formatExpressionText } from "../math/parser";
import type {
  CompiledExpression,
  GraphPoint,
  GraphPolygon,
  GraphPolyline,
  GraphRegion,
  OverlayData,
  OverlayMetric,
  ToolState,
} from "../types";
import { normalizeTool } from "./normalizeTool";

function formatNumber(value: number, digits = 5): string {
  if (!Number.isFinite(value)) {
    return "-";
  }

  const normalized = value.toFixed(digits).replace(/\.?0+$/, "");
  return normalized === "-0" ? "0" : normalized;
}

function emptyOverlay(message: string, metrics: OverlayMetric[] = []): OverlayData {
  return {
    regions: [],
    polygons: [],
    polylines: [],
    points: [],
    verticals: [],
    metrics: metrics.length ? metrics : [{ label: "\u0421\u0442\u0430\u0442\u0443\u0441", value: message, tone: "slate" }],
    formulaTex: null,
    formulaSteps: [],
    explanation: [],
    volumePreview: null,
  };
}

function statusMetric(message: string): OverlayMetric {
  return { label: "\u0421\u0442\u0430\u0442\u0443\u0441", value: message, tone: "slate" };
}

function withOptionalStatus(metrics: OverlayMetric[], message: string, enabled: boolean): OverlayMetric[] {
  return enabled ? [statusMetric(message), ...metrics] : metrics;
}

function findDiscontinuityBreaks(
  fn: (x: number) => number,
  a: number,
  b: number,
  samples = 768,
): number[] {
  const [left, right] = sortAB(a, b);
  if (!(right > left)) {
    return [];
  }

  const step = (right - left) / samples;
  const breaks: number[] = [];
  let previousX = left;
  let previousY = fn(previousX);

  for (let index = 1; index <= samples; index += 1) {
    const x = index === samples ? right : left + step * index;
    const y = fn(x);

    if (!Number.isFinite(previousY) || !Number.isFinite(y)) {
      breaks.push((previousX + x) / 2);
      previousX = x;
      previousY = y;
      continue;
    }

    const magnitude = Math.max(1, Math.abs(previousY), Math.abs(y));
    const signFlip = Math.sign(previousY) !== Math.sign(y);
    const largeValues = Math.max(Math.abs(previousY), Math.abs(y)) > 4;
    if (signFlip && largeValues && Math.abs(y - previousY) > magnitude * 6) {
      breaks.push((previousX + x) / 2);
    }

    previousX = x;
    previousY = y;
  }

  return uniqueSorted(breaks, Math.max(1e-4, step * 1.5));
}

function buildVerticals(a: number, b: number) {
  return [
    { x: a, label: "a", color: COLORS.slate, dash: [6, 6] },
    { x: b, label: "b", color: COLORS.slate, dash: [6, 6] },
  ];
}

function createRectangle(x1: number, x2: number, y: number): GraphPolygon {
  return {
    points: [
      { x: x1, y: 0 },
      { x: x1, y },
      { x: x2, y },
      { x: x2, y: 0 },
    ],
    fill: COLORS.blue,
    opacity: 0.18,
    stroke: COLORS.blue,
    strokeWidth: 1.1,
  };
}

function createTrapezoid(x1: number, y1: number, x2: number, y2: number): GraphPolygon {
  return {
    points: [
      { x: x1, y: 0 },
      { x: x1, y: y1 },
      { x: x2, y: y2 },
      { x: x2, y: 0 },
    ],
    fill: COLORS.amber,
    opacity: 0.2,
    stroke: COLORS.amber,
    strokeWidth: 1.1,
  };
}

function safeEvaluate(fn: (x: number) => number, x: number): number {
  try {
    const value = fn(x);
    return Number.isFinite(value) ? value : Number.NaN;
  } catch {
    return Number.NaN;
  }
}

function resolveExpression(
  expressionId: string | null,
  expressions: CompiledExpression[],
  expressionMap: Map<string, CompiledExpression>,
): CompiledExpression | null {
  if (!expressionId) {
    return null;
  }

  return expressionMap.get(expressionId) ?? expressions.find((expression) => expression.id === expressionId) ?? null;
}

interface BetweenSegment {
  left: number;
  right: number;
  topExpression: CompiledExpression;
  bottomExpression: CompiledExpression;
  topFn: (x: number) => number;
  bottomFn: (x: number) => number;
}

function mergeBetweenSegments(segments: BetweenSegment[]): BetweenSegment[] {
  if (!segments.length) {
    return [];
  }

  const merged: BetweenSegment[] = [segments[0]];

  for (let index = 1; index < segments.length; index += 1) {
    const current = segments[index];
    const previous = merged[merged.length - 1];

    if (
      previous.topExpression.id === current.topExpression.id &&
      previous.bottomExpression.id === current.bottomExpression.id &&
      Math.abs(previous.right - current.left) < 1e-6
    ) {
      previous.right = current.right;
      continue;
    }

    merged.push(current);
  }

  return merged;
}

function expressionDisplayLabel(expression: CompiledExpression): string {
  return `${expression.orientation === "xOfY" ? "x" : "y"} = ${formatExpressionText(expression.normalized)}`;
}

function buildBetweenFormulaTex(segments: BetweenSegment[]): string | null {
  if (!segments.length) {
    return null;
  }

  return segments
    .map((segment) => {
      const left = formatNumber(segment.left, 3);
      const right = formatNumber(segment.right, 3);
      const topTex = expressionToTex(segment.topExpression.normalized);
      const bottomTex = expressionToTex(segment.bottomExpression.normalized);
      return `\\int_{${left}}^{${right}} \\left(${topTex} - ${bottomTex}\\right)\\,dx`;
    })
    .join(" + ");
}

function buildBetweenFormulaSteps(segments: BetweenSegment[], area: number, signedDifference: number): string[] {
  if (!segments.length) {
    return [];
  }

  const steps = segments.map((segment, index) => {
    const left = formatNumber(segment.left, 3);
    const right = formatNumber(segment.right, 3);
    const topTex = expressionToTex(segment.topExpression.normalized);
    const bottomTex = expressionToTex(segment.bottomExpression.normalized);
    return `S_${index + 1} = \\int_{${left}}^{${right}} \\left(${topTex} - ${bottomTex}\\right)\\,dx`;
  });

  steps.push(`S = ${formatNumber(area)}`);
  if (Number.isFinite(signedDifference)) {
    steps.push(`\\int_a^b \\bigl(f(x)-g(x)\\bigr)\\,dx = ${formatNumber(signedDifference)}`);
  }
  return steps;
}

interface UnderOverlaySnapshot {
  regions: GraphRegion[];
  roots: number[];
  breaks: number[];
  signedIntegral: ImproperIntegralEstimate;
  geometricArea: ImproperIntegralEstimate;
  points: GraphPoint[];
}

interface ImproperIntegralEstimate {
  value: number;
  converges: boolean;
  improperAtBoundary: boolean;
}

function isBoundarySingular(
  fn: (x: number) => number,
  boundary: number,
  oppositeBoundary: number,
): boolean {
  const boundaryValue = fn(boundary);
  if (!Number.isFinite(boundaryValue)) {
    return true;
  }

  const width = Math.abs(oppositeBoundary - boundary);
  if (width <= 1e-6) {
    return false;
  }

  const direction = oppositeBoundary >= boundary ? 1 : -1;
  const offsets = [width / 4096, width / 2048, width / 1024];

  return offsets.some((offset) => {
    const x = boundary + direction * Math.max(offset, 1e-6);
    return !Number.isFinite(fn(x));
  });
}

function estimateBoundaryImproperIntegral(
  fn: (x: number) => number,
  a: number,
  b: number,
): ImproperIntegralEstimate {
  const [left, right] = sortAB(a, b);
  const width = right - left;

  if (width <= 1e-6) {
    return {
      value: 0,
      converges: true,
      improperAtBoundary: false,
    };
  }

  const leftSingular = isBoundarySingular(fn, left, right);
  const rightSingular = isBoundarySingular(fn, right, left);

  if (!leftSingular && !rightSingular) {
    const value = midpointIntegral(fn, a, b);
    return {
      value,
      converges: Number.isFinite(value),
      improperAtBoundary: false,
    };
  }

  const truncatedValues: number[] = [];
  const startPower = 5;
  const levels = 12;

  for (let level = 0; level < levels; level += 1) {
    const epsilonLeft = leftSingular ? width / 2 ** (startPower + level) : 0;
    const epsilonRight = rightSingular ? width / 2 ** (startPower + level) : 0;
    const start = left + epsilonLeft;
    const end = right - epsilonRight;

    if (!(end > start)) {
      break;
    }

    const value = midpointIntegral(fn, start, end, 2400);
    if (!Number.isFinite(value)) {
      return {
        value: Number.NaN,
        converges: false,
        improperAtBoundary: true,
      };
    }

    truncatedValues.push(value);
  }

  if (truncatedValues.length < 4) {
    return {
      value: Number.NaN,
      converges: false,
      improperAtBoundary: true,
    };
  }

  const deltas = truncatedValues.slice(1).map((value, index) => Math.abs(value - truncatedValues[index]));
  const tailWindow = deltas.slice(-4);
  const converges = tailWindow.length > 0 && Math.max(...tailWindow) < 0.02;

  return {
    value: truncatedValues[truncatedValues.length - 1],
    converges,
    improperAtBoundary: true,
  };
}

function formatIntegralEstimate(estimate: ImproperIntegralEstimate, digits = 5): string {
  return estimate.converges ? formatNumber(estimate.value, digits) : "расходится";
}

function integralEstimateTex(estimate: ImproperIntegralEstimate, digits = 5): string {
  return estimate.converges ? formatNumber(estimate.value, digits) : "\\text{расходится}";
}

function buildUnderSnapshot(fn: (x: number) => number, a: number, b: number): UnderOverlaySnapshot {
  const roots = findRoots(fn, a, b);
  const breaks = findDiscontinuityBreaks(fn, a, b);
  const intervals = buildIntervals(a, b, uniqueSorted([...roots, ...breaks]));
  const regions: GraphRegion[] = [];

  for (const [left, right] of intervals) {
    const midpoint = (left + right) / 2;
    const sample = fn(midpoint);
    if (!Number.isFinite(sample)) {
      continue;
    }

    const positive = sample >= 0;
    regions.push({
      x1: left,
      x2: right,
      topFn: positive ? fn : () => 0,
      bottomFn: positive ? () => 0 : fn,
      fill: positive ? COLORS.blue : COLORS.rose,
      opacity: 0.2,
      stroke: positive ? COLORS.blue : COLORS.rose,
      strokeWidth: 1,
    });
  }

  const signedIntegral = estimateBoundaryImproperIntegral(fn, a, b);
  const geometricArea = estimateBoundaryImproperIntegral((x) => Math.abs(fn(x)), a, b);
  const points = roots
    .map((x) => ({ x, y: 0, color: COLORS.violet, label: `x=${formatNumber(x, 3)}` }))
    .filter((point) => point.x >= a && point.x <= b);

  return {
    regions,
    roots,
    breaks,
    signedIntegral,
    geometricArea,
    points,
  };
}

export function buildOverlay(
  rawTool: Partial<ToolState>,
  validExpressions: CompiledExpression[],
  validMap: Map<string, CompiledExpression>,
): OverlayData {
  try {
    const expressions = Array.isArray(validExpressions) ? validExpressions : [];
    const expressionMap =
      validMap instanceof Map ? validMap : new Map(expressions.map((expression) => [expression.id, expression]));
    const tool = normalizeTool(rawTool ?? {}, expressions);
    const [a, b] = sortAB(tool.a, tool.b);

    if (tool.mode === "none") {
      return emptyOverlay(
        expressions.length
          ? "\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0438\u043d\u0441\u0442\u0440\u0443\u043c\u0435\u043d\u0442 \u0441\u043f\u0440\u0430\u0432\u0430, \u0447\u0442\u043e\u0431\u044b \u043f\u043e\u0441\u0442\u0440\u043e\u0438\u0442\u044c \u043e\u0431\u043b\u0430\u0441\u0442\u044c \u0438\u043b\u0438 \u0447\u0438\u0441\u043b\u0435\u043d\u043d\u043e\u0435 \u043f\u0440\u0438\u0431\u043b\u0438\u0436\u0435\u043d\u0438\u0435."
          : "\u0414\u043e\u0431\u0430\u0432\u044c\u0442\u0435 \u0445\u043e\u0442\u044f \u0431\u044b \u043e\u0434\u043d\u0443 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u0443\u044e \u0444\u0443\u043d\u043a\u0446\u0438\u044e.",
      );
    }

    const expressionA = resolveExpression(tool.exprA, expressions, expressionMap);
    const expressionB = resolveExpression(tool.exprB, expressions, expressionMap);
    if (expressionA && expressionA.orientation !== "yOfX") {
      return emptyOverlay("\u0418\u043d\u0441\u0442\u0440\u0443\u043c\u0435\u043d\u0442\u044b \u0438\u043d\u0442\u0435\u0433\u0440\u0430\u043b\u0430 \u0438 \u043e\u0431\u044a\u0435\u043c\u0430 \u0441\u0435\u0439\u0447\u0430\u0441 \u0440\u0430\u0431\u043e\u0442\u0430\u044e\u0442 \u0442\u043e\u043b\u044c\u043a\u043e \u0434\u043b\u044f y = f(x).");
    }
    if (expressionB && expressionB.orientation !== "yOfX") {
      return emptyOverlay("\u0420\u0435\u0436\u0438\u043c \u043c\u0435\u0436\u0434\u0443 \u0433\u0440\u0430\u0444\u0438\u043a\u0430\u043c\u0438 \u0441\u0435\u0439\u0447\u0430\u0441 \u0440\u0430\u0431\u043e\u0442\u0430\u0435\u0442 \u0442\u043e\u043b\u044c\u043a\u043e \u0434\u043b\u044f y = f(x).");
    }
    const fnA = expressionA ? (x: number) => safeEvaluate(expressionA.evaluate, x) : null;
    const fnB = expressionB ? (x: number) => safeEvaluate(expressionB.evaluate, x) : null;

    if (tool.mode === "under") {
      if (!fnA) {
        return emptyOverlay("\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u0443\u044e \u0444\u0443\u043d\u043a\u0446\u0438\u044e \u0434\u043b\u044f \u043f\u043b\u043e\u0449\u0430\u0434\u0438 \u043f\u043e\u0434 \u0433\u0440\u0430\u0444\u0438\u043a\u043e\u043c.");
      }
      const snapshot = buildUnderSnapshot(fnA, a, b);
      const texA = expressionA ? expressionToTex(expressionA.normalized) : "f(x)";
      const hasFiniteValues = snapshot.signedIntegral.converges || snapshot.geometricArea.converges;
      const divergenceExplanation =
        !snapshot.signedIntegral.converges || !snapshot.geometricArea.converges
          ? [
              "\u0423 \u0433\u0440\u0430\u043d\u0438\u0446\u044b \u0435\u0441\u0442\u044c \u043d\u0435\u0441\u043e\u0431\u0441\u0442\u0432\u0435\u043d\u043d\u0430\u044f \u043e\u0441\u043e\u0431\u0435\u043d\u043d\u043e\u0441\u0442\u044c, \u0438 \u0443\u0441\u0435\u0447\u0451\u043d\u043d\u044b\u0435 \u0438\u043d\u0442\u0435\u0433\u0440\u0430\u043b\u044b \u043d\u0435 \u0441\u0442\u0430\u0431\u0438\u043b\u0438\u0437\u0438\u0440\u0443\u044e\u0442\u0441\u044f.",
              "\u041f\u043e\u044d\u0442\u043e\u043c\u0443 \u0438 \u043f\u043e\u0434\u043f\u0438\u0441\u0430\u043d\u043d\u044b\u0439 \u0438\u043d\u0442\u0435\u0433\u0440\u0430\u043b, \u0438 \u0433\u0435\u043e\u043c\u0435\u0442\u0440\u0438\u0447\u0435\u0441\u043a\u0430\u044f \u043f\u043b\u043e\u0449\u0430\u0434\u044c \u043f\u043e\u043c\u0435\u0447\u0430\u044e\u0442\u0441\u044f \u043a\u0430\u043a \u0440\u0430\u0441\u0445\u043e\u0434\u044f\u0449\u0438\u0435\u0441\u044f.",
            ]
          : snapshot.signedIntegral.improperAtBoundary || snapshot.geometricArea.improperAtBoundary
            ? [
                "\u041d\u0430 \u0433\u0440\u0430\u043d\u0438\u0446\u0435 \u0435\u0441\u0442\u044c \u043d\u0435\u0441\u043e\u0431\u0441\u0442\u0432\u0435\u043d\u043d\u0430\u044f \u043e\u0441\u043e\u0431\u0435\u043d\u043d\u043e\u0441\u0442\u044c, \u043d\u043e \u0443\u0441\u0435\u0447\u0451\u043d\u043d\u044b\u0435 \u0438\u043d\u0442\u0435\u0433\u0440\u0430\u043b\u044b \u0441\u0442\u0430\u0431\u0438\u043b\u0438\u0437\u0438\u0440\u0443\u044e\u0442\u0441\u044f, \u043f\u043e\u044d\u0442\u043e\u043c\u0443 \u043d\u0435\u0441\u043e\u0431\u0441\u0442\u0432\u0435\u043d\u043d\u044b\u0439 \u0438\u043d\u0442\u0435\u0433\u0440\u0430\u043b \u0441\u0445\u043e\u0434\u0438\u0442\u0441\u044f.",
              ]
            : [];

      return {
        regions: snapshot.regions,
        polygons: [],
        polylines: [],
        points: snapshot.points,
        verticals: buildVerticals(a, b),
        metrics: withOptionalStatus(
          [
            {
              label: "\u041f\u043e\u0434\u043f\u0438\u0441\u0430\u043d\u043d\u044b\u0439 \u0438\u043d\u0442\u0435\u0433\u0440\u0430\u043b",
              value: formatIntegralEstimate(snapshot.signedIntegral),
              tone: "blue",
            },
            {
              label: "\u0413\u0435\u043e\u043c\u0435\u0442\u0440\u0438\u0447\u0435\u0441\u043a\u0430\u044f \u043f\u043b\u043e\u0449\u0430\u0434\u044c",
              value: formatIntegralEstimate(snapshot.geometricArea),
              tone: "emerald",
            },
            { label: "\u0418\u043d\u0442\u0435\u0440\u0432\u0430\u043b", value: `[${formatNumber(a, 3)}; ${formatNumber(b, 3)}]`, tone: "slate" },
            { label: "\u041a\u043e\u0440\u043d\u0438", value: String(snapshot.points.length), tone: "violet" },
          ],
          "\u041d\u0430 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u043c \u0438\u043d\u0442\u0435\u0440\u0432\u0430\u043b\u0435 \u043d\u0435\u0442 \u043a\u043e\u043d\u0435\u0447\u043d\u044b\u0445 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0439.",
          !snapshot.regions.length && !hasFiniteValues,
        ),
        formulaTex: "\\int_a^b f(x)\\,dx\\quad\\text{\u0438}\\quad\\int_a^b |f(x)|\\,dx",
        formulaSteps: [
          `\\int_{${formatNumber(a, 3)}}^{${formatNumber(b, 3)}} ${texA}\\,dx = ${integralEstimateTex(snapshot.signedIntegral)}`,
          `S_{\\text{geom}} = \\int_{${formatNumber(a, 3)}}^{${formatNumber(b, 3)}} \\left|${texA}\\right|\\,dx = ${integralEstimateTex(snapshot.geometricArea)}`,
        ],
        explanation: [
          "\u041f\u043e\u0434\u043f\u0438\u0441\u0430\u043d\u043d\u044b\u0439 \u0438\u043d\u0442\u0435\u0433\u0440\u0430\u043b \u0443\u0447\u0438\u0442\u044b\u0432\u0430\u0435\u0442, \u043b\u0435\u0436\u0438\u0442 \u043b\u0438 \u0433\u0440\u0430\u0444\u0438\u043a \u0432\u044b\u0448\u0435 \u0438\u043b\u0438 \u043d\u0438\u0436\u0435 \u043e\u0441\u0438 Ox.",
          "\u0413\u0435\u043e\u043c\u0435\u0442\u0440\u0438\u0447\u0435\u0441\u043a\u0430\u044f \u043f\u043b\u043e\u0449\u0430\u0434\u044c \u0441\u0447\u0438\u0442\u0430\u0435\u0442 \u0432\u0441\u0435 \u0443\u0447\u0430\u0441\u0442\u043a\u0438 \u043a\u0430\u043a \u043f\u043e\u043b\u043e\u0436\u0438\u0442\u0435\u043b\u044c\u043d\u044b\u0435 \u043f\u043b\u043e\u0449\u0430\u0434\u0438.",
          ...divergenceExplanation,
        ],
        volumePreview: null,
      };
    }

    if (tool.mode === "between") {
      if (expressions.length < 2) {
        return emptyOverlay("\u0414\u043b\u044f \u044d\u0442\u043e\u0433\u043e \u0440\u0435\u0436\u0438\u043c\u0430 \u043d\u0443\u0436\u043d\u044b \u0434\u0432\u0435 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u044b\u0435 \u0444\u0443\u043d\u043a\u0446\u0438\u0438.");
      }
      if (!expressionA || !expressionB || !fnA || !fnB) {
        return emptyOverlay("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0432\u044b\u0431\u0440\u0430\u0442\u044c \u0434\u0432\u0435 \u0444\u0443\u043d\u043a\u0446\u0438\u0438 \u0434\u043b\u044f \u0440\u0435\u0436\u0438\u043c\u0430 \u043c\u0435\u0436\u0434\u0443 \u0433\u0440\u0430\u0444\u0438\u043a\u0430\u043c\u0438.");
      }
      const expressionANonNull: CompiledExpression = expressionA;
      const expressionBNonNull: CompiledExpression = expressionB;

      const diff = (x: number) => fnA(x) - fnB(x);
      const roots = findRoots(diff, a, b);
      const breaks = uniqueSorted([
        ...findDiscontinuityBreaks(fnA, a, b),
        ...findDiscontinuityBreaks(fnB, a, b),
        ...findDiscontinuityBreaks(diff, a, b),
      ]);
      const intervals = buildIntervals(a, b, uniqueSorted([...roots, ...breaks]));
      const regions: GraphRegion[] = [];
      const segments: BetweenSegment[] = [];

      for (const [left, right] of intervals) {
        const midpoint = (left + right) / 2;
        const sampleA = fnA(midpoint);
        const sampleB = fnB(midpoint);
        if (!Number.isFinite(sampleA) || !Number.isFinite(sampleB)) {
          continue;
        }

        const topFn = sampleA >= sampleB ? fnA : fnB;
        const bottomFn = sampleA >= sampleB ? fnB : fnA;
        regions.push({
          x1: left,
          x2: right,
          topFn,
          bottomFn,
          fill: COLORS.emerald,
          opacity: 0.2,
          stroke: COLORS.emerald,
          strokeWidth: 1,
        });
        segments.push({
          left,
          right,
          topExpression: sampleA >= sampleB ? expressionANonNull : expressionBNonNull,
          bottomExpression: sampleA >= sampleB ? expressionBNonNull : expressionANonNull,
          topFn,
          bottomFn,
        });
      }

      const intersections = findRoots(diff, a, b)
        .map((x) => {
          const y = fnA(x);
          return Number.isFinite(y)
            ? { x, y, label: `(${formatNumber(x, 3)}, ${formatNumber(y, 3)})`, color: COLORS.violet }
            : null;
        })
        .filter((point): point is NonNullable<typeof point> => point !== null);
      const mergedSegments = mergeBetweenSegments(segments);
      const area = mergedSegments.reduce((sum, segment) => {
        const contribution = midpointIntegral((x) => {
          const top = segment.topFn(x);
          const bottom = segment.bottomFn(x);
          return Number.isFinite(top) && Number.isFinite(bottom) ? top - bottom : Number.NaN;
        }, segment.left, segment.right);
        return Number.isFinite(contribution) ? sum + contribution : sum;
      }, 0);
      const signedDifference = midpointIntegral(diff, a, b);
      const orderingMetrics = mergedSegments.map((segment, index) => ({
        label:
          mergedSegments.length === 1
            ? "\u0412\u0435\u0440\u0445\u043d\u0438\u0439 \u0433\u0440\u0430\u0444\u0438\u043a"
            : `\u0412\u0435\u0440\u0445 \u043d\u0430 [${formatNumber(segment.left, 3)}; ${formatNumber(segment.right, 3)}]`,
        value: expressionDisplayLabel(segment.topExpression),
        tone: index % 2 === 0 ? ("blue" as const) : ("violet" as const),
      }));

      return {
        regions,
        polygons: [],
        polylines: [],
        points: intersections,
        verticals: buildVerticals(a, b),
        metrics: withOptionalStatus(
          [
            { label: "\u041f\u043b\u043e\u0449\u0430\u0434\u044c", value: formatNumber(area), tone: "emerald" },
            {
              label: "\u041f\u043e\u0434\u043f\u0438\u0441\u0430\u043d\u043d\u0430\u044f \u0440\u0430\u0437\u043d\u043e\u0441\u0442\u044c",
              value: formatNumber(signedDifference),
              tone: "blue",
            },
            { label: "\u0418\u043d\u0442\u0435\u0440\u0432\u0430\u043b", value: `[${formatNumber(a, 3)}; ${formatNumber(b, 3)}]`, tone: "slate" },
            { label: "\u041f\u0435\u0440\u0435\u0441\u0435\u0447\u0435\u043d\u0438\u044f", value: String(intersections.length), tone: "violet" },
            ...orderingMetrics,
          ],
          "\u041d\u0430 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u043c \u0438\u043d\u0442\u0435\u0440\u0432\u0430\u043b\u0435 \u043d\u0435\u0442 \u043a\u043e\u043d\u0435\u0447\u043d\u043e\u0439 \u043e\u0431\u043b\u0430\u0441\u0442\u0438 \u043c\u0435\u0436\u0434\u0443 \u0433\u0440\u0430\u0444\u0438\u043a\u0430\u043c\u0438.",
          !regions.length && !Number.isFinite(area),
        ),
        formulaTex: buildBetweenFormulaTex(mergedSegments),
        formulaSteps: buildBetweenFormulaSteps(mergedSegments, area, signedDifference),
        explanation: [
          "\u041d\u0430 \u043a\u0430\u0436\u0434\u043e\u043c \u0443\u0447\u0430\u0441\u0442\u043a\u0435 \u043f\u043b\u043e\u0449\u0430\u0434\u044c \u0441\u0447\u0438\u0442\u0430\u0435\u0442\u0441\u044f \u043a\u0430\u043a \u201c\u0432\u0435\u0440\u0445\u043d\u044f\u044f \u0444\u0443\u043d\u043a\u0446\u0438\u044f \u043c\u0438\u043d\u0443\u0441 \u043d\u0438\u0436\u043d\u044f\u044f\u201d.",
          "\u0415\u0441\u043b\u0438 \u0433\u0440\u0430\u0444\u0438\u043a\u0438 \u043c\u0435\u043d\u044f\u044e\u0442\u0441\u044f \u043c\u0435\u0441\u0442\u0430\u043c\u0438, \u0438\u043d\u0442\u0435\u0440\u0432\u0430\u043b \u043d\u0443\u0436\u043d\u043e \u0434\u0435\u043b\u0438\u0442\u044c \u043f\u043e \u0442\u043e\u0447\u043a\u0430\u043c \u043f\u0435\u0440\u0435\u0441\u0435\u0447\u0435\u043d\u0438\u044f.",
        ],
        volumePreview: null,
      };
    }

    if (tool.mode === "riemann") {
      if (!fnA) {
        return emptyOverlay("\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u0443\u044e \u0444\u0443\u043d\u043a\u0446\u0438\u044e \u0434\u043b\u044f \u0441\u0443\u043c\u043c \u0420\u0438\u043c\u0430\u043d\u0430.");
      }

      const width = (b - a) / tool.n;
      const polygons: GraphPolygon[] = [];
      const points: GraphPoint[] = [];
      let approx = 0;
      let used = 0;

      for (let index = 0; index < tool.n; index += 1) {
        const x1 = a + width * index;
        const x2 = x1 + width;
        const sampleX =
          tool.sample === "left"
            ? x1
            : tool.sample === "right"
              ? x2
              : (x1 + x2) / 2;
        const y = fnA(sampleX);
        if (!Number.isFinite(y)) {
          continue;
        }

        polygons.push(createRectangle(x1, x2, y));
        points.push({ x: sampleX, y, color: COLORS.violet, radius: 3.5 });
        approx += y * width;
        used += 1;
      }

      const exact = midpointIntegral(fnA, a, b);

      return {
        regions: [],
        polygons,
        polylines: [],
        points,
        verticals: buildVerticals(a, b),
        metrics: withOptionalStatus(
          [
            { label: "\u0421\u0443\u043c\u043c\u0430 \u0420\u0438\u043c\u0430\u043d\u0430", value: formatNumber(approx), tone: "blue" },
            { label: "\u0418\u043d\u0442\u0435\u0433\u0440\u0430\u043b", value: formatNumber(exact), tone: "emerald" },
            { label: "\u0410\u0431\u0441. \u043e\u0448\u0438\u0431\u043a\u0430", value: formatNumber(Math.abs(approx - exact)), tone: "rose" },
            { label: "n", value: String(tool.n), tone: "slate" },
            { label: "\u0412\u044b\u0431\u043e\u0440\u043a\u0430", value: tool.sample, tone: "violet" },
            { label: "\u041f\u0440\u044f\u043c\u043e\u0443\u0433\u043e\u043b\u044c\u043d\u0438\u043a\u043e\u0432", value: String(used), tone: "amber" },
          ],
          "\u041d\u0430 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u043c \u0440\u0430\u0437\u0431\u0438\u0435\u043d\u0438\u0438 \u043d\u0435\u0442 \u043a\u043e\u043d\u0435\u0447\u043d\u044b\u0445 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0439.",
          used === 0,
        ),
        formulaTex: "S_n = \\sum_{i=1}^{n} f(\\xi_i)\\,\\Delta x",
        formulaSteps: [
          "S_n = \\sum_{i=1}^{n} f(\\xi_i)\\,\\Delta x",
          `S_n \\approx ${formatNumber(approx)}`,
          `\\left|S_n - I\\right| = ${formatNumber(Math.abs(approx - exact))}`,
        ],
        explanation: [
          "\u0421\u0443\u043c\u043c\u0430 \u0420\u0438\u043c\u0430\u043d\u0430 \u0434\u0430\u0451\u0442 \u043f\u0440\u0438\u0431\u043b\u0438\u0436\u0435\u043d\u0438\u0435 \u0438\u043d\u0442\u0435\u0433\u0440\u0430\u043b\u0430 \u0447\u0435\u0440\u0435\u0437 \u043f\u0440\u044f\u043c\u043e\u0443\u0433\u043e\u043b\u044c\u043d\u0438\u043a\u0438.",
          "\u041f\u0440\u0438 \u0440\u043e\u0441\u0442\u0435 n \u044d\u0442\u043e \u043f\u0440\u0438\u0431\u043b\u0438\u0436\u0435\u043d\u0438\u0435 \u043e\u0431\u044b\u0447\u043d\u043e \u0441\u0442\u0430\u043d\u043e\u0432\u0438\u0442\u0441\u044f \u0442\u043e\u0447\u043d\u0435\u0435.",
        ],
        volumePreview: null,
      };
    }

    if (tool.mode === "trap") {
      if (!fnA) {
        return emptyOverlay("\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u0443\u044e \u0444\u0443\u043d\u043a\u0446\u0438\u044e \u0434\u043b\u044f \u043c\u0435\u0442\u043e\u0434\u0430 \u0442\u0440\u0430\u043f\u0435\u0446\u0438\u0439.");
      }

      const width = (b - a) / tool.n;
      const polygons: GraphPolygon[] = [];
      const polylines: GraphPolyline[] = [];
      const points: GraphPoint[] = [];
      let approx = 0;
      let used = 0;

      for (let index = 0; index < tool.n; index += 1) {
        const x1 = a + width * index;
        const x2 = x1 + width;
        const y1 = fnA(x1);
        const y2 = fnA(x2);
        if (!Number.isFinite(y1) || !Number.isFinite(y2)) {
          continue;
        }

        polygons.push(createTrapezoid(x1, y1, x2, y2));
        polylines.push({
          points: [{ x: x1, y: y1 }, { x: x2, y: y2 }],
          stroke: COLORS.amber,
          strokeWidth: 2,
        });
        approx += (y1 + y2) * width * 0.5;
        used += 1;
      }

      for (let index = 0; index <= tool.n; index += 1) {
        const x = a + width * index;
        const y = fnA(x);
        if (!Number.isFinite(y)) {
          continue;
        }
        points.push({ x, y, color: COLORS.amber, radius: 3.5 });
      }

      const exact = midpointIntegral(fnA, a, b);

      return {
        regions: [],
        polygons,
        polylines,
        points,
        verticals: buildVerticals(a, b),
        metrics: withOptionalStatus(
          [
            { label: "\u0422\u0440\u0430\u043f\u0435\u0446\u0438\u0438", value: formatNumber(approx), tone: "blue" },
            { label: "\u0418\u043d\u0442\u0435\u0433\u0440\u0430\u043b", value: formatNumber(exact), tone: "emerald" },
            { label: "\u0410\u0431\u0441. \u043e\u0448\u0438\u0431\u043a\u0430", value: formatNumber(Math.abs(approx - exact)), tone: "rose" },
            { label: "n", value: String(tool.n), tone: "slate" },
            { label: "\u0428\u0430\u0433 h", value: formatNumber(width), tone: "amber" },
            { label: "\u0422\u0440\u0430\u043f\u0435\u0446\u0438\u0439", value: String(used), tone: "violet" },
          ],
          "\u041d\u0430 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u043c \u0438\u043d\u0442\u0435\u0440\u0432\u0430\u043b\u0435 \u043d\u0435\u0442 \u043a\u043e\u043d\u0435\u0447\u043d\u044b\u0445 \u0442\u0440\u0430\u043f\u0435\u0446\u0438\u0439.",
          used === 0,
        ),
        formulaTex:
          "\\int_a^b f(x)\\,dx \\approx \\frac{h}{2}\\bigl(f(x_0)+2\\sum_{i=1}^{n-1}f(x_i)+f(x_n)\\bigr)",
        formulaSteps: [
          "\\int_a^b f(x)\\,dx \\approx \\frac{h}{2}\\bigl(f(x_0)+2\\sum_{i=1}^{n-1}f(x_i)+f(x_n)\\bigr)",
          `T_n \\approx ${formatNumber(approx)}`,
          `\\left|T_n - I\\right| = ${formatNumber(Math.abs(approx - exact))}`,
        ],
        explanation: [
          "\u041c\u0435\u0442\u043e\u0434 \u0442\u0440\u0430\u043f\u0435\u0446\u0438\u0439 \u0437\u0430\u043c\u0435\u043d\u044f\u0435\u0442 \u0434\u0443\u0433\u0443 \u0433\u0440\u0430\u0444\u0438\u043a\u0430 \u043d\u0430 \u043a\u0430\u0436\u0434\u043e\u043c \u0448\u0430\u0433\u0435 \u043e\u0442\u0440\u0435\u0437\u043a\u043e\u043c.",
          "\u0427\u0438\u0441\u043b\u0435\u043d\u043d\u043e\u0435 \u043f\u0440\u0438\u0431\u043b\u0438\u0436\u0435\u043d\u0438\u0435 \u0443\u043b\u0443\u0447\u0448\u0430\u0435\u0442\u0441\u044f \u043f\u0440\u0438 \u0443\u043c\u0435\u043d\u044c\u0448\u0435\u043d\u0438\u0438 \u0448\u0430\u0433\u0430 h.",
        ],
        volumePreview: null,
      };
    }

    if (tool.mode === "newtonLeibniz") {
      if (!fnA) {
        return emptyOverlay("\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u0443\u044e \u0444\u0443\u043d\u043a\u0446\u0438\u044e \u0434\u043b\u044f \u0440\u0435\u0436\u0438\u043c\u0430 \u041d\u044c\u044e\u0442\u043e\u043d\u0430-\u041b\u0435\u0439\u0431\u043d\u0438\u0446\u0430.");
      }

      const snapshot = buildUnderSnapshot(fnA, a, b);
      const texA = expressionA ? expressionToTex(expressionA.normalized) : "f(x)";

      return {
        regions: snapshot.regions,
        polygons: [],
        polylines: [],
        points: snapshot.points,
        verticals: buildVerticals(a, b),
        metrics: withOptionalStatus(
          [
            { label: "\u0418\u043d\u0442\u0435\u0433\u0440\u0430\u043b", value: formatIntegralEstimate(snapshot.signedIntegral), tone: "blue" },
            { label: "\u0418\u043d\u0442\u0435\u0440\u0432\u0430\u043b", value: `[${formatNumber(a, 3)}; ${formatNumber(b, 3)}]`, tone: "slate" },
            { label: "\u041a\u043e\u0440\u043d\u0438", value: String(snapshot.points.length), tone: "violet" },
          ],
          "\u041d\u0430 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u043c \u0438\u043d\u0442\u0435\u0440\u0432\u0430\u043b\u0435 \u043d\u0435\u0442 \u043a\u043e\u043d\u0435\u0447\u043d\u044b\u0445 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0439.",
          !snapshot.regions.length && !snapshot.signedIntegral.converges,
        ),
        formulaTex: `\\int_{${formatNumber(a, 3)}}^{${formatNumber(b, 3)}} ${texA}\\,dx = F(${formatNumber(b, 3)}) - F(${formatNumber(a, 3)})`,
        formulaSteps: [
          `\\int_{${formatNumber(a, 3)}}^{${formatNumber(b, 3)}} ${texA}\\,dx = F(${formatNumber(b, 3)}) - F(${formatNumber(a, 3)})`,
          `\\int_{${formatNumber(a, 3)}}^{${formatNumber(b, 3)}} ${texA}\\,dx \\approx ${integralEstimateTex(snapshot.signedIntegral)}`,
        ],
        explanation: [
          "\u0420\u0435\u0436\u0438\u043c \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u0442 \u0438\u0434\u0435\u044e \u0444\u043e\u0440\u043c\u0443\u043b\u044b \u041d\u044c\u044e\u0442\u043e\u043d\u0430-\u041b\u0435\u0439\u0431\u043d\u0438\u0446\u0430: \u0438\u043d\u0442\u0435\u0433\u0440\u0430\u043b \u0440\u0430\u0432\u0435\u043d \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044e \u043f\u0435\u0440\u0432\u043e\u043e\u0431\u0440\u0430\u0437\u043d\u043e\u0439 \u043d\u0430 \u043a\u043e\u043d\u0446\u0430\u0445 \u043e\u0442\u0440\u0435\u0437\u043a\u0430.",
          "\u0421\u0438\u043c\u0432\u043e\u043b\u0438\u0447\u0435\u0441\u043a\u0430\u044f \u043f\u0435\u0440\u0432\u043e\u043e\u0431\u0440\u0430\u0437\u043d\u0430\u044f \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438 \u043d\u0435 \u0441\u0442\u0440\u043e\u0438\u0442\u0441\u044f: \u0441\u0435\u0439\u0447\u0430\u0441 \u0440\u0435\u0436\u0438\u043c \u0434\u0430\u0451\u0442 \u0432\u0438\u0437\u0443\u0430\u043b\u0438\u0437\u0430\u0446\u0438\u044e \u0438 \u0447\u0438\u0441\u043b\u0435\u043d\u043d\u044b\u0439 \u0438\u0442\u043e\u0433.",
        ],
        volumePreview: null,
      };
    }

    if (tool.mode === "averageValue") {
      if (!fnA) {
        return emptyOverlay("\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u0443\u044e \u0444\u0443\u043d\u043a\u0446\u0438\u044e \u0434\u043b\u044f \u0440\u0435\u0436\u0438\u043c\u0430 \u0441\u0440\u0435\u0434\u043d\u0435\u0433\u043e \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u044f.");
      }
      if (Math.abs(b - a) < 1e-6) {
        return emptyOverlay("\u0414\u043b\u044f \u0441\u0440\u0435\u0434\u043d\u0435\u0433\u043e \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u044f \u043d\u0443\u0436\u0435\u043d \u043d\u0435\u043d\u0443\u043b\u0435\u0432\u043e\u0439 \u0438\u043d\u0442\u0435\u0440\u0432\u0430\u043b.");
      }

      const snapshot = buildUnderSnapshot(fnA, a, b);
      const integral = snapshot.signedIntegral;
      const averageValue = integral.converges ? integral.value / (b - a) : Number.NaN;
      const texA = expressionA ? expressionToTex(expressionA.normalized) : "f(x)";
      const averageFn = () => averageValue;
      const averageRegion: GraphRegion[] = Number.isFinite(averageValue)
        ? [
            {
              x1: a,
              x2: b,
              topFn: averageValue >= 0 ? averageFn : () => 0,
              bottomFn: averageValue >= 0 ? () => 0 : averageFn,
              fill: COLORS.amber,
              opacity: 0.2,
              stroke: COLORS.amber,
              strokeWidth: 1,
            },
          ]
        : [];
      const polylines: GraphPolyline[] = Number.isFinite(averageValue)
        ? [
            {
              points: [
                { x: a, y: averageValue },
                { x: b, y: averageValue },
              ],
              stroke: COLORS.amber,
              strokeWidth: 2.2,
              dash: [8, 6],
            },
          ]
        : [];
      const points: GraphPoint[] = Number.isFinite(averageValue)
        ? [...snapshot.points, { x: b, y: averageValue, label: `f_avg=${formatNumber(averageValue, 3)}`, color: COLORS.amber, radius: 4 }]
        : snapshot.points;

      return {
        regions: [...snapshot.regions, ...averageRegion],
        polygons: [],
        polylines,
        points,
        verticals: buildVerticals(a, b),
        metrics: withOptionalStatus(
          [
            { label: "\u0421\u0440\u0435\u0434\u043d\u0435\u0435 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435", value: formatNumber(averageValue), tone: "amber" },
            { label: "\u0418\u043d\u0442\u0435\u0433\u0440\u0430\u043b", value: formatIntegralEstimate(integral), tone: "blue" },
            { label: "\u0418\u043d\u0442\u0435\u0440\u0432\u0430\u043b", value: `[${formatNumber(a, 3)}; ${formatNumber(b, 3)}]`, tone: "slate" },
          ],
          "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u043e \u043e\u0446\u0435\u043d\u0438\u0442\u044c \u0441\u0440\u0435\u0434\u043d\u0435\u0435 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435.",
          !snapshot.regions.length && !Number.isFinite(averageValue),
        ),
        formulaTex: `f_{\\text{avg}} = \\frac{1}{${formatNumber(b - a, 3)}}\\int_{${formatNumber(a, 3)}}^{${formatNumber(b, 3)}} ${texA}\\,dx`,
        formulaSteps: [
          `f_{\\text{avg}} = \\frac{1}{${formatNumber(b - a, 3)}}\\int_{${formatNumber(a, 3)}}^{${formatNumber(b, 3)}} ${texA}\\,dx`,
          `f_{\\text{avg}} = \\frac{${integralEstimateTex(integral)}}{${formatNumber(b - a, 3)}}`,
          `f_{\\text{avg}} = ${Number.isFinite(averageValue) ? formatNumber(averageValue) : "\\text{расходится}"}`,
        ],
        explanation: [
          "\u0421\u0440\u0435\u0434\u043d\u0435\u0435 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435 \u0444\u0443\u043d\u043a\u0446\u0438\u0438 \u2014 \u044d\u0442\u043e \u0442\u0430\u043a\u0430\u044f \u0432\u044b\u0441\u043e\u0442\u0430 \u043f\u0440\u044f\u043c\u043e\u0443\u0433\u043e\u043b\u044c\u043d\u0438\u043a\u0430 \u043d\u0430 \u0442\u043e\u043c \u0436\u0435 \u043e\u0441\u043d\u043e\u0432\u0430\u043d\u0438\u0438, \u043f\u0440\u0438 \u043a\u043e\u0442\u043e\u0440\u043e\u0439 \u043f\u043b\u043e\u0449\u0430\u0434\u044c \u0441\u043e\u0432\u043f\u0430\u0434\u0430\u0435\u0442.",
          "\u0421\u0438\u043d\u044f\u044f/\u0440\u043e\u0437\u043e\u0432\u0430\u044f \u0437\u0430\u043a\u0440\u0430\u0441\u043a\u0430 \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u0442 \u043e\u0431\u043b\u0430\u0441\u0442\u044c \u043f\u043e\u0434 \u0433\u0440\u0430\u0444\u0438\u043a\u043e\u043c, \u0430 \u044f\u043d\u0442\u0430\u0440\u043d\u044b\u0439 \u0441\u043b\u043e\u0439 \u2014 \u043f\u0440\u044f\u043c\u043e\u0443\u0433\u043e\u043b\u044c\u043d\u0438\u043a \u0441\u0440\u0435\u0434\u043d\u0435\u0439 \u0432\u044b\u0441\u043e\u0442\u044b.",
          "\u0412 \u043c\u0435\u0441\u0442\u0430\u0445 \u043d\u0430\u043b\u043e\u0436\u0435\u043d\u0438\u044f \u0441\u043b\u043e\u0451\u0432 \u043f\u043e\u044f\u0432\u043b\u044f\u0435\u0442\u0441\u044f \u0442\u0440\u0435\u0442\u0438\u0439 \u043e\u0442\u0442\u0435\u043d\u043e\u043a, \u043a\u043e\u0442\u043e\u0440\u044b\u0439 \u043d\u0430\u0433\u043b\u044f\u0434\u043d\u043e \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u0442 \u0441\u043e\u0432\u043f\u0430\u0434\u0430\u044e\u0449\u0443\u044e \u0447\u0430\u0441\u0442\u044c \u043f\u043b\u043e\u0449\u0430\u0434\u0435\u0439.",
        ],
        volumePreview: null,
      };
    }

    if (tool.mode === "volume") {
      if (!fnA) {
        return emptyOverlay("\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u0443\u044e \u0444\u0443\u043d\u043a\u0446\u0438\u044e \u0434\u043b\u044f \u043e\u0431\u044a\u0435\u043c\u0430 \u0432\u0440\u0430\u0449\u0435\u043d\u0438\u044f.");
      }

      const roots = findRoots(fnA, a, b);
      const breaks = findDiscontinuityBreaks(fnA, a, b);
      const intervals = buildIntervals(a, b, uniqueSorted([...roots, ...breaks]));
      const regions: GraphRegion[] = [];

      for (const [left, right] of intervals) {
        const midpoint = (left + right) / 2;
        const sample = fnA(midpoint);
        if (!Number.isFinite(sample)) {
          continue;
        }

        const positive = sample >= 0;
        regions.push({
          x1: left,
          x2: right,
          topFn: positive ? fnA : () => 0,
          bottomFn: positive ? () => 0 : fnA,
          fill: COLORS.violet,
          opacity: 0.18,
          stroke: COLORS.violet,
          strokeWidth: 1,
        });
      }

      if (breaks.length > 0) {
        return {
          regions,
          polygons: [],
          polylines: [],
          points: [],
          verticals: buildVerticals(a, b),
          metrics: [
            { label: "\u0418\u043d\u0442\u0435\u0440\u0432\u0430\u043b", value: `[${formatNumber(a, 3)}; ${formatNumber(b, 3)}]`, tone: "slate" },
            { label: "\u0420\u0430\u0437\u0440\u044b\u0432\u044b", value: String(breaks.length), tone: "rose" },
            {
              label: "\u0421\u0442\u0430\u0442\u0443\u0441",
              value: "\u041d\u0430 \u0438\u043d\u0442\u0435\u0440\u0432\u0430\u043b\u0435 \u0435\u0441\u0442\u044c \u0440\u0430\u0437\u0440\u044b\u0432\u044b, \u043f\u043e\u044d\u0442\u043e\u043c\u0443 \u0435\u0434\u0438\u043d\u043e\u0435 \u0442\u0435\u043b\u043e \u0432\u0440\u0430\u0449\u0435\u043d\u0438\u044f \u043d\u0435 \u0441\u0442\u0440\u043e\u0438\u0442\u0441\u044f.",
              tone: "rose",
            },
          ],
          formulaTex: "V = \\pi \\int_a^b (f(x))^2\\,dx",
          formulaSteps: ["V = \\pi \\int_a^b (f(x))^2\\,dx"],
          explanation: [
            "\u041d\u0430 \u0438\u043d\u0442\u0435\u0440\u0432\u0430\u043b\u0435 \u0435\u0441\u0442\u044c \u0440\u0430\u0437\u0440\u044b\u0432\u044b, \u043f\u043e\u044d\u0442\u043e\u043c\u0443 \u0435\u0434\u0438\u043d\u043e\u0435 \u0442\u0435\u043b\u043e \u0432\u0440\u0430\u0449\u0435\u043d\u0438\u044f \u043d\u0435 \u0441\u0442\u0440\u043e\u0438\u0442\u0441\u044f \u0431\u0435\u0437 \u0434\u043e\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0433\u043e \u0440\u0430\u0437\u0431\u0438\u0435\u043d\u0438\u044f.",
          ],
          volumePreview: null,
        };
      }

      const volume = Math.PI * midpointIntegral((x) => {
        const y = fnA(x);
        return Number.isFinite(y) ? y * y : Number.NaN;
      }, a, b);
      const slices = Array.from({ length: 36 }, (_, index) => {
        const x = a + ((b - a) * index) / 35;
        const y = fnA(x);
        return { x, r: Number.isFinite(y) ? Math.abs(y) : 0 };
      });
      const sampleX = a + (b - a) * 0.58;
      const sampleY = fnA(sampleX);
      const sampleR = Number.isFinite(sampleY) ? Math.abs(sampleY) : 0;

      return {
        regions,
        polygons: [],
        polylines: [],
        points: sampleR > 0 ? [{ x: sampleX, y: sampleY, color: COLORS.violet, label: "r" }] : [],
        verticals: buildVerticals(a, b),
        metrics: withOptionalStatus(
          [
            { label: "\u041e\u0431\u044a\u0435\u043c", value: formatNumber(volume), tone: "violet" },
            { label: "\u0420\u0430\u0434\u0438\u0443\u0441 \u0441\u0435\u0447\u0435\u043d\u0438\u044f", value: formatNumber(sampleR), tone: "amber" },
            { label: "\u0418\u043d\u0442\u0435\u0440\u0432\u0430\u043b", value: `[${formatNumber(a, 3)}; ${formatNumber(b, 3)}]`, tone: "slate" },
          ],
          "\u041d\u0430 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u043c \u0438\u043d\u0442\u0435\u0440\u0432\u0430\u043b\u0435 \u043d\u0435\u0442 \u043a\u043e\u043d\u0435\u0447\u043d\u044b\u0445 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0439 \u0434\u043b\u044f \u043f\u043e\u0441\u0442\u0440\u043e\u0435\u043d\u0438\u044f \u0442\u0435\u043b\u0430 \u0432\u0440\u0430\u0449\u0435\u043d\u0438\u044f.",
          !Number.isFinite(volume),
        ),
        formulaTex: "V = \\pi \\int_a^b (f(x))^2\\,dx",
        formulaSteps: [
          "V = \\pi \\int_a^b (f(x))^2\\,dx",
          `V \\approx ${formatNumber(volume)}`,
        ],
        explanation: [
          "\u041e\u0431\u044a\u0451\u043c \u0441\u0442\u0440\u043e\u0438\u0442\u0441\u044f \u043a\u0430\u043a \u0441\u0443\u043c\u043c\u0430 \u0442\u043e\u043d\u043a\u0438\u0445 \u043a\u0440\u0443\u0433\u043e\u0432\u044b\u0445 \u0441\u0435\u0447\u0435\u043d\u0438\u0439 \u0440\u0430\u0434\u0438\u0443\u0441\u0430 |f(x)|.",
          "\u0412 \u043f\u0440\u0435\u0434\u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440\u0435 \u043f\u043e\u043a\u0430\u0437\u0430\u043d\u043e, \u043a\u0430\u043a \u0432\u044b\u0433\u043b\u044f\u0434\u044f\u0442 \u0442\u0430\u043a\u0438\u0435 \u0441\u0435\u0447\u0435\u043d\u0438\u044f \u043d\u0430 \u0432\u0441\u0451\u043c \u043e\u0442\u0440\u0435\u0437\u043a\u0435.",
        ],
        volumePreview: {
          a,
          b,
          sampleX,
          sampleR,
          slices,
        },
      };
    }

    return emptyOverlay("\u041d\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043d\u044b\u0439 \u0440\u0435\u0436\u0438\u043c \u0438\u043d\u0441\u0442\u0440\u0443\u043c\u0435\u043d\u0442\u0430.");
  } catch {
    return emptyOverlay("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043f\u043e\u0441\u0442\u0440\u043e\u0438\u0442\u044c overlay \u0434\u043b\u044f \u0442\u0435\u043a\u0443\u0449\u0435\u0433\u043e \u0441\u043e\u0441\u0442\u043e\u044f\u043d\u0438\u044f.");
  }
}

