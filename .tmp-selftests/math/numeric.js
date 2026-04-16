import { X_LIMITS } from "../constants.js";
export function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
export function asFinite(value, fallback = Number.NaN) {
    const numeric = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}
export function sortAB(a, b, fallbackA = -2, fallbackB = 2) {
    const safeA = asFinite(a, fallbackA);
    const safeB = asFinite(b, fallbackB);
    return safeA <= safeB ? [safeA, safeB] : [safeB, safeA];
}
export function uniqueSorted(values, epsilon = 1e-6) {
    const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
    const result = [];
    for (const value of sorted) {
        if (!result.length || Math.abs(value - result[result.length - 1]) > epsilon) {
            result.push(value);
        }
    }
    return result;
}
export function bisectRoot(fn, a, b, tolerance = 1e-7, maxIterations = 64) {
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
        }
        else {
            left = mid;
            leftValue = midValue;
        }
    }
    return (left + right) / 2;
}
export function findRoots(fn, a, b, samples = 768, epsilon = 1e-6) {
    const [left, right] = sortAB(a, b);
    if (!(right > left)) {
        return [];
    }
    const roots = [];
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
export function buildIntervals(a, b, breaks) {
    const [left, right] = sortAB(a, b);
    const bounds = uniqueSorted([left, ...breaks.filter((value) => value > left && value < right), right]);
    const result = [];
    for (let index = 0; index < bounds.length - 1; index += 1) {
        const start = bounds[index];
        const end = bounds[index + 1];
        if (end - start > 1e-6) {
            result.push([start, end]);
        }
    }
    return result;
}
export function midpointIntegral(fn, a, b, segments = 1600) {
    if (a === b) {
        return 0;
    }
    const sign = a <= b ? 1 : -1;
    const [left, right] = sortAB(a, b);
    const width = right - left;
    if (width <= 0) {
        return 0;
    }
    const step = width / segments;
    let sum = 0;
    let validCount = 0;
    for (let index = 0; index < segments; index += 1) {
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
export function niceStep(span, targetTicks = 10) {
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
export function clampView(view) {
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
    }
    else {
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

