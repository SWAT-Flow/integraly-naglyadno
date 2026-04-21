import { COLORS } from "../constants";
import { estimatePreviewBounds, formatBoundTex, formatBoundText, formatIntervalText, hasInfiniteBounds, orderBounds } from "../math/bounds";
import { buildIntervals, findRoots, findSingularityCandidates, midpointIntegral, sortAB, uniqueSorted } from "../math/numeric";
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
  const verticals: OverlayData["verticals"] = [];
  if (Number.isFinite(a)) {
    verticals.push({ x: a, label: "a", color: COLORS.slate, dash: [6, 6] });
  }
  if (Number.isFinite(b)) {
    verticals.push({ x: b, label: "b", color: COLORS.slate, dash: [6, 6] });
  }
  return verticals;
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

function buildBetweenGeneralFormula(expressionA: CompiledExpression, expressionB: CompiledExpression, a: number, b: number): string {
  const texA = expressionToTex(expressionA.normalized);
  const texB = expressionToTex(expressionB.normalized);
  return `S = \\int_{${formatBoundTex(a, 3)}}^{${formatBoundTex(b, 3)}} \\left|${texA} - ${texB}\\right|\\,dx`;
}

interface UnderOverlaySnapshot {
  regions: GraphRegion[];
  roots: number[];
  breaks: number[];
  signedIntegral: ImproperIntegralEstimate;
  geometricArea: ImproperIntegralEstimate;
  points: GraphPoint[];
}

type ImproperReason = "none" | "boundary" | "interior" | "uncertain";

interface ImproperIntegralPiece {
  interval: [number, number];
  value: number;
  converges: boolean;
  improper: boolean;
  reason: ImproperReason;
}

interface ImproperIntegralEstimate {
  value: number;
  converges: boolean;
  improperAtBoundary: boolean;
  improperInside: boolean;
  uncertain: boolean;
  reason: ImproperReason;
  pieces: ImproperIntegralPiece[];
}

type ImproperStatus = "converges" | "diverges" | "uncertain";

interface ImproperPieceSpec {
  left: number;
  right: number;
  leftImproper: boolean;
  rightImproper: boolean;
  leftKind: "none" | "boundary" | "interior";
  rightKind: "none" | "boundary" | "interior";
}

function isBoundarySingular(
  fn: (x: number) => number,
  boundary: number,
  oppositeBoundary: number,
): boolean {
  const sampleBoundaryLimit = () => {
    const width = Math.abs(oppositeBoundary - boundary);
    if (width <= 1e-6) {
      return null;
    }

    const direction = oppositeBoundary >= boundary ? 1 : -1;
    const offsets = [width / 512, width / 1024, width / 2048, width / 4096].map((offset) => Math.max(offset, 1e-6));
    const samples = offsets
      .map((offset) => {
        try {
          return fn(boundary + direction * offset);
        } catch {
          return Number.NaN;
        }
      })
      .filter(Number.isFinite);

    if (samples.length < 3) {
      return null;
    }

    const tail = samples.slice(-3);
    const spread = Math.max(...tail) - Math.min(...tail);
    const scale = Math.max(1, ...tail.map((value) => Math.abs(value)));
    return spread < Math.max(0.02, scale * 0.03) ? tail[tail.length - 1] : null;
  };

  const boundaryValue = fn(boundary);
  if (!Number.isFinite(boundaryValue)) {
    return sampleBoundaryLimit() === null;
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

function improperPieceReason(piece: ImproperPieceSpec): ImproperReason {
  if (piece.leftKind === "interior" || piece.rightKind === "interior") {
    return "interior";
  }
  if (piece.leftKind === "boundary" || piece.rightKind === "boundary") {
    return "boundary";
  }
  return "none";
}

function buildImproperPieceSpecs(
  fn: (x: number) => number,
  a: number,
  b: number,
  interiorSingularities: number[],
): ImproperPieceSpec[] {
  const [left, right] = sortAB(a, b);
  const width = right - left;

  if (width <= 1e-6) {
    return [];
  }

  const bounds = uniqueSorted(
    [left, ...interiorSingularities.filter((value) => value > left && value < right), right],
    Math.max(width / 4096, 1e-5),
  );
  const pieces: ImproperPieceSpec[] = [];

  for (let index = 0; index < bounds.length - 1; index += 1) {
    const pieceLeft = bounds[index];
    const pieceRight = bounds[index + 1];
    if (!(pieceRight - pieceLeft > 1e-6)) {
      continue;
    }

    const leftKind = index > 0 ? "interior" : isBoundarySingular(fn, pieceLeft, pieceRight) ? "boundary" : "none";
    const rightKind =
      index < bounds.length - 2 ? "interior" : isBoundarySingular(fn, pieceRight, pieceLeft) ? "boundary" : "none";

    pieces.push({
      left: pieceLeft,
      right: pieceRight,
      leftImproper: leftKind !== "none",
      rightImproper: rightKind !== "none",
      leftKind,
      rightKind,
    });
  }

  return pieces;
}

function truncatedSequenceConverges(values: number[]): boolean {
  if (values.length < 4) {
    return false;
  }

  const tailValues = values.slice(-5);
  const deltas = tailValues.slice(1).map((value, index) => Math.abs(value - tailValues[index]));
  if (!deltas.length) {
    return false;
  }

  const scale = Math.max(1, ...tailValues.map((value) => Math.abs(value)));
  const shrinkingTail = deltas.every((delta, index) => index === 0 || delta <= deltas[index - 1] * 0.86);
  const lastDelta = deltas[deltas.length - 1];

  return Math.max(...deltas) < Math.max(0.03, scale * 0.02) || (shrinkingTail && lastDelta < Math.max(0.02, scale * 0.004));
}

function estimateImproperPiece(
  fn: (x: number) => number,
  piece: ImproperPieceSpec,
): ImproperIntegralPiece {
  const width = piece.right - piece.left;
  const improper = piece.leftImproper || piece.rightImproper;
  const reason = improperPieceReason(piece);

  if (width <= 1e-6) {
    return {
      interval: [piece.left, piece.right],
      value: 0,
      converges: true,
      improper,
      reason,
    };
  }

  if (!improper) {
    const value = midpointIntegral(fn, piece.left, piece.right);
    return {
      interval: [piece.left, piece.right],
      value,
      converges: Number.isFinite(value),
      improper: false,
      reason: Number.isFinite(value) ? "none" : "uncertain",
    };
  }

  const truncatedValues: number[] = [];
  const startPower = 6;
  const levels = 12;

  for (let level = 0; level < levels; level += 1) {
    const epsilon = Math.max(width / 2 ** (startPower + level), 1e-7);
    const start = piece.left + (piece.leftImproper ? epsilon : 0);
    const end = piece.right - (piece.rightImproper ? epsilon : 0);

    if (!(end > start)) {
      break;
    }

    const value = midpointIntegral(fn, start, end, 2400);
    if (!Number.isFinite(value)) {
      return {
        interval: [piece.left, piece.right],
        value: Number.NaN,
        converges: false,
        improper,
        reason,
      };
    }

    truncatedValues.push(value);
  }

  const converges = truncatedSequenceConverges(truncatedValues);
  return {
    interval: [piece.left, piece.right],
    value: converges && truncatedValues.length ? truncatedValues[truncatedValues.length - 1] : Number.NaN,
    converges,
    improper,
    reason,
  };
}

function estimatePiecewiseImproperIntegral(
  fn: (x: number) => number,
  a: number,
  b: number,
  interiorSingularities: number[],
): ImproperIntegralEstimate {
  const [left, right] = sortAB(a, b);
  const width = right - left;

  if (width <= 1e-6) {
    return {
      value: 0,
      converges: true,
      improperAtBoundary: false,
      improperInside: false,
      uncertain: false,
      reason: "none",
      pieces: [],
    };
  }

  const pieces = buildImproperPieceSpecs(fn, left, right, interiorSingularities).map((piece) =>
    estimateImproperPiece(fn, piece),
  );

  const converges = pieces.length > 0 && pieces.every((piece) => piece.converges);
  const improperAtBoundary = pieces.some((piece) => piece.reason === "boundary");
  const improperInside = pieces.some((piece) => piece.reason === "interior");
  const uncertain = pieces.some((piece) => piece.reason === "uncertain");
  const reason: ImproperReason = !converges
    ? improperInside
      ? "interior"
      : improperAtBoundary
        ? "boundary"
        : "uncertain"
    : improperInside
      ? "interior"
      : improperAtBoundary
        ? "boundary"
        : "none";

  return {
    value: converges ? pieces.reduce((sum, piece) => sum + piece.value, 0) : Number.NaN,
    converges,
    improperAtBoundary,
    improperInside,
    uncertain,
    reason,
    pieces,
  };
}

function formatIntegralEstimate(estimate: ImproperIntegralEstimate, digits = 5): string {
  return estimate.converges ? formatNumber(estimate.value, digits) : "расходится";
}

function integralEstimateTex(estimate: ImproperIntegralEstimate, digits = 5): string {
  return estimate.converges ? formatNumber(estimate.value, digits) : "\\text{расходится}";
}

function estimateIsFinite(estimate: ImproperIntegralEstimate): boolean {
  return estimate.converges && Number.isFinite(estimate.value);
}

function estimateStatus(estimate: ImproperIntegralEstimate): ImproperStatus {
  if (estimate.converges && Number.isFinite(estimate.value)) {
    return "converges";
  }
  return estimate.uncertain ? "uncertain" : "diverges";
}

function makeImproperEstimate(
  status: ImproperStatus,
  reason: ImproperReason,
  pieces: ImproperIntegralPiece[] = [],
  value = Number.NaN,
): ImproperIntegralEstimate {
  return {
    value: status === "converges" ? value : Number.NaN,
    converges: status === "converges",
    improperAtBoundary: reason === "boundary",
    improperInside: reason === "interior",
    uncertain: status === "uncertain" || reason === "uncertain",
    reason: status === "uncertain" ? "uncertain" : reason,
    pieces,
  };
}

function collapseImproperReason(estimates: ImproperIntegralEstimate[], override?: ImproperReason): ImproperReason {
  if (override && override !== "none") {
    return override;
  }
  if (estimates.some((estimate) => estimate.improperInside || estimate.reason === "interior")) {
    return "interior";
  }
  if (estimates.some((estimate) => estimate.improperAtBoundary || estimate.reason === "boundary")) {
    return "boundary";
  }
  if (estimates.some((estimate) => estimate.uncertain || estimate.reason === "uncertain")) {
    return "uncertain";
  }
  return "none";
}

function mergeImproperEstimates(
  estimates: ImproperIntegralEstimate[],
  overrideReason?: ImproperReason,
): ImproperIntegralEstimate {
  if (!estimates.length) {
    return makeImproperEstimate("converges", "none", [], 0);
  }

  const reason = collapseImproperReason(estimates, overrideReason);
  const pieces = estimates.flatMap((estimate) => estimate.pieces);
  const status = estimates.every((estimate) => estimateStatus(estimate) === "converges")
    ? "converges"
    : estimates.some((estimate) => estimateStatus(estimate) === "uncertain")
      ? "uncertain"
      : "diverges";

  return makeImproperEstimate(
    status,
    status === "converges" ? reason : reason === "none" ? "uncertain" : reason,
    pieces,
    estimates.reduce((sum, estimate) => sum + (Number.isFinite(estimate.value) ? estimate.value : 0), 0),
  );
}

function classifyTailSequence(values: number[]): ImproperStatus {
  if (values.length < 4) {
    return "uncertain";
  }

  if (truncatedSequenceConverges(values)) {
    return "converges";
  }

  const tail = values.slice(-5);
  const deltas = tail.slice(1).map((value, index) => Math.abs(value - tail[index]));
  const increasingMagnitude = tail.every((value, index) => index === 0 || Math.abs(value) >= Math.abs(tail[index - 1]));
  const monotonic = tail.every((value, index) => index === 0 || value >= tail[index - 1]) ||
    tail.every((value, index) => index === 0 || value <= tail[index - 1]);
  const tailDrift = Math.abs(tail[tail.length - 1] - tail[0]);
  const scale = Math.max(1, ...tail.map((value) => Math.abs(value)));
  const persistentDrift = deltas.every((delta) => delta > Math.max(0.05, scale * 0.015));
  const nonShrinkingTail = deltas.every((delta, index) => index === 0 || delta >= deltas[index - 1] * 0.8);

  if ((increasingMagnitude && tailDrift > Math.max(1, scale * 0.08) && persistentDrift) || (monotonic && persistentDrift && nonShrinkingTail)) {
    return "diverges";
  }

  return "uncertain";
}

function analyzeFiniteImproperIntegral(fn: (x: number) => number, a: number, b: number): ImproperIntegralEstimate {
  const singularities = findSingularityCandidates(fn, a, b);
  return estimatePiecewiseImproperIntegral(fn, a, b, singularities);
}

function analyzeHalfInfiniteImproperIntegral(
  fn: (x: number) => number,
  finiteBound: number,
  direction: 1 | -1,
): ImproperIntegralEstimate {
  const spanBase = Math.max(1, Math.abs(finiteBound) + 1);
  const scales = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512].map((factor) => factor * spanBase);
  const partials: number[] = [];
  let lastEstimate: ImproperIntegralEstimate | null = null;

  for (const scale of scales) {
    const left = direction === 1 ? finiteBound : finiteBound - scale;
    const right = direction === 1 ? finiteBound + scale : finiteBound;
    const estimate = analyzeFiniteImproperIntegral(fn, left, right);
    lastEstimate = estimate;

    if (!estimate.converges) {
      return makeImproperEstimate(
        estimate.uncertain ? "uncertain" : "diverges",
        estimate.reason === "none" ? "boundary" : estimate.reason,
        estimate.pieces,
      );
    }

    partials.push(estimate.value);
  }

  const status = classifyTailSequence(partials);
  const reason: ImproperReason =
    lastEstimate?.improperInside ? "interior" : lastEstimate?.improperAtBoundary ? "boundary" : "boundary";

  return makeImproperEstimate(
    status,
    status === "uncertain" ? "uncertain" : reason,
    lastEstimate?.pieces ?? [],
    partials[partials.length - 1] ?? Number.NaN,
  );
}

function analyzeImproperIntegral(fn: (x: number) => number, a: number, b: number): ImproperIntegralEstimate {
  const [left, right] = orderBounds(a, b);

  if (Number.isFinite(left) && Number.isFinite(right)) {
    return analyzeFiniteImproperIntegral(fn, left, right);
  }

  if (left === Number.NEGATIVE_INFINITY && right === Number.POSITIVE_INFINITY) {
    return mergeImproperEstimates(
      [analyzeHalfInfiniteImproperIntegral(fn, 0, -1), analyzeHalfInfiniteImproperIntegral(fn, 0, 1)],
      "interior",
    );
  }

  if (Number.isFinite(left)) {
    return analyzeHalfInfiniteImproperIntegral(fn, left, 1);
  }

  if (Number.isFinite(right)) {
    return analyzeHalfInfiniteImproperIntegral(fn, right, -1);
  }

  return makeImproperEstimate("uncertain", "uncertain");
}

function buildImproperFailureExplanation(estimate: ImproperIntegralEstimate): string[] {
  if (estimate.improperInside) {
    return [
      "На отрезке есть внутренняя точка разрыва, поэтому интеграл приходится рассматривать по кускам.",
      "Хотя бы один усечённый кусок не стабилизируется, поэтому результат помечается как расходящийся.",
    ];
  }

  if (estimate.improperAtBoundary) {
    return [
      "На границе интервала есть несобственная особенность, и усечённые значения не стабилизируются.",
      "Поэтому результат помечается как расходящийся.",
    ];
  }

  return [
    "Численная проверка не дала устойчивой сходимости на выбранном интервале.",
    "Поэтому безопасный итог помечается как расходящийся.",
  ];
}

function buildImproperConvergentExplanation(estimate: ImproperIntegralEstimate): string[] {
  if (estimate.improperInside) {
    return ["На отрезке есть точка разрыва, но усечённые интегралы по обе стороны стабилизируются."];
  }

  if (estimate.improperAtBoundary) {
    return ["На границе есть несобственная особенность, но усечённые интегралы стабилизируются, поэтому интеграл сходится."];
  }

  return [];
}

function buildUnderSnapshot(fn: (x: number) => number, a: number, b: number): UnderOverlaySnapshot {
  const finiteBounds = Number.isFinite(a) && Number.isFinite(b);
  const roots = finiteBounds ? findRoots(fn, a, b) : [];
  const singularities = finiteBounds ? findSingularityCandidates(fn, a, b) : [];
  const breaks = finiteBounds ? uniqueSorted([...findDiscontinuityBreaks(fn, a, b), ...singularities]) : [];
  const intervals = finiteBounds ? buildIntervals(a, b, uniqueSorted([...roots, ...breaks])) : [];
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

  const signedIntegral = analyzeImproperIntegral(fn, a, b);
  const geometricArea = analyzeImproperIntegral((x) => Math.abs(fn(x)), a, b);
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
    const [a, b] = orderBounds(tool.a, tool.b);

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
      return emptyOverlay(
        tool.mode === "volume"
          ? "\u0420\u0435\u0436\u0438\u043c \u043e\u0431\u044a\u0451\u043c\u0430 \u0432 \u044d\u0442\u043e\u0439 \u0438\u0442\u0435\u0440\u0430\u0446\u0438\u0438 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442 \u0442\u043e\u043b\u044c\u043a\u043e \u044f\u0432\u043d\u044b\u0435 \u0433\u0440\u0430\u0444\u0438\u043a\u0438 y = f(x)."
          : "\u0420\u0435\u0436\u0438\u043c \u043c\u0435\u0436\u0434\u0443 \u0433\u0440\u0430\u0444\u0438\u043a\u0430\u043c\u0438 \u0441\u0435\u0439\u0447\u0430\u0441 \u0440\u0430\u0431\u043e\u0442\u0430\u0435\u0442 \u0442\u043e\u043b\u044c\u043a\u043e \u0434\u043b\u044f y = f(x).",
      );
    }
    const fnA = expressionA ? (x: number) => safeEvaluate(expressionA.evaluate, x) : null;
    const fnB = expressionB ? (x: number) => safeEvaluate(expressionB.evaluate, x) : null;

    if (tool.mode === "under") {
      if (!fnA) {
        return emptyOverlay("\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u0443\u044e \u0444\u0443\u043d\u043a\u0446\u0438\u044e \u0434\u043b\u044f \u043f\u043b\u043e\u0449\u0430\u0434\u0438 \u043f\u043e\u0434 \u0433\u0440\u0430\u0444\u0438\u043a\u043e\u043c.");
      }
      const snapshot = buildUnderSnapshot(fnA, a, b);
      const texA = expressionA ? expressionToTex(expressionA.normalized) : "f(x)";
      const signedFinite = estimateIsFinite(snapshot.signedIntegral);
      const geometricFinite = estimateIsFinite(snapshot.geometricArea);
      const statusMessage =
        signedFinite && geometricFinite
          ? null
          : signedFinite
            ? "Подписанный improper-интеграл стабилизируется, но абсолютная площадь расходится."
            : geometricFinite
              ? "Геометрическая площадь стабилизируется, но подписанный improper-интеграл не подтверждён."
              : "На выбранном интервале нет конечных значений.";
      const divergenceExplanation = signedFinite && geometricFinite
        ? [
            ...buildImproperConvergentExplanation(snapshot.signedIntegral),
            ...(!snapshot.geometricArea.improperAtBoundary && !snapshot.geometricArea.improperInside
              ? []
              : buildImproperConvergentExplanation(snapshot.geometricArea)),
          ]
        : signedFinite && !geometricFinite
          ? [
              ...buildImproperConvergentExplanation(snapshot.signedIntegral),
              "Подписанный improper-интеграл сходится за счёт затухающей знакопеременности хвоста.",
              ...buildImproperFailureExplanation(snapshot.geometricArea),
            ]
          : !signedFinite && geometricFinite
            ? [
                ...buildImproperFailureExplanation(snapshot.signedIntegral),
                ...buildImproperConvergentExplanation(snapshot.geometricArea),
              ]
            : snapshot.geometricArea.improperInside || snapshot.signedIntegral.improperInside
              ? [
                  "На отрезке есть внутренняя точка разрыва, поэтому интеграл и площадь приходится рассматривать по кускам.",
                  "Хотя бы один кусок не даёт устойчивой сходимости, поэтому итог помечается как расходящийся.",
                ]
              : snapshot.geometricArea.improperAtBoundary || snapshot.signedIntegral.improperAtBoundary
                ? [
                    "На границе интервала есть несобственная особенность, и усечённые значения не стабилизируются.",
                    "Поэтому результат помечается как расходящийся только там, где сходимость не подтверждена.",
                  ]
                : [
                    "Численная проверка не дала устойчивой сходимости на выбранном интервале.",
                    "Поэтому безопасный итог помечается как расходящийся.",
                  ];

      return {
        regions: geometricFinite ? snapshot.regions : [],
        polygons: [],
        polylines: [],
        points: snapshot.points,
        verticals: buildVerticals(a, b),
        metrics: withOptionalStatus(
          [
            {
              label: "\u041f\u043e\u0434\u043f\u0438\u0441\u0430\u043d\u043d\u044b\u0439 \u0438\u043d\u0442\u0435\u0433\u0440\u0430\u043b",
              value: signedFinite ? formatIntegralEstimate(snapshot.signedIntegral) : "расходится",
              tone: "blue",
            },
            {
              label: "\u0413\u0435\u043e\u043c\u0435\u0442\u0440\u0438\u0447\u0435\u0441\u043a\u0430\u044f \u043f\u043b\u043e\u0449\u0430\u0434\u044c",
              value: geometricFinite ? formatIntegralEstimate(snapshot.geometricArea) : "расходится",
              tone: "emerald",
            },
            { label: "\u0418\u043d\u0442\u0435\u0440\u0432\u0430\u043b", value: formatIntervalText(a, b, 3), tone: "slate" },
            { label: "\u041a\u043e\u0440\u043d\u0438", value: String(snapshot.points.length), tone: "violet" },
          ],
          statusMessage ?? "",
          Boolean(statusMessage),
        ),
        formulaTex: "\\int_a^b f(x)\\,dx\\quad\\text{\u0438}\\quad\\int_a^b |f(x)|\\,dx",
        formulaSteps: [
          `\\int_{${formatBoundTex(a, 3)}}^{${formatBoundTex(b, 3)}} ${texA}\\,dx`,
          `\\int_{${formatBoundTex(a, 3)}}^{${formatBoundTex(b, 3)}} ${texA}\\,dx = ${signedFinite ? integralEstimateTex(snapshot.signedIntegral) : "\\text{расходится}"}`,
          `S_{\\text{geom}} = \\int_{${formatBoundTex(a, 3)}}^{${formatBoundTex(b, 3)}} \\left|${texA}\\right|\\,dx = ${geometricFinite ? integralEstimateTex(snapshot.geometricArea) : "\\text{расходится}"}`,
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
      const intervalHasInfinity = hasInfiniteBounds(a, b);

      const diff = (x: number) => fnA(x) - fnB(x);
      if (intervalHasInfinity) {
        const areaEstimate = analyzeImproperIntegral((x) => Math.abs(diff(x)), a, b);
        const signedDifferenceEstimate = analyzeImproperIntegral(diff, a, b);
        const areaFinite = estimateIsFinite(areaEstimate);
        return {
          regions: [],
          polygons: [],
          polylines: [],
          points: [],
          verticals: buildVerticals(a, b),
          metrics: [
            { label: "\u041f\u043b\u043e\u0449\u0430\u0434\u044c", value: areaFinite ? formatIntegralEstimate(areaEstimate) : "расходится", tone: "emerald" },
            {
              label: "\u041f\u043e\u0434\u043f\u0438\u0441\u0430\u043d\u043d\u0430\u044f \u0440\u0430\u0437\u043d\u043e\u0441\u0442\u044c",
              value: estimateIsFinite(signedDifferenceEstimate) ? formatIntegralEstimate(signedDifferenceEstimate) : "расходится",
              tone: "blue",
            },
            { label: "\u0418\u043d\u0442\u0435\u0440\u0432\u0430\u043b", value: formatIntervalText(a, b, 3), tone: "slate" },
            statusMetric(
              areaFinite
                ? "\u041f\u043b\u043e\u0449\u0430\u0434\u044c \u043d\u0430 \u0431\u0435\u0441\u043a\u043e\u043d\u0435\u0447\u043d\u044b\u0445 \u0433\u0440\u0430\u043d\u0438\u0446\u0430\u0445 \u043e\u0446\u0435\u043d\u0435\u043d\u0430 \u0447\u0438\u0441\u043b\u0435\u043d\u043d\u043e \u0431\u0435\u0437 \u043b\u043e\u043a\u0430\u043b\u044c\u043d\u043e\u0439 \u0437\u0430\u043b\u0438\u0432\u043a\u0438."
                : "\u041d\u0430 \u0431\u0435\u0441\u043a\u043e\u043d\u0435\u0447\u043d\u043e\u043c \u0438\u043d\u0442\u0435\u0440\u0432\u0430\u043b\u0435 \u043d\u0435\u0442 \u043a\u043e\u043d\u0435\u0447\u043d\u043e\u0439 \u043f\u043b\u043e\u0449\u0430\u0434\u0438 \u043c\u0435\u0436\u0434\u0443 \u0433\u0440\u0430\u0444\u0438\u043a\u0430\u043c\u0438.",
            ),
          ],
          formulaTex: buildBetweenGeneralFormula(expressionANonNull, expressionBNonNull, a, b),
          formulaSteps: areaFinite
            ? [
                buildBetweenGeneralFormula(expressionANonNull, expressionBNonNull, a, b),
                `S = ${integralEstimateTex(areaEstimate)}`,
              ]
            : [
                buildBetweenGeneralFormula(expressionANonNull, expressionBNonNull, a, b),
                "\\text{Разбиение выполняется по особенностям и усечённым хвостам}",
                "S = \\text{расходится}",
              ],
          explanation: areaFinite
            ? [
                "\u041d\u0430 \u0431\u0435\u0441\u043a\u043e\u043d\u0435\u0447\u043d\u044b\u0445 \u0433\u0440\u0430\u043d\u0438\u0446\u0430\u0445 \u043f\u043b\u043e\u0449\u0430\u0434\u044c \u043e\u0446\u0435\u043d\u0438\u0432\u0430\u0435\u0442\u0441\u044f \u0447\u0435\u0440\u0435\u0437 \u0443\u0441\u0435\u0447\u0451\u043d\u043d\u044b\u0435 \u0445\u0432\u043e\u0441\u0442\u044b improper-\u0438\u043d\u0442\u0435\u0433\u0440\u0430\u043b\u0430.",
                ...buildImproperConvergentExplanation(areaEstimate),
              ]
            : [
                "\u041f\u043b\u043e\u0449\u0430\u0434\u044c \u043c\u0435\u0436\u0434\u0443 \u0433\u0440\u0430\u0444\u0438\u043a\u0430\u043c\u0438 \u043d\u0430 \u0431\u0435\u0441\u043a\u043e\u043d\u0435\u0447\u043d\u044b\u0445 \u0433\u0440\u0430\u043d\u0438\u0446\u0430\u0445 \u0442\u0440\u0435\u0431\u0443\u0435\u0442 \u043f\u043e\u043a\u0443\u0441\u043a\u043e\u0432\u043e\u0433\u043e improper-\u0430\u043d\u0430\u043b\u0438\u0437\u0430 |f-g|.",
                ...buildImproperFailureExplanation(areaEstimate),
              ],
          volumePreview: null,
        };
      }

      const roots = findRoots(diff, a, b);
      const singularities = uniqueSorted([
        ...findSingularityCandidates(fnA, a, b),
        ...findSingularityCandidates(fnB, a, b),
        ...findSingularityCandidates(diff, a, b),
      ]);
      const breaks = uniqueSorted([
        ...findDiscontinuityBreaks(fnA, a, b),
        ...findDiscontinuityBreaks(fnB, a, b),
        ...findDiscontinuityBreaks(diff, a, b),
        ...singularities,
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
      const areaEstimate = estimatePiecewiseImproperIntegral((x) => Math.abs(diff(x)), a, b, singularities);
      const signedDifferenceEstimate = estimatePiecewiseImproperIntegral(diff, a, b, singularities);
      const areaFinite = estimateIsFinite(areaEstimate);
      const signedDifferenceFinite = estimateIsFinite(signedDifferenceEstimate);
      const orderingMetrics = mergedSegments.map((segment, index) => ({
        label:
          mergedSegments.length === 1
            ? "\u0412\u0435\u0440\u0445\u043d\u0438\u0439 \u0433\u0440\u0430\u0444\u0438\u043a"
            : `\u0412\u0435\u0440\u0445 \u043d\u0430 [${formatNumber(segment.left, 3)}; ${formatNumber(segment.right, 3)}]`,
        value: expressionDisplayLabel(segment.topExpression),
        tone: index % 2 === 0 ? ("blue" as const) : ("violet" as const),
      }));
      const baseExplanation = [
        "\u041d\u0430 \u043a\u0430\u0436\u0434\u043e\u043c \u0443\u0447\u0430\u0441\u0442\u043a\u0435 \u043f\u043b\u043e\u0449\u0430\u0434\u044c \u0441\u0447\u0438\u0442\u0430\u0435\u0442\u0441\u044f \u043a\u0430\u043a \u201c\u0432\u0435\u0440\u0445\u043d\u044f\u044f \u0444\u0443\u043d\u043a\u0446\u0438\u044f \u043c\u0438\u043d\u0443\u0441 \u043d\u0438\u0436\u043d\u044f\u044f\u201d.",
        "\u0418\u043d\u0442\u0435\u0440\u0432\u0430\u043b \u0434\u0435\u043b\u0438\u0442\u0441\u044f \u043f\u043e \u0442\u043e\u0447\u043a\u0430\u043c \u043f\u0435\u0440\u0435\u0441\u0435\u0447\u0435\u043d\u0438\u044f \u0438 \u0442\u043e\u0447\u043a\u0430\u043c \u0440\u0430\u0437\u0440\u044b\u0432\u0430, \u0447\u0442\u043e\u0431\u044b \u043a\u0430\u0436\u0434\u044b\u0439 \u043a\u0443\u0441\u043e\u043a \u0430\u043d\u0430\u043b\u0438\u0437\u0438\u0440\u043e\u0432\u0430\u043b\u0441\u044f \u043e\u0442\u0434\u0435\u043b\u044c\u043d\u043e.",
      ];

      if (!areaFinite) {
        return {
          regions: [],
          polygons: [],
          polylines: [],
          points: intersections,
          verticals: buildVerticals(a, b),
          metrics: [
            { label: "\u041f\u043b\u043e\u0449\u0430\u0434\u044c", value: "расходится", tone: "emerald" },
            {
              label: "\u041f\u043e\u0434\u043f\u0438\u0441\u0430\u043d\u043d\u0430\u044f \u0440\u0430\u0437\u043d\u043e\u0441\u0442\u044c",
              value: signedDifferenceFinite ? formatIntegralEstimate(signedDifferenceEstimate) : "расходится",
              tone: "blue",
            },
            { label: "\u0418\u043d\u0442\u0435\u0440\u0432\u0430\u043b", value: `[${formatNumber(a, 3)}; ${formatNumber(b, 3)}]`, tone: "slate" },
            { label: "\u041f\u0435\u0440\u0435\u0441\u0435\u0447\u0435\u043d\u0438\u044f", value: String(intersections.length), tone: "violet" },
            statusMetric("\u041d\u0430 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u043c \u0438\u043d\u0442\u0435\u0440\u0432\u0430\u043b\u0435 \u043d\u0435\u0442 \u043a\u043e\u043d\u0435\u0447\u043d\u043e\u0439 \u043f\u043b\u043e\u0449\u0430\u0434\u0438 \u043c\u0435\u0436\u0434\u0443 \u0433\u0440\u0430\u0444\u0438\u043a\u0430\u043c\u0438."),
          ],
          formulaTex: buildBetweenGeneralFormula(expressionANonNull, expressionBNonNull, a, b),
          formulaSteps: [
            buildBetweenGeneralFormula(expressionANonNull, expressionBNonNull, a, b),
            "\\text{Разбиение выполняется по точкам пересечения и точкам разрыва функций}",
            "S = \\text{расходится}",
          ],
          explanation: [...baseExplanation, ...buildImproperFailureExplanation(areaEstimate)],
          volumePreview: null,
        };
      }

      return {
        regions,
        polygons: [],
        polylines: [],
        points: intersections,
        verticals: buildVerticals(a, b),
        metrics: withOptionalStatus(
          [
            { label: "\u041f\u043b\u043e\u0449\u0430\u0434\u044c", value: formatIntegralEstimate(areaEstimate), tone: "emerald" },
            {
              label: "\u041f\u043e\u0434\u043f\u0438\u0441\u0430\u043d\u043d\u0430\u044f \u0440\u0430\u0437\u043d\u043e\u0441\u0442\u044c",
              value: formatIntegralEstimate(signedDifferenceEstimate),
              tone: "blue",
            },
            { label: "\u0418\u043d\u0442\u0435\u0440\u0432\u0430\u043b", value: `[${formatNumber(a, 3)}; ${formatNumber(b, 3)}]`, tone: "slate" },
            { label: "\u041f\u0435\u0440\u0435\u0441\u0435\u0447\u0435\u043d\u0438\u044f", value: String(intersections.length), tone: "violet" },
            ...orderingMetrics,
          ],
          "\u041d\u0430 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u043c \u0438\u043d\u0442\u0435\u0440\u0432\u0430\u043b\u0435 \u043d\u0435\u0442 \u043a\u043e\u043d\u0435\u0447\u043d\u043e\u0439 \u043e\u0431\u043b\u0430\u0441\u0442\u0438 \u043c\u0435\u0436\u0434\u0443 \u0433\u0440\u0430\u0444\u0438\u043a\u0430\u043c\u0438.",
          !regions.length && !areaFinite,
        ),
        formulaTex: buildBetweenFormulaTex(mergedSegments),
        formulaSteps: buildBetweenFormulaSteps(mergedSegments, areaEstimate.value, signedDifferenceEstimate.value),
        explanation: [...baseExplanation, ...buildImproperConvergentExplanation(areaEstimate)],
        volumePreview: null,
      };
    }

    if (tool.mode === "riemann") {
      if (!fnA) {
        return emptyOverlay("\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u0443\u044e \u0444\u0443\u043d\u043a\u0446\u0438\u044e \u0434\u043b\u044f \u0441\u0443\u043c\u043c \u0420\u0438\u043c\u0430\u043d\u0430.");
      }
      if (hasInfiniteBounds(a, b)) {
        return {
          regions: [],
          polygons: [],
          polylines: [],
          points: [],
          verticals: buildVerticals(a, b),
          metrics: [
            { label: "\u0421\u0443\u043c\u043c\u0430 \u0420\u0438\u043c\u0430\u043d\u0430", value: "\u043d\u0435 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044f", tone: "blue" },
            { label: "\u0418\u043d\u0442\u0435\u0440\u0432\u0430\u043b", value: formatIntervalText(a, b, 3), tone: "slate" },
            statusMetric("\u0411\u0435\u0441\u043a\u043e\u043d\u0435\u0447\u043d\u044b\u0435 \u0433\u0440\u0430\u043d\u0438\u0446\u044b \u0432 \u0442\u0435\u043a\u0443\u0449\u0435\u043c \u0440\u0435\u0436\u0438\u043c\u0435 \u0441\u0443\u043c\u043c \u0420\u0438\u043c\u0430\u043d\u0430 \u043d\u0435 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u044e\u0442\u0441\u044f."),
          ],
          formulaTex: "S_n = \\sum_{i=1}^{n} f(\\xi_i)\\,\\Delta x",
          formulaSteps: [
            "S_n = \\sum_{i=1}^{n} f(\\xi_i)\\,\\Delta x",
            "\\text{Бесконечные границы в текущем режиме не поддерживаются}",
          ],
          explanation: [
            "\u0421\u0443\u043c\u043c\u044b \u0420\u0438\u043c\u0430\u043d\u0430 \u0432 \u044d\u0442\u043e\u043c UI \u043f\u0440\u0438\u0432\u044f\u0437\u0430\u043d\u044b \u043a \u043a\u043e\u043d\u0435\u0447\u043d\u043e\u043c\u0443 \u0440\u0430\u0437\u0431\u0438\u0435\u043d\u0438\u044e \u043e\u0442\u0440\u0435\u0437\u043a\u0430.",
            "\u041f\u043e\u044d\u0442\u043e\u043c\u0443 \u0434\u043b\u044f \u0431\u0435\u0441\u043a\u043e\u043d\u0435\u0447\u043d\u044b\u0445 \u0433\u0440\u0430\u043d\u0438\u0446 \u0440\u0435\u0436\u0438\u043c \u0447\u0435\u0441\u0442\u043d\u043e \u0432\u043e\u0437\u0432\u0440\u0430\u0449\u0430\u0435\u0442 safe-status \u0431\u0435\u0437 \u0447\u0438\u0441\u043b\u0430.",
          ],
          volumePreview: null,
        };
      }

      const snapshot = buildUnderSnapshot(fnA, a, b);
      const integral = snapshot.signedIntegral;
      const integralFinite = estimateIsFinite(integral);
      const texA = expressionA ? expressionToTex(expressionA.normalized) : "f(x)";
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

      const approximationReliable = integralFinite && used === tool.n;

      if (!integralFinite) {
        return {
          regions: [],
          polygons: [],
          polylines: [],
          points: [],
          verticals: buildVerticals(a, b),
          metrics: [
            { label: "\u0421\u0443\u043c\u043c\u0430 \u0420\u0438\u043c\u0430\u043d\u0430", value: "расходится", tone: "blue" },
            { label: "\u0418\u043d\u0442\u0435\u0433\u0440\u0430\u043b", value: "расходится", tone: "emerald" },
            { label: "\u0410\u0431\u0441. \u043e\u0448\u0438\u0431\u043a\u0430", value: "\u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e", tone: "rose" },
            { label: "n", value: String(tool.n), tone: "slate" },
            { label: "\u0412\u044b\u0431\u043e\u0440\u043a\u0430", value: tool.sample, tone: "violet" },
            { label: "\u0421\u0442\u0430\u0442\u0443\u0441", value: "\u041d\u0430 \u0438\u043d\u0442\u0435\u0440\u0432\u0430\u043b\u0435 \u043d\u0435\u0442 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u043e\u0433\u043e \u043a\u043e\u043d\u0435\u0447\u043d\u043e\u0433\u043e \u0438\u043d\u0442\u0435\u0433\u0440\u0430\u043b\u0430.", tone: "slate" },
          ],
          formulaTex: "S_n = \\sum_{i=1}^{n} f(\\xi_i)\\,\\Delta x",
          formulaSteps: [
            "S_n = \\sum_{i=1}^{n} f(\\xi_i)\\,\\Delta x",
            `\\int_{${formatNumber(a, 3)}}^{${formatNumber(b, 3)}} ${texA}\\,dx = \\text{расходится}`,
            "S_n \\text{ не даёт корректного конечного результата на этом интервале}",
          ],
          explanation: [
            "\u0421\u0443\u043c\u043c\u0430 \u0420\u0438\u043c\u0430\u043d\u0430 \u0438\u043c\u0435\u0435\u0442 \u0441\u043c\u044b\u0441\u043b \u043a\u0430\u043a \u043f\u0440\u0438\u0431\u043b\u0438\u0436\u0435\u043d\u0438\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044e\u0449\u0435\u0433\u043e \u043a\u043e\u043d\u0435\u0447\u043d\u043e\u0433\u043e \u0438\u043d\u0442\u0435\u0433\u0440\u0430\u043b\u0430.",
            ...buildImproperFailureExplanation(integral),
          ],
          volumePreview: null,
        };
      }

      if (!approximationReliable) {
        return {
          regions: [],
          polygons: [],
          polylines: [],
          points: [],
          verticals: buildVerticals(a, b),
          metrics: [
            { label: "\u0421\u0443\u043c\u043c\u0430 \u0420\u0438\u043c\u0430\u043d\u0430", value: "\u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e", tone: "blue" },
            { label: "\u0418\u043d\u0442\u0435\u0433\u0440\u0430\u043b", value: formatNumber(integral.value), tone: "emerald" },
            { label: "\u0410\u0431\u0441. \u043e\u0448\u0438\u0431\u043a\u0430", value: "\u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e", tone: "rose" },
            { label: "n", value: String(tool.n), tone: "slate" },
            { label: "\u0412\u044b\u0431\u043e\u0440\u043a\u0430", value: tool.sample, tone: "violet" },
            {
              label: "\u0421\u0442\u0430\u0442\u0443\u0441",
              value: "\u0422\u0435\u043a\u0443\u0449\u0435\u0435 \u0440\u0430\u0437\u0431\u0438\u0435\u043d\u0438\u0435 \u043f\u043e\u043f\u0430\u0434\u0430\u0435\u0442 \u0432 \u043e\u0441\u043e\u0431\u0435\u043d\u043d\u043e\u0441\u0442\u044c, \u043f\u043e\u044d\u0442\u043e\u043c\u0443 \u0441\u0443\u043c\u043c\u0430 \u0420\u0438\u043c\u0430\u043d\u0430 \u0434\u043b\u044f \u044d\u0442\u043e\u0433\u043e \u0448\u0430\u0433\u0430 \u043d\u0435 \u0441\u0442\u0440\u043e\u0438\u0442\u0441\u044f.",
              tone: "slate",
            },
          ],
          formulaTex: "S_n = \\sum_{i=1}^{n} f(\\xi_i)\\,\\Delta x",
          formulaSteps: [
            "S_n = \\sum_{i=1}^{n} f(\\xi_i)\\,\\Delta x",
            `\\int_{${formatNumber(a, 3)}}^{${formatNumber(b, 3)}} ${texA}\\,dx = ${formatNumber(integral.value)}`,
            "S_n = \\text{недоступно для выбранного разбиения}",
          ],
          explanation: [
            "\u0418\u043d\u0442\u0435\u0433\u0440\u0430\u043b \u043d\u0430 \u043e\u0442\u0440\u0435\u0437\u043a\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442, \u043d\u043e \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u0435 \u0440\u0430\u0437\u0431\u0438\u0435\u043d\u0438\u0435 \u0438\u043b\u0438 \u0442\u043e\u0447\u043a\u0438 \u0432\u044b\u0431\u043e\u0440\u043a\u0438 \u043f\u043e\u043f\u0430\u0434\u0430\u044e\u0442 \u0432 \u043e\u0441\u043e\u0431\u0435\u043d\u043d\u043e\u0441\u0442\u044c.",
            ...buildImproperConvergentExplanation(integral),
          ],
          volumePreview: null,
        };
      }

      return {
        regions: [],
        polygons,
        polylines: [],
        points,
        verticals: buildVerticals(a, b),
        metrics: withOptionalStatus(
          [
            { label: "\u0421\u0443\u043c\u043c\u0430 \u0420\u0438\u043c\u0430\u043d\u0430", value: formatNumber(approx), tone: "blue" },
            { label: "\u0418\u043d\u0442\u0435\u0433\u0440\u0430\u043b", value: formatNumber(integral.value), tone: "emerald" },
            { label: "\u0410\u0431\u0441. \u043e\u0448\u0438\u0431\u043a\u0430", value: formatNumber(Math.abs(approx - integral.value)), tone: "rose" },
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
          `\\left|S_n - I\\right| = ${formatNumber(Math.abs(approx - integral.value))}`,
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
      if (hasInfiniteBounds(a, b)) {
        return {
          regions: [],
          polygons: [],
          polylines: [],
          points: [],
          verticals: buildVerticals(a, b),
          metrics: [
            { label: "\u0422\u0440\u0430\u043f\u0435\u0446\u0438\u0438", value: "\u043d\u0435 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044f", tone: "blue" },
            { label: "\u0418\u043d\u0442\u0435\u0440\u0432\u0430\u043b", value: formatIntervalText(a, b, 3), tone: "slate" },
            statusMetric("\u0411\u0435\u0441\u043a\u043e\u043d\u0435\u0447\u043d\u044b\u0435 \u0433\u0440\u0430\u043d\u0438\u0446\u044b \u0432 \u0442\u0435\u043a\u0443\u0449\u0435\u043c \u043c\u0435\u0442\u043e\u0434\u0435 \u0442\u0440\u0430\u043f\u0435\u0446\u0438\u0439 \u043d\u0435 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u044e\u0442\u0441\u044f."),
          ],
          formulaTex:
            "\\int_a^b f(x)\\,dx \\approx \\frac{h}{2}\\bigl(f(x_0)+2\\sum_{i=1}^{n-1}f(x_i)+f(x_n)\\bigr)",
          formulaSteps: [
            "\\int_a^b f(x)\\,dx \\approx \\frac{h}{2}\\bigl(f(x_0)+2\\sum_{i=1}^{n-1}f(x_i)+f(x_n)\\bigr)",
            "\\text{Бесконечные границы в текущем режиме не поддерживаются}",
          ],
          explanation: [
            "\u041c\u0435\u0442\u043e\u0434 \u0442\u0440\u0430\u043f\u0435\u0446\u0438\u0439 \u0432 \u0442\u0435\u043a\u0443\u0449\u0435\u043c UI \u0440\u0430\u0431\u043e\u0442\u0430\u0435\u0442 \u0442\u043e\u043b\u044c\u043a\u043e \u043d\u0430 \u043a\u043e\u043d\u0435\u0447\u043d\u044b\u0445 \u043e\u0442\u0440\u0435\u0437\u043a\u0430\u0445.",
            "\u041f\u043e\u044d\u0442\u043e\u043c\u0443 \u0434\u043b\u044f \u0431\u0435\u0441\u043a\u043e\u043d\u0435\u0447\u043d\u044b\u0445 \u0433\u0440\u0430\u043d\u0438\u0446 \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u0442\u0441\u044f safe-status \u0431\u0435\u0437 \u043b\u043e\u0436\u043d\u043e\u0439 \u0430\u043f\u043f\u0440\u043e\u043a\u0441\u0438\u043c\u0430\u0446\u0438\u0438.",
          ],
          volumePreview: null,
        };
      }

      const snapshot = buildUnderSnapshot(fnA, a, b);
      const integral = snapshot.signedIntegral;
      const integralFinite = estimateIsFinite(integral);
      const texA = expressionA ? expressionToTex(expressionA.normalized) : "f(x)";
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

      const approximationReliable = integralFinite && used === tool.n && points.length === tool.n + 1;

      if (!integralFinite) {
        return {
          regions: [],
          polygons: [],
          polylines: [],
          points: [],
          verticals: buildVerticals(a, b),
          metrics: [
            { label: "\u0422\u0440\u0430\u043f\u0435\u0446\u0438\u0438", value: "расходится", tone: "blue" },
            { label: "\u0418\u043d\u0442\u0435\u0433\u0440\u0430\u043b", value: "расходится", tone: "emerald" },
            { label: "\u0410\u0431\u0441. \u043e\u0448\u0438\u0431\u043a\u0430", value: "\u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e", tone: "rose" },
            { label: "n", value: String(tool.n), tone: "slate" },
            { label: "\u0428\u0430\u0433 h", value: formatNumber(width), tone: "amber" },
            { label: "\u0421\u0442\u0430\u0442\u0443\u0441", value: "\u041d\u0430 \u0438\u043d\u0442\u0435\u0440\u0432\u0430\u043b\u0435 \u043d\u0435\u0442 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u043e\u0433\u043e \u043a\u043e\u043d\u0435\u0447\u043d\u043e\u0433\u043e \u0438\u043d\u0442\u0435\u0433\u0440\u0430\u043b\u0430.", tone: "slate" },
          ],
          formulaTex:
            "\\int_a^b f(x)\\,dx \\approx \\frac{h}{2}\\bigl(f(x_0)+2\\sum_{i=1}^{n-1}f(x_i)+f(x_n)\\bigr)",
          formulaSteps: [
            "\\int_a^b f(x)\\,dx \\approx \\frac{h}{2}\\bigl(f(x_0)+2\\sum_{i=1}^{n-1}f(x_i)+f(x_n)\\bigr)",
            `\\int_{${formatNumber(a, 3)}}^{${formatNumber(b, 3)}} ${texA}\\,dx = \\text{расходится}`,
            "T_n \\text{ не даёт корректного конечного результата на этом интервале}",
          ],
          explanation: [
            "\u041c\u0435\u0442\u043e\u0434 \u0442\u0440\u0430\u043f\u0435\u0446\u0438\u0439 \u0438\u043c\u0435\u0435\u0442 \u0441\u043c\u044b\u0441\u043b \u043a\u0430\u043a \u043f\u0440\u0438\u0431\u043b\u0438\u0436\u0435\u043d\u0438\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044e\u0449\u0435\u0433\u043e \u043a\u043e\u043d\u0435\u0447\u043d\u043e\u0433\u043e \u0438\u043d\u0442\u0435\u0433\u0440\u0430\u043b\u0430.",
            ...buildImproperFailureExplanation(integral),
          ],
          volumePreview: null,
        };
      }

      if (!approximationReliable) {
        return {
          regions: [],
          polygons: [],
          polylines: [],
          points: [],
          verticals: buildVerticals(a, b),
          metrics: [
            { label: "\u0422\u0440\u0430\u043f\u0435\u0446\u0438\u0438", value: "\u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e", tone: "blue" },
            { label: "\u0418\u043d\u0442\u0435\u0433\u0440\u0430\u043b", value: formatNumber(integral.value), tone: "emerald" },
            { label: "\u0410\u0431\u0441. \u043e\u0448\u0438\u0431\u043a\u0430", value: "\u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e", tone: "rose" },
            { label: "n", value: String(tool.n), tone: "slate" },
            { label: "\u0428\u0430\u0433 h", value: formatNumber(width), tone: "amber" },
            {
              label: "\u0421\u0442\u0430\u0442\u0443\u0441",
              value: "\u0422\u0435\u043a\u0443\u0449\u0435\u0435 \u0440\u0430\u0437\u0431\u0438\u0435\u043d\u0438\u0435 \u043f\u043e\u043f\u0430\u0434\u0430\u0435\u0442 \u0432 \u043e\u0441\u043e\u0431\u0435\u043d\u043d\u043e\u0441\u0442\u044c, \u043f\u043e\u044d\u0442\u043e\u043c\u0443 \u043c\u0435\u0442\u043e\u0434 \u0442\u0440\u0430\u043f\u0435\u0446\u0438\u0439 \u0434\u043b\u044f \u044d\u0442\u043e\u0433\u043e \u0448\u0430\u0433\u0430 \u043d\u0435 \u0441\u0442\u0440\u043e\u0438\u0442\u0441\u044f.",
              tone: "slate",
            },
          ],
          formulaTex:
            "\\int_a^b f(x)\\,dx \\approx \\frac{h}{2}\\bigl(f(x_0)+2\\sum_{i=1}^{n-1}f(x_i)+f(x_n)\\bigr)",
          formulaSteps: [
            "\\int_a^b f(x)\\,dx \\approx \\frac{h}{2}\\bigl(f(x_0)+2\\sum_{i=1}^{n-1}f(x_i)+f(x_n)\\bigr)",
            `\\int_{${formatNumber(a, 3)}}^{${formatNumber(b, 3)}} ${texA}\\,dx = ${formatNumber(integral.value)}`,
            "T_n = \\text{недоступно для выбранного разбиения}",
          ],
          explanation: [
            "\u0418\u043d\u0442\u0435\u0433\u0440\u0430\u043b \u043d\u0430 \u043e\u0442\u0440\u0435\u0437\u043a\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442, \u043d\u043e \u0442\u0435\u043a\u0443\u0449\u0430\u044f \u0441\u0435\u0442\u043a\u0430 \u0442\u0440\u0430\u043f\u0435\u0446\u0438\u0439 \u043f\u043e\u043f\u0430\u0434\u0430\u0435\u0442 \u0432 \u043e\u0441\u043e\u0431\u0435\u043d\u043d\u043e\u0441\u0442\u044c.",
            ...buildImproperConvergentExplanation(integral),
          ],
          volumePreview: null,
        };
      }

      return {
        regions: [],
        polygons,
        polylines,
        points,
        verticals: buildVerticals(a, b),
        metrics: withOptionalStatus(
          [
            { label: "\u0422\u0440\u0430\u043f\u0435\u0446\u0438\u0438", value: formatNumber(approx), tone: "blue" },
            { label: "\u0418\u043d\u0442\u0435\u0433\u0440\u0430\u043b", value: formatNumber(integral.value), tone: "emerald" },
            { label: "\u0410\u0431\u0441. \u043e\u0448\u0438\u0431\u043a\u0430", value: formatNumber(Math.abs(approx - integral.value)), tone: "rose" },
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
          `\\left|T_n - I\\right| = ${formatNumber(Math.abs(approx - integral.value))}`,
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

      const integralFinite = estimateIsFinite(snapshot.signedIntegral);
      return {
        regions: Number.isFinite(a) && Number.isFinite(b) && integralFinite ? snapshot.regions : [],
        polygons: [],
        polylines: [],
        points: snapshot.points,
        verticals: buildVerticals(a, b),
        metrics: withOptionalStatus(
          [
            { label: "\u0418\u043d\u0442\u0435\u0433\u0440\u0430\u043b", value: formatIntegralEstimate(snapshot.signedIntegral), tone: "blue" },
            { label: "\u0418\u043d\u0442\u0435\u0440\u0432\u0430\u043b", value: formatIntervalText(a, b, 3), tone: "slate" },
            { label: "\u041a\u043e\u0440\u043d\u0438", value: String(snapshot.points.length), tone: "violet" },
          ],
          "\u041d\u0430 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u043c \u0438\u043d\u0442\u0435\u0440\u0432\u0430\u043b\u0435 \u043d\u0435\u0442 \u043a\u043e\u043d\u0435\u0447\u043d\u044b\u0445 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0439.",
          !integralFinite,
        ),
        formulaTex: `\\int_{${formatBoundTex(a, 3)}}^{${formatBoundTex(b, 3)}} ${texA}\\,dx = F(${formatBoundTex(b, 3)}) - F(${formatBoundTex(a, 3)})`,
        formulaSteps: [
          `\\int_{${formatBoundTex(a, 3)}}^{${formatBoundTex(b, 3)}} ${texA}\\,dx = F(${formatBoundTex(b, 3)}) - F(${formatBoundTex(a, 3)})`,
          `\\int_{${formatBoundTex(a, 3)}}^{${formatBoundTex(b, 3)}} ${texA}\\,dx = ${integralFinite ? integralEstimateTex(snapshot.signedIntegral) : "\\text{расходится}"}`,
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
      if (hasInfiniteBounds(a, b)) {
        return {
          regions: [],
          polygons: [],
          polylines: [],
          points: [],
          verticals: buildVerticals(a, b),
          metrics: [
            { label: "\u0421\u0440\u0435\u0434\u043d\u0435\u0435 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435", value: "\u043d\u0435 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044f", tone: "amber" },
            { label: "\u0418\u043d\u0442\u0435\u0440\u0432\u0430\u043b", value: formatIntervalText(a, b, 3), tone: "slate" },
            statusMetric("\u0421\u0440\u0435\u0434\u043d\u0435\u0435 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435 \u0432 \u0442\u0435\u043a\u0443\u0449\u0435\u043c \u0440\u0435\u0436\u0438\u043c\u0435 \u043e\u043f\u0440\u0435\u0434\u0435\u043b\u044f\u0435\u0442\u0441\u044f \u0442\u043e\u043b\u044c\u043a\u043e \u043d\u0430 \u043a\u043e\u043d\u0435\u0447\u043d\u043e\u043c \u043e\u0442\u0440\u0435\u0437\u043a\u0435."),
          ],
          formulaTex: `f_{\\text{avg}} = \\frac{1}{b-a}\\int_a^b ${expressionA ? expressionToTex(expressionA.normalized) : "f(x)"}\\,dx`,
          formulaSteps: [
            `f_{\\text{avg}} = \\frac{1}{b-a}\\int_a^b ${expressionA ? expressionToTex(expressionA.normalized) : "f(x)"}\\,dx`,
            "\\text{Среднее значение в этой модели поддерживается только на конечном отрезке}",
          ],
          explanation: [
            "\u0424\u043e\u0440\u043c\u0443\u043b\u0430 \u0441\u0440\u0435\u0434\u043d\u0435\u0433\u043e \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u044f \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0435 \u0434\u043b\u0438\u043d\u0443 \u043a\u043e\u043d\u0435\u0447\u043d\u043e\u0433\u043e \u043e\u0442\u0440\u0435\u0437\u043a\u0430.",
            "\u041f\u043e\u044d\u0442\u043e\u043c\u0443 \u0434\u043b\u044f \u0431\u0435\u0441\u043a\u043e\u043d\u0435\u0447\u043d\u044b\u0445 \u0433\u0440\u0430\u043d\u0438\u0446 \u0440\u0435\u0436\u0438\u043c \u0447\u0435\u0441\u0442\u043d\u043e \u0432\u043e\u0437\u0432\u0440\u0430\u0449\u0430\u0435\u0442 safe-status \u0431\u0435\u0437 \u043b\u043e\u0436\u043d\u043e\u0433\u043e \u0447\u0438\u0441\u043b\u0430.",
          ],
          volumePreview: null,
        };
      }
      if (Math.abs(b - a) < 1e-6) {
        return emptyOverlay("\u0414\u043b\u044f \u0441\u0440\u0435\u0434\u043d\u0435\u0433\u043e \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u044f \u043d\u0443\u0436\u0435\u043d \u043d\u0435\u043d\u0443\u043b\u0435\u0432\u043e\u0439 \u0438\u043d\u0442\u0435\u0440\u0432\u0430\u043b.");
      }

      const snapshot = buildUnderSnapshot(fnA, a, b);
      const integral = snapshot.signedIntegral;
      const integralFinite = estimateIsFinite(integral);
      const averageValue = integralFinite ? integral.value / (b - a) : Number.NaN;
      const averageFinite = integralFinite && Number.isFinite(averageValue);
      const texA = expressionA ? expressionToTex(expressionA.normalized) : "f(x)";
      const averageFn = () => averageValue;
      const averageRegion: GraphRegion[] = averageFinite
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
      const polylines: GraphPolyline[] = averageFinite
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
      const points: GraphPoint[] = averageFinite
        ? [...snapshot.points, { x: b, y: averageValue, label: `f_avg=${formatNumber(averageValue, 3)}`, color: COLORS.amber, radius: 4 }]
        : snapshot.points;
      const formulaSteps = averageFinite
        ? [
            `f_{\\text{avg}} = \\frac{1}{${formatNumber(b - a, 3)}}\\int_{${formatBoundTex(a, 3)}}^{${formatBoundTex(b, 3)}} ${texA}\\,dx`,
            `f_{\\text{avg}} = \\frac{${integralEstimateTex(integral)}}{${formatNumber(b - a, 3)}}`,
            `f_{\\text{avg}} = ${formatNumber(averageValue)}`,
          ]
        : [
            `f_{\\text{avg}} = \\frac{1}{${formatNumber(b - a, 3)}}\\int_{${formatBoundTex(a, 3)}}^{${formatBoundTex(b, 3)}} ${texA}\\,dx`,
            `\\int_{${formatBoundTex(a, 3)}}^{${formatBoundTex(b, 3)}} ${texA}\\,dx = \\text{расходится}`,
            "f_{\\text{avg}} \\text{ не существует}",
          ];

      return {
        regions: averageFinite ? [...snapshot.regions, ...averageRegion] : [],
        polygons: [],
        polylines,
        points,
        verticals: buildVerticals(a, b),
        metrics: withOptionalStatus(
          [
            { label: "\u0421\u0440\u0435\u0434\u043d\u0435\u0435 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435", value: averageFinite ? formatNumber(averageValue) : "расходится", tone: "amber" },
            { label: "\u0418\u043d\u0442\u0435\u0433\u0440\u0430\u043b", value: formatIntegralEstimate(integral), tone: "blue" },
            { label: "\u0418\u043d\u0442\u0435\u0440\u0432\u0430\u043b", value: formatIntervalText(a, b, 3), tone: "slate" },
          ],
          "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u043e \u043e\u0446\u0435\u043d\u0438\u0442\u044c \u0441\u0440\u0435\u0434\u043d\u0435\u0435 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435.",
          !averageFinite,
        ),
        formulaTex: `f_{\\text{avg}} = \\frac{1}{${formatNumber(b - a, 3)}}\\int_{${formatBoundTex(a, 3)}}^{${formatBoundTex(b, 3)}} ${texA}\\,dx`,
        formulaSteps,
        explanation: averageFinite
          ? [
              "\u0421\u0440\u0435\u0434\u043d\u0435\u0435 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435 \u0444\u0443\u043d\u043a\u0446\u0438\u0438 \u2014 \u044d\u0442\u043e \u0442\u0430\u043a\u0430\u044f \u0432\u044b\u0441\u043e\u0442\u0430 \u043f\u0440\u044f\u043c\u043e\u0443\u0433\u043e\u043b\u044c\u043d\u0438\u043a\u0430 \u043d\u0430 \u0442\u043e\u043c \u0436\u0435 \u043e\u0441\u043d\u043e\u0432\u0430\u043d\u0438\u0438, \u043f\u0440\u0438 \u043a\u043e\u0442\u043e\u0440\u043e\u0439 \u043f\u043b\u043e\u0449\u0430\u0434\u044c \u0441\u043e\u0432\u043f\u0430\u0434\u0430\u0435\u0442.",
              "\u0421\u0438\u043d\u044f\u044f/\u0440\u043e\u0437\u043e\u0432\u0430\u044f \u0437\u0430\u043a\u0440\u0430\u0441\u043a\u0430 \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u0442 \u043e\u0431\u043b\u0430\u0441\u0442\u044c \u043f\u043e\u0434 \u0433\u0440\u0430\u0444\u0438\u043a\u043e\u043c, \u0430 \u044f\u043d\u0442\u0430\u0440\u043d\u044b\u0439 \u0441\u043b\u043e\u0439 \u2014 \u043f\u0440\u044f\u043c\u043e\u0443\u0433\u043e\u043b\u044c\u043d\u0438\u043a \u0441\u0440\u0435\u0434\u043d\u0435\u0439 \u0432\u044b\u0441\u043e\u0442\u044b.",
              "\u0412 \u043c\u0435\u0441\u0442\u0430\u0445 \u043d\u0430\u043b\u043e\u0436\u0435\u043d\u0438\u044f \u0441\u043b\u043e\u0451\u0432 \u043f\u043e\u044f\u0432\u043b\u044f\u0435\u0442\u0441\u044f \u0442\u0440\u0435\u0442\u0438\u0439 \u043e\u0442\u0442\u0435\u043d\u043e\u043a, \u043a\u043e\u0442\u043e\u0440\u044b\u0439 \u043d\u0430\u0433\u043b\u044f\u0434\u043d\u043e \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u0442 \u0441\u043e\u0432\u043f\u0430\u0434\u0430\u044e\u0449\u0443\u044e \u0447\u0430\u0441\u0442\u044c \u043f\u043b\u043e\u0449\u0430\u0434\u0435\u0439.",
            ]
          : [
              "\u0421\u0440\u0435\u0434\u043d\u0435\u0435 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435 \u0444\u0443\u043d\u043a\u0446\u0438\u0438 \u043e\u043f\u0440\u0435\u0434\u0435\u043b\u044f\u0435\u0442\u0441\u044f \u0442\u043e\u043b\u044c\u043a\u043e \u0447\u0435\u0440\u0435\u0437 \u043a\u043e\u043d\u0435\u0447\u043d\u044b\u0439 \u043e\u043f\u0440\u0435\u0434\u0435\u043b\u0451\u043d\u043d\u044b\u0439 \u0438\u043d\u0442\u0435\u0433\u0440\u0430\u043b.",
              ...buildImproperFailureExplanation(integral),
              "\u041f\u043e\u044d\u0442\u043e\u043c\u0443 \u0441\u0440\u0435\u0434\u043d\u0435\u0435 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435 \u043d\u0430 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u043c \u0438\u043d\u0442\u0435\u0440\u0432\u0430\u043b\u0435 \u043d\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442.",
            ],
        volumePreview: null,
      };
    }

    if (tool.mode === "volume") {
      if (!fnA) {
        return emptyOverlay("\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u0443\u044e \u0444\u0443\u043d\u043a\u0446\u0438\u044e \u0434\u043b\u044f \u043e\u0431\u044a\u0435\u043c\u0430 \u0432\u0440\u0430\u0449\u0435\u043d\u0438\u044f.");
      }
      const texA = expressionA ? expressionToTex(expressionA.normalized) : "f(x)";
      const texB = expressionB ? expressionToTex(expressionB.normalized) : "g(x)";
      const intervalLabel = formatIntervalText(a, b, 3);
      const previewBounds = estimatePreviewBounds(a, b);
      const sq = (value: number) => value * value;

      if (expressionB && hasInfiniteBounds(a, b)) {
        return {
          regions: [],
          polygons: [],
          polylines: [],
          points: [],
          verticals: buildVerticals(a, b),
          metrics: [
            { label: "\u041e\u0431\u044a\u0451\u043c", value: "\u043d\u0435 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044f", tone: "violet" },
            { label: "\u0418\u043d\u0442\u0435\u0440\u0432\u0430\u043b", value: intervalLabel, tone: "slate" },
            statusMetric("\u0428\u0430\u0439\u0431\u044b \u043c\u0435\u0436\u0434\u0443 \u0434\u0432\u0443\u043c\u044f \u043a\u0440\u0438\u0432\u044b\u043c\u0438 \u043f\u043e\u043a\u0430 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u044e\u0442\u0441\u044f \u0442\u043e\u043b\u044c\u043a\u043e \u043d\u0430 \u043a\u043e\u043d\u0435\u0447\u043d\u043e\u043c \u043e\u0442\u0440\u0435\u0437\u043a\u0435."),
          ],
          formulaTex: "V = \\pi \\int_a^b \\left(R(x)^2-r(x)^2\\right)\\,dx",
          formulaSteps: [
            "V = \\pi \\int_a^b \\left(R(x)^2-r(x)^2\\right)\\,dx",
            "\\text{Бесконечные границы для шайб в этой итерации не поддерживаются}",
          ],
          explanation: [
            "\u0412 \u044d\u0442\u043e\u0439 \u0438\u0442\u0435\u0440\u0430\u0446\u0438\u0438 \u0448\u0430\u0439\u0431\u044b \u0432\u043e\u043a\u0440\u0443\u0433 Ox \u0434\u043e\u0432\u0435\u0434\u0435\u043d\u044b \u0434\u043b\u044f \u044f\u0432\u043d\u044b\u0445 y=f(x), y=g(x) \u043d\u0430 \u043a\u043e\u043d\u0435\u0447\u043d\u043e\u043c \u043e\u0442\u0440\u0435\u0437\u043a\u0435.",
            "\u0412\u043c\u0435\u0441\u0442\u043e \u043b\u043e\u0436\u043d\u043e\u0433\u043e \u0447\u0438\u0441\u043b\u0430 \u0440\u0435\u0436\u0438\u043c \u0432\u043e\u0437\u0432\u0440\u0430\u0449\u0430\u0435\u0442 safe-status \u0431\u0435\u0437 preview.",
          ],
          volumePreview: null,
        };
      }

      if (!expressionB) {
        const radiusSquare = (x: number) => {
          const y = fnA(x);
          return Number.isFinite(y) ? Math.PI * sq(y) : Number.NaN;
        };
        const volumeEstimate = analyzeImproperIntegral(radiusSquare, a, b);
        const volumeFinite = estimateIsFinite(volumeEstimate);
        const finiteBounds = Number.isFinite(a) && Number.isFinite(b);
        const roots = finiteBounds ? findRoots(fnA, a, b) : [];
        const breaks = finiteBounds
          ? uniqueSorted([...findDiscontinuityBreaks(fnA, a, b), ...findSingularityCandidates(fnA, a, b)])
          : [];
        const intervals = finiteBounds ? buildIntervals(a, b, uniqueSorted([...roots, ...breaks])) : [];
        const regions: GraphRegion[] = [];

        if (volumeFinite) {
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
        }

        const [previewLeft, previewRight] = previewBounds;
        const slices = volumeFinite
          ? Array.from({ length: 36 }, (_, index) => {
              const x = previewLeft + ((previewRight - previewLeft) * index) / 35;
              const y = fnA(x);
              const outerR = Number.isFinite(y) ? Math.abs(y) : 0;
              return { x, outerR, innerR: 0, section: "disk" as const };
            })
          : [];
        const sampleX = previewLeft + (previewRight - previewLeft) * 0.58;
        const sampleY = fnA(sampleX);
        const sampleOuterR = Number.isFinite(sampleY) ? Math.abs(sampleY) : 0;

        return {
          regions: volumeFinite ? regions : [],
          polygons: [],
          polylines: [],
          points: volumeFinite && sampleOuterR > 0 ? [{ x: sampleX, y: sampleY, color: COLORS.violet, label: "R" }] : [],
          verticals: buildVerticals(a, b),
          metrics: [
            { label: "\u041e\u0431\u044a\u0451\u043c", value: volumeFinite ? formatIntegralEstimate(volumeEstimate) : "расходится", tone: "violet" },
            { label: "\u0420\u0430\u0434\u0438\u0443\u0441 \u0441\u0435\u0447\u0435\u043d\u0438\u044f", value: volumeFinite ? formatNumber(sampleOuterR) : "\u043d\u0435\u0442", tone: "amber" },
            { label: "\u0418\u043d\u0442\u0435\u0440\u0432\u0430\u043b", value: intervalLabel, tone: "slate" },
            ...(volumeFinite ? [] : [statusMetric("\u041d\u0435\u0441\u043e\u0431\u0441\u0442\u0432\u0435\u043d\u043d\u044b\u0439 \u0438\u043d\u0442\u0435\u0433\u0440\u0430\u043b \u043e\u0431\u044a\u0451\u043c\u0430 \u043d\u0435 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0430\u0435\u0442 \u043a\u043e\u043d\u0435\u0447\u043d\u043e\u0435 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435.")]),
          ],
          formulaTex: "V = \\pi \\int_a^b (f(x))^2\\,dx",
          formulaSteps: [
            "V = \\pi \\int_a^b (f(x))^2\\,dx",
            `V = \\pi \\int_{${formatBoundTex(a, 3)}}^{${formatBoundTex(b, 3)}} \\left(${texA}\\right)^2\\,dx`,
            volumeFinite ? `V = ${integralEstimateTex(volumeEstimate)}` : "V = \\text{расходится}",
          ],
          explanation: volumeFinite
            ? [
                "\u041e\u0431\u044a\u0451\u043c \u0441\u0442\u0440\u043e\u0438\u0442\u0441\u044f \u043a\u0430\u043a \u0441\u0443\u043c\u043c\u0430 \u0442\u043e\u043d\u043a\u0438\u0445 \u0434\u0438\u0441\u043a\u043e\u0432 \u0440\u0430\u0434\u0438\u0443\u0441\u0430 |f(x)| \u0432\u043e\u043a\u0440\u0443\u0433 \u043e\u0441\u0438 Ox.",
                ...buildImproperConvergentExplanation(volumeEstimate),
              ]
            : [
                "\u0414\u043b\u044f \u043e\u0431\u044a\u0451\u043c\u0430 \u0430\u043d\u0430\u043b\u0438\u0437\u0438\u0440\u0443\u0435\u0442\u0441\u044f \u0438\u043c\u0435\u043d\u043d\u043e \u0438\u043d\u0442\u0435\u0433\u0440\u0430\u043b \\pi f(x)^2, \u0430 \u043d\u0435 \u043f\u043b\u043e\u0449\u0430\u0434\u044c.",
                ...buildImproperFailureExplanation(volumeEstimate),
              ],
          volumePreview: volumeFinite
            ? {
                a: previewLeft,
                b: previewRight,
                sampleX,
                sampleOuterR,
                sampleInnerR: 0,
                section: "disk",
                slices,
              }
            : null,
        };
      }

      const rootsA = findRoots(fnA, a, b);
      const rootsB = findRoots(fnB!, a, b);
      const diff = (x: number) => fnA(x) - fnB!(x);
      const intersections = findRoots(diff, a, b);
      const singularities = uniqueSorted([
        ...findSingularityCandidates(fnA, a, b),
        ...findSingularityCandidates(fnB!, a, b),
        ...findSingularityCandidates(diff, a, b),
      ]);
      const breaks = uniqueSorted([
        ...rootsA,
        ...rootsB,
        ...intersections,
        ...findDiscontinuityBreaks(fnA, a, b),
        ...findDiscontinuityBreaks(fnB!, a, b),
        ...singularities,
      ]);
      const intervals = buildIntervals(a, b, breaks);
      const regions: GraphRegion[] = [];
      const segmentSteps: string[] = [];
      const segmentEstimates: ImproperIntegralEstimate[] = [];
      const segments: Array<{
        left: number;
        right: number;
        outerFn: (x: number) => number;
        innerFn: (x: number) => number;
        outerTex: string;
        innerTex: string;
        section: "disk" | "washer";
      }> = [];

      for (const [left, right] of intervals) {
        const midpoint = (left + right) / 2;
        const yA = fnA(midpoint);
        const yB = fnB!(midpoint);
        if (!Number.isFinite(yA) || !Number.isFinite(yB)) {
          continue;
        }

        const absA = Math.abs(yA);
        const absB = Math.abs(yB);
        const crossesAxis = yA === 0 || yB === 0 || Math.sign(yA) !== Math.sign(yB);
        const outerIsA = absA >= absB;
        const outerFn = outerIsA ? fnA : fnB!;
        const outerTex = outerIsA ? texA : texB;
        const innerFn = crossesAxis ? (() => 0) : outerIsA ? fnB! : fnA;
        const innerTex = crossesAxis ? "0" : outerIsA ? texB : texA;
        const section = crossesAxis ? "disk" : "washer";

        const estimate = analyzeImproperIntegral((x) => {
          const outer = outerFn(x);
          const inner = innerFn(x);
          if (!Number.isFinite(outer) || !Number.isFinite(inner)) {
            return Number.NaN;
          }
          return Math.PI * (sq(Math.abs(outer)) - sq(Math.abs(inner)));
        }, left, right);

        segments.push({ left, right, outerFn, innerFn, outerTex, innerTex, section });
        segmentEstimates.push(estimate);

        if (estimateIsFinite(estimate)) {
          segmentSteps.push(
            `V_${segmentSteps.length + 1} = \\pi \\int_{${formatBoundTex(left, 3)}}^{${formatBoundTex(right, 3)}} \\left((${outerTex})^2 - (${innerTex})^2\\right)\\,dx`,
          );
        }

        const topFn = yA >= yB ? fnA : fnB!;
        const bottomFn = yA >= yB ? fnB! : fnA;
        regions.push({
          x1: left,
          x2: right,
          topFn,
          bottomFn,
          fill: COLORS.violet,
          opacity: 0.18,
          stroke: COLORS.violet,
          strokeWidth: 1,
        });
      }

      if (!segments.length) {
        return emptyOverlay("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0431\u0440\u0430\u0442\u044c \u043e\u0433\u0440\u0430\u043d\u0438\u0447\u0435\u043d\u043d\u0443\u044e \u043e\u0431\u043b\u0430\u0441\u0442\u044c \u0434\u043b\u044f \u043e\u0431\u044a\u0451\u043c\u0430 \u0432\u0440\u0430\u0449\u0435\u043d\u0438\u044f.");
      }

      const volumeEstimate = mergeImproperEstimates(segmentEstimates);
      const volumeFinite = estimateIsFinite(volumeEstimate) && segmentEstimates.every(estimateIsFinite);
      const [previewLeft, previewRight] = previewBounds;
      const pickSegment = (x: number) =>
        segments.find((segment, index) => x >= segment.left && (x <= segment.right || index === segments.length - 1)) ?? null;
      const slices = volumeFinite
        ? Array.from({ length: 36 }, (_, index) => {
            const x = previewLeft + ((previewRight - previewLeft) * index) / 35;
            const segment = pickSegment(x);
            if (!segment) {
              return { x, outerR: 0, innerR: 0, section: "disk" as const };
            }
            const outer = Math.abs(segment.outerFn(x));
            const inner = Math.abs(segment.innerFn(x));
            return {
              x,
              outerR: Number.isFinite(outer) ? outer : 0,
              innerR: Number.isFinite(inner) ? inner : 0,
              section: segment.section,
            };
          })
        : [];
      const sampleX = previewLeft + (previewRight - previewLeft) * 0.58;
      const sampleSegment = pickSegment(sampleX);
      const sampleOuterR =
        sampleSegment && Number.isFinite(sampleSegment.outerFn(sampleX)) ? Math.abs(sampleSegment.outerFn(sampleX)) : 0;
      const sampleInnerR =
        sampleSegment && Number.isFinite(sampleSegment.innerFn(sampleX)) ? Math.abs(sampleSegment.innerFn(sampleX)) : 0;

      return {
        regions: volumeFinite ? regions : [],
        polygons: [],
        polylines: [],
        points: volumeFinite && sampleSegment
          ? [
              { x: sampleX, y: sampleSegment.outerFn(sampleX), color: COLORS.violet, label: "R" },
              ...(sampleInnerR > 0
                ? [{ x: sampleX, y: sampleSegment.innerFn(sampleX), color: COLORS.amber, label: "r" }]
                : []),
            ]
          : [],
        verticals: buildVerticals(a, b),
        metrics: [
          { label: "\u041e\u0431\u044a\u0451\u043c", value: volumeFinite ? formatIntegralEstimate(volumeEstimate) : "расходится", tone: "violet" },
          {
            label: "\u0422\u0438\u043f \u0441\u0435\u0447\u0435\u043d\u0438\u044f",
            value: sampleSegment?.section === "washer" ? "\u0448\u0430\u0439\u0431\u0430" : "\u0434\u0438\u0441\u043a",
            tone: "amber",
          },
          { label: "\u0418\u043d\u0442\u0435\u0440\u0432\u0430\u043b", value: intervalLabel, tone: "slate" },
          ...(volumeFinite ? [] : [statusMetric("\u041d\u0435\u0441\u043e\u0431\u0441\u0442\u0432\u0435\u043d\u043d\u044b\u0439 \u0438\u043d\u0442\u0435\u0433\u0440\u0430\u043b \u043e\u0431\u044a\u0451\u043c\u0430 \u043d\u0435 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0430\u0435\u0442 \u043a\u043e\u043d\u0435\u0447\u043d\u043e\u0435 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435.")]),
        ],
        formulaTex: "V = \\pi \\int_a^b \\left(R(x)^2-r(x)^2\\right)\\,dx",
        formulaSteps: volumeFinite
          ? [
              "V = \\pi \\int_a^b \\left(R(x)^2-r(x)^2\\right)\\,dx",
              ...segmentSteps,
              `V = ${integralEstimateTex(volumeEstimate)}`,
            ]
          : [
              "V = \\pi \\int_a^b \\left(R(x)^2-r(x)^2\\right)\\,dx",
              "\\text{Интервал разбивается по пересечениям, нулям и точкам разрыва}",
              "V = \\text{расходится}",
            ],
        explanation: volumeFinite
          ? [
              "\u041d\u0430 \u043a\u0430\u0436\u0434\u043e\u043c \u043a\u0443\u0441\u043a\u0435 \u0432\u043d\u0435\u0448\u043d\u0438\u0439 \u0438 \u0432\u043d\u0443\u0442\u0440\u0435\u043d\u043d\u0438\u0439 \u0440\u0430\u0434\u0438\u0443\u0441\u044b \u0431\u0435\u0440\u0443\u0442\u0441\u044f \u043a\u0430\u043a \u0440\u0430\u0441\u0441\u0442\u043e\u044f\u043d\u0438\u044f \u0434\u043e \u043e\u0441\u0438 Ox.",
              ...buildImproperConvergentExplanation(volumeEstimate),
            ]
          : [
              "\u041e\u0431\u044a\u0451\u043c \u0447\u0435\u0440\u0435\u0437 \u0448\u0430\u0439\u0431\u044b \u0430\u043d\u0430\u043b\u0438\u0437\u0438\u0440\u0443\u0435\u0442\u0441\u044f \u043a\u0430\u043a improper-\u0438\u043d\u0442\u0435\u0433\u0440\u0430\u043b \u043e\u0442 \\pi(R^2-r^2).",
              ...buildImproperFailureExplanation(volumeEstimate),
            ],
        volumePreview: volumeFinite
          ? {
              a: previewLeft,
              b: previewRight,
              sampleX,
              sampleOuterR,
              sampleInnerR,
              section: sampleSegment?.section ?? "disk",
              slices,
            }
          : null,
      };
    }

    return emptyOverlay("\u041d\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043d\u044b\u0439 \u0440\u0435\u0436\u0438\u043c \u0438\u043d\u0441\u0442\u0440\u0443\u043c\u0435\u043d\u0442\u0430.");
  } catch {
    return emptyOverlay("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043f\u043e\u0441\u0442\u0440\u043e\u0438\u0442\u044c overlay \u0434\u043b\u044f \u0442\u0435\u043a\u0443\u0449\u0435\u0433\u043e \u0441\u043e\u0441\u0442\u043e\u044f\u043d\u0438\u044f.");
  }
}

