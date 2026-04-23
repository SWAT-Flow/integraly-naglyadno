import type { ViewBox } from "../types";
import { X_LIMITS } from "../constants";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function asFinite(value: unknown, fallback = Number.NaN): number {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function sortAB(a: unknown, b: unknown, fallbackA = -2, fallbackB = 2): [number, number] {
  const safeA = asFinite(a, fallbackA);
  const safeB = asFinite(b, fallbackB);
  return safeA <= safeB ? [safeA, safeB] : [safeB, safeA];
}

export function uniqueSorted(values: number[], epsilon = 1e-6): number[] {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  const result: number[] = [];
  for (const value of sorted) {
    if (!result.length || Math.abs(value - result[result.length - 1]) > epsilon) {
      result.push(value);
    }
  }
  return result;
}

export function bisectRoot(
  fn: (x: number) => number,
  a: number,
  b: number,
  tolerance = 1e-7,
  maxIterations = 64,
): number | null {
  let left = a;
  let right = b;
  let leftValue = fn(left);
  let rightValue = fn(right);

  if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue)) {
    return null;
  }
  if (Math.abs(leftValue) < tolerance) {
    return left;
  }
  if (Math.abs(rightValue) < tolerance) {
    return right;
  }
  if (leftValue * rightValue > 0) {
    return null;
  }

  for (let index = 0; index < maxIterations; index += 1) {
    const mid = (left + right) / 2;
    const midValue = fn(mid);
    if (!Number.isFinite(midValue)) {
      return null;
    }
    if (Math.abs(midValue) < tolerance || Math.abs(right - left) < tolerance) {
      return mid;
    }
    if (leftValue * midValue <= 0) {
      right = mid;
      rightValue = midValue;
    } else {
      left = mid;
      leftValue = midValue;
    }
  }

  return (left + right) / 2;
}

export function findRoots(
  fn: (x: number) => number,
  a: number,
  b: number,
  samples = 768,
  epsilon = 1e-6,
): number[] {
  const [left, right] = sortAB(a, b);
  if (!(right > left)) {
    return [];
  }

  const roots: number[] = [];
  const step = (right - left) / samples;
  let previousX = left;
  let previousY = fn(previousX);

  if (Number.isFinite(previousY) && Math.abs(previousY) < epsilon) {
    roots.push(previousX);
  }

  for (let index = 1; index <= samples; index += 1) {
    const x = index === samples ? right : left + step * index;
    const y = fn(x);
    if (Number.isFinite(previousY) && Number.isFinite(y)) {
      if (Math.abs(y) < epsilon) {
        roots.push(x);
      }
      if (previousY * y < 0) {
        const root = bisectRoot(fn, previousX, x, epsilon);
        if (root !== null) {
          roots.push(root);
        }
      }
    }
    previousX = x;
    previousY = y;
  }

  return uniqueSorted(roots, epsilon * 10);
}

export function buildIntervals(a: number, b: number, breaks: number[]): Array<[number, number]> {
  const [left, right] = sortAB(a, b);
  const bounds = uniqueSorted([left, ...breaks.filter((value) => value > left && value < right), right]);
  const result: Array<[number, number]> = [];
  for (let index = 0; index < bounds.length - 1; index += 1) {
    const start = bounds[index];
    const end = bounds[index + 1];
    if (end - start > 1e-6) {
      result.push([start, end]);
    }
  }
  return result;
}

export function midpointIntegral(
  fn: (x: number) => number,
  a: number,
  b: number,
  segments = 1600,
): number {
  if (a === b) {
    return 0;
  }

  const sign = a <= b ? 1 : -1;
  const [left, right] = sortAB(a, b);
  const width = right - left;
  if (width <= 0) {
    return 0;
  }

  const adaptiveSegments = Math.min(12000, Math.max(segments, Math.ceil(width * 12)));
  const step = width / adaptiveSegments;
  let sum = 0;
  let validCount = 0;

  for (let index = 0; index < adaptiveSegments; index += 1) {
    const x = left + step * (index + 0.5);
    const y = fn(x);
    if (!Number.isFinite(y)) {
      continue;
    }
    sum += y;
    validCount += 1;
  }

  if (!validCount) {
    return Number.NaN;
  }

  return sign * sum * step;
}

function safeSample(fn: (x: number) => number, x: number): number {
  try {
    const value = fn(x);
    return Number.isFinite(value) ? value : Number.NaN;
  } catch {
    return Number.NaN;
  }
}

function sampleSeverity(value: number): number {
  return Number.isFinite(value) ? Math.abs(value) : Number.POSITIVE_INFINITY;
}

function suspiciousTriple(leftValue: number, middleValue: number, rightValue: number): boolean {
  const values = [leftValue, middleValue, rightValue];
  if (values.some((value) => !Number.isFinite(value))) {
    return true;
  }

  const magnitudes = values.map((value) => Math.abs(value));
  const maxMagnitude = Math.max(...magnitudes);
  if (maxMagnitude < 48) {
    return false;
  }

  const minMagnitude = Math.max(1, Math.min(...magnitudes));
  const explosiveRatio = maxMagnitude / minMagnitude > 24;
  const jumpLeft = Math.abs(middleValue - leftValue) > Math.max(32, Math.abs(leftValue) * 6);
  const jumpRight = Math.abs(rightValue - middleValue) > Math.max(32, Math.abs(rightValue) * 6);
  const signFlip =
    Math.sign(leftValue) !== Math.sign(middleValue) || Math.sign(middleValue) !== Math.sign(rightValue);

  return explosiveRatio && (jumpLeft || jumpRight || signFlip);
}

function refineSingularityCandidate(
  fn: (x: number) => number,
  left: number,
  right: number,
  iterations = 12,
): number {
  let start = left;
  let end = right;

  for (let index = 0; index < iterations; index += 1) {
    const span = end - start;
    if (!(span > 1e-8)) {
      break;
    }

    const x1 = start + span * 0.25;
    const x2 = start + span * 0.5;
    const x3 = start + span * 0.75;
    const samples = [
      { x: start, y: safeSample(fn, start) },
      { x: x1, y: safeSample(fn, x1) },
      { x: x2, y: safeSample(fn, x2) },
      { x: x3, y: safeSample(fn, x3) },
      { x: end, y: safeSample(fn, end) },
    ];

    const nonFiniteIndex = samples.findIndex((sample, sampleIndex) => sampleIndex > 0 && sampleIndex < 4 && !Number.isFinite(sample.y));
    if (nonFiniteIndex >= 0) {
      start = samples[nonFiniteIndex - 1].x;
      end = samples[nonFiniteIndex + 1].x;
      continue;
    }

    let bestLeft = start;
    let bestRight = end;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let sampleIndex = 0; sampleIndex < samples.length - 1; sampleIndex += 1) {
      const current = samples[sampleIndex];
      const next = samples[sampleIndex + 1];
      const currentSeverity = sampleSeverity(current.y);
      const nextSeverity = sampleSeverity(next.y);
      const minSeverity = Math.max(1, Math.min(currentSeverity, nextSeverity));
      const signWeight = Math.sign(current.y) !== Math.sign(next.y) ? 2 : 1;
      const score = Math.max(currentSeverity, nextSeverity) * signWeight * (Math.max(currentSeverity, nextSeverity) / minSeverity);

      if (score > bestScore) {
        bestScore = score;
        bestLeft = current.x;
        bestRight = next.x;
      }
    }

    if (!(bestRight - bestLeft < span)) {
      break;
    }

    start = bestLeft;
    end = bestRight;
  }

  return (start + end) / 2;
}

export function findSingularityCandidates(
  fn: (x: number) => number,
  a: number,
  b: number,
  samples = 1024,
): number[] {
  const [left, right] = sortAB(a, b);
  if (!(right > left)) {
    return [];
  }

  const step = (right - left) / samples;
  const grid = Array.from({ length: samples + 1 }, (_, index) => {
    const x = index === samples ? right : left + step * index;
    return { x, y: safeSample(fn, x) };
  });

  const candidates: number[] = [];
  for (let index = 1; index < grid.length - 1; index += 1) {
    const previous = grid[index - 1];
    const current = grid[index];
    const next = grid[index + 1];

    if (!Number.isFinite(current.y)) {
      candidates.push(current.x);
      continue;
    }

    if (!Number.isFinite(previous.y) || !Number.isFinite(next.y) || suspiciousTriple(previous.y, current.y, next.y)) {
      candidates.push(refineSingularityCandidate(fn, previous.x, next.x));
    }
  }

  const epsilon = Math.max(step * 3, 1e-4);
  const zeroSnapEpsilon = Math.max(step * 0.5, 1e-8);
  return uniqueSorted(
    candidates
      .map((value) => (Math.abs(value) <= zeroSnapEpsilon ? 0 : value))
      .filter((value) => value > left + epsilon && value < right - epsilon),
    epsilon,
  );
}

export function niceStep(span: number, targetTicks = 10): number {
  const safeSpan = Math.abs(asFinite(span, 1));
  if (safeSpan <= 0) {
    return 1;
  }

  const raw = safeSpan / Math.max(2, targetTicks);
  const power = 10 ** Math.floor(Math.log10(raw));
  const factor = raw / power;

  if (factor <= 1) {
    return power;
  }
  if (factor <= 2) {
    return 2 * power;
  }
  if (factor <= 5) {
    return 5 * power;
  }
  return 10 * power;
}

export function clampView(view: Partial<ViewBox>): ViewBox {
  const safeXMin = asFinite(view.xMin, -10);
  const safeXMax = asFinite(view.xMax, 10);
  const safeYMin = asFinite(view.yMin, -8);
  const safeYMax = asFinite(view.yMax, 8);

  let xMin = Math.min(safeXMin, safeXMax);
  let xMax = Math.max(safeXMin, safeXMax);
  let yMin = Math.min(safeYMin, safeYMax);
  let yMax = Math.max(safeYMin, safeYMax);

  if (xMax - xMin < 1e-4) {
    const center = (xMin + xMax) / 2;
    xMin = center - 1;
    xMax = center + 1;
  }
  if (yMax - yMin < 1e-4) {
    const center = (yMin + yMax) / 2;
    yMin = center - 1;
    yMax = center + 1;
  }

  const limitSpan = X_LIMITS[1] - X_LIMITS[0];
  const xSpan = xMax - xMin;
  if (xSpan >= limitSpan) {
    xMin = X_LIMITS[0];
    xMax = X_LIMITS[1];
  } else {
    if (xMin < X_LIMITS[0]) {
      const shift = X_LIMITS[0] - xMin;
      xMin += shift;
      xMax += shift;
    }
    if (xMax > X_LIMITS[1]) {
      const shift = xMax - X_LIMITS[1];
      xMin -= shift;
      xMax -= shift;
    }
    xMin = clamp(xMin, X_LIMITS[0], X_LIMITS[1] - xSpan);
    xMax = xMin + xSpan;
  }

  return { xMin, xMax, yMin, yMax };
}
