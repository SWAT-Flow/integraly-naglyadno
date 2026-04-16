import { COLORS } from "../constants.js";
import { buildIntervals, findRoots, midpointIntegral, sortAB, uniqueSorted } from "../math/numeric.js";
import { expressionToTex, formatExpressionText } from "../math/parser.js";
import { normalizeTool } from "./normalizeTool.js";
function formatNumber(value, digits = 5) {
    if (!Number.isFinite(value)) {
        return "-";
    }
    const normalized = value.toFixed(digits).replace(/\.?0+$/, "");
    return normalized === "-0" ? "0" : normalized;
}
function emptyOverlay(message, metrics = []) {
    return {
        regions: [],
        polygons: [],
        polylines: [],
        points: [],
        verticals: [],
        metrics: metrics.length ? metrics : [{ label: "\u0421\u0442\u0430\u0442\u0443\u0441", value: message, tone: "slate" }],
        formulaTex: null,
        volumePreview: null,
    };
}
function statusMetric(message) {
    return { label: "\u0421\u0442\u0430\u0442\u0443\u0441", value: message, tone: "slate" };
}
function withOptionalStatus(metrics, message, enabled) {
    return enabled ? [statusMetric(message), ...metrics] : metrics;
}
function findDiscontinuityBreaks(fn, a, b, samples = 768) {
    const [left, right] = sortAB(a, b);
    if (!(right > left)) {
        return [];
    }
    const step = (right - left) / samples;
    const breaks = [];
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
function buildVerticals(a, b) {
    return [
        { x: a, label: "a", color: COLORS.slate, dash: [6, 6] },
        { x: b, label: "b", color: COLORS.slate, dash: [6, 6] },
    ];
}
function createRectangle(x1, x2, y) {
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
function createTrapezoid(x1, y1, x2, y2) {
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
function safeEvaluate(fn, x) {
    try {
        const value = fn(x);
        return Number.isFinite(value) ? value : Number.NaN;
    }
    catch {
        return Number.NaN;
    }
}
function resolveExpression(expressionId, expressions, expressionMap) {
    if (!expressionId) {
        return null;
    }
    return expressionMap.get(expressionId) ?? expressions.find((expression) => expression.id === expressionId) ?? null;
}
function mergeBetweenSegments(segments) {
    if (!segments.length) {
        return [];
    }
    const merged = [segments[0]];
    for (let index = 1; index < segments.length; index += 1) {
        const current = segments[index];
        const previous = merged[merged.length - 1];
        if (previous.topExpression.id === current.topExpression.id &&
            previous.bottomExpression.id === current.bottomExpression.id &&
            Math.abs(previous.right - current.left) < 1e-6) {
            previous.right = current.right;
            continue;
        }
        merged.push(current);
    }
    return merged;
}
function expressionDisplayLabel(expression) {
    return `${expression.orientation === "xOfY" ? "x" : "y"} = ${formatExpressionText(expression.normalized)}`;
}
function buildBetweenFormulaTex(segments) {
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
export function buildOverlay(rawTool, validExpressions, validMap) {
    try {
        const expressions = Array.isArray(validExpressions) ? validExpressions : [];
        const expressionMap = validMap instanceof Map ? validMap : new Map(expressions.map((expression) => [expression.id, expression]));
        const tool = normalizeTool(rawTool ?? {}, expressions);
        const [a, b] = sortAB(tool.a, tool.b);
        if (tool.mode === "none") {
            return emptyOverlay(expressions.length
                ? "\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0438\u043d\u0441\u0442\u0440\u0443\u043c\u0435\u043d\u0442 \u0441\u043f\u0440\u0430\u0432\u0430, \u0447\u0442\u043e\u0431\u044b \u043f\u043e\u0441\u0442\u0440\u043e\u0438\u0442\u044c \u043e\u0431\u043b\u0430\u0441\u0442\u044c \u0438\u043b\u0438 \u0447\u0438\u0441\u043b\u0435\u043d\u043d\u043e\u0435 \u043f\u0440\u0438\u0431\u043b\u0438\u0436\u0435\u043d\u0438\u0435."
                : "\u0414\u043e\u0431\u0430\u0432\u044c\u0442\u0435 \u0445\u043e\u0442\u044f \u0431\u044b \u043e\u0434\u043d\u0443 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u0443\u044e \u0444\u0443\u043d\u043a\u0446\u0438\u044e.");
        }
        const expressionA = resolveExpression(tool.exprA, expressions, expressionMap);
        const expressionB = resolveExpression(tool.exprB, expressions, expressionMap);
        if (expressionA && expressionA.orientation !== "yOfX") {
            return emptyOverlay("\u0418\u043d\u0441\u0442\u0440\u0443\u043c\u0435\u043d\u0442\u044b \u0438\u043d\u0442\u0435\u0433\u0440\u0430\u043b\u0430 \u0438 \u043e\u0431\u044a\u0435\u043c\u0430 \u0441\u0435\u0439\u0447\u0430\u0441 \u0440\u0430\u0431\u043e\u0442\u0430\u044e\u0442 \u0442\u043e\u043b\u044c\u043a\u043e \u0434\u043b\u044f y = f(x).");
        }
        if (expressionB && expressionB.orientation !== "yOfX") {
            return emptyOverlay("\u0420\u0435\u0436\u0438\u043c \u043c\u0435\u0436\u0434\u0443 \u0433\u0440\u0430\u0444\u0438\u043a\u0430\u043c\u0438 \u0441\u0435\u0439\u0447\u0430\u0441 \u0440\u0430\u0431\u043e\u0442\u0430\u0435\u0442 \u0442\u043e\u043b\u044c\u043a\u043e \u0434\u043b\u044f y = f(x).");
        }
        const fnA = expressionA ? (x) => safeEvaluate(expressionA.evaluate, x) : null;
        const fnB = expressionB ? (x) => safeEvaluate(expressionB.evaluate, x) : null;
        if (tool.mode === "under") {
            if (!fnA) {
                return emptyOverlay("\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u0443\u044e \u0444\u0443\u043d\u043a\u0446\u0438\u044e \u0434\u043b\u044f \u043f\u043b\u043e\u0449\u0430\u0434\u0438 \u043f\u043e\u0434 \u0433\u0440\u0430\u0444\u0438\u043a\u043e\u043c.");
            }
            const roots = findRoots(fnA, a, b);
            const breaks = findDiscontinuityBreaks(fnA, a, b);
            const intervals = buildIntervals(a, b, uniqueSorted([...roots, ...breaks]));
            const regions = [];
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
                    fill: positive ? COLORS.blue : COLORS.rose,
                    opacity: 0.2,
                    stroke: positive ? COLORS.blue : COLORS.rose,
                    strokeWidth: 1,
                });
            }
            const signedIntegral = midpointIntegral(fnA, a, b);
            const geometricArea = midpointIntegral((x) => Math.abs(fnA(x)), a, b);
            const points = roots
                .map((x) => ({ x, y: 0, color: COLORS.violet, label: `x=${formatNumber(x, 3)}` }))
                .filter((point) => point.x >= a && point.x <= b);
            return {
                regions,
                polygons: [],
                polylines: [],
                points,
                verticals: buildVerticals(a, b),
                metrics: withOptionalStatus([
                    { label: "\u0418\u043d\u0442\u0435\u0440\u0432\u0430\u043b", value: `[${formatNumber(a, 3)}; ${formatNumber(b, 3)}]`, tone: "slate" },
                    {
                        label: "\u041f\u043e\u0434\u043f\u0438\u0441\u0430\u043d\u043d\u044b\u0439 \u0438\u043d\u0442\u0435\u0433\u0440\u0430\u043b",
                        value: formatNumber(signedIntegral),
                        tone: "blue",
                    },
                    {
                        label: "\u0413\u0435\u043e\u043c\u0435\u0442\u0440\u0438\u0447\u0435\u0441\u043a\u0430\u044f \u043f\u043b\u043e\u0449\u0430\u0434\u044c",
                        value: formatNumber(geometricArea),
                        tone: "emerald",
                    },
                    { label: "\u041a\u043e\u0440\u043d\u0438", value: String(points.length), tone: "violet" },
                ], "\u041d\u0430 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u043c \u0438\u043d\u0442\u0435\u0440\u0432\u0430\u043b\u0435 \u043d\u0435\u0442 \u043a\u043e\u043d\u0435\u0447\u043d\u044b\u0445 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0439.", !regions.length && !Number.isFinite(signedIntegral) && !Number.isFinite(geometricArea)),
                formulaTex: "\\int_a^b f(x)\\,dx\\quad\\text{\u0438}\\quad\\int_a^b |f(x)|\\,dx",
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
            const expressionANonNull = expressionA;
            const expressionBNonNull = expressionB;
            const diff = (x) => fnA(x) - fnB(x);
            const roots = findRoots(diff, a, b);
            const breaks = uniqueSorted([
                ...findDiscontinuityBreaks(fnA, a, b),
                ...findDiscontinuityBreaks(fnB, a, b),
                ...findDiscontinuityBreaks(diff, a, b),
            ]);
            const intervals = buildIntervals(a, b, uniqueSorted([...roots, ...breaks]));
            const regions = [];
            const segments = [];
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
                .filter((point) => point !== null);
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
                label: mergedSegments.length === 1
                    ? "\u0412\u0435\u0440\u0445\u043d\u0438\u0439 \u0433\u0440\u0430\u0444\u0438\u043a"
                    : `\u0412\u0435\u0440\u0445 \u043d\u0430 [${formatNumber(segment.left, 3)}; ${formatNumber(segment.right, 3)}]`,
                value: expressionDisplayLabel(segment.topExpression),
                tone: index % 2 === 0 ? "blue" : "violet",
            }));
            return {
                regions,
                polygons: [],
                polylines: [],
                points: intersections,
                verticals: buildVerticals(a, b),
                metrics: withOptionalStatus([
                    { label: "\u0418\u043d\u0442\u0435\u0440\u0432\u0430\u043b", value: `[${formatNumber(a, 3)}; ${formatNumber(b, 3)}]`, tone: "slate" },
                    { label: "\u041f\u043b\u043e\u0449\u0430\u0434\u044c", value: formatNumber(area), tone: "emerald" },
                    {
                        label: "\u041f\u043e\u0434\u043f\u0438\u0441\u0430\u043d\u043d\u0430\u044f \u0440\u0430\u0437\u043d\u043e\u0441\u0442\u044c",
                        value: formatNumber(signedDifference),
                        tone: "blue",
                    },
                    { label: "\u041f\u0435\u0440\u0435\u0441\u0435\u0447\u0435\u043d\u0438\u044f", value: String(intersections.length), tone: "violet" },
                    ...orderingMetrics,
                ], "\u041d\u0430 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u043c \u0438\u043d\u0442\u0435\u0440\u0432\u0430\u043b\u0435 \u043d\u0435\u0442 \u043a\u043e\u043d\u0435\u0447\u043d\u043e\u0439 \u043e\u0431\u043b\u0430\u0441\u0442\u0438 \u043c\u0435\u0436\u0434\u0443 \u0433\u0440\u0430\u0444\u0438\u043a\u0430\u043c\u0438.", !regions.length && !Number.isFinite(area)),
                formulaTex: buildBetweenFormulaTex(mergedSegments),
                volumePreview: null,
            };
        }
        if (tool.mode === "riemann") {
            if (!fnA) {
                return emptyOverlay("\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u0443\u044e \u0444\u0443\u043d\u043a\u0446\u0438\u044e \u0434\u043b\u044f \u0441\u0443\u043c\u043c \u0420\u0438\u043c\u0430\u043d\u0430.");
            }
            const width = (b - a) / tool.n;
            const polygons = [];
            const points = [];
            let approx = 0;
            let used = 0;
            for (let index = 0; index < tool.n; index += 1) {
                const x1 = a + width * index;
                const x2 = x1 + width;
                const sampleX = tool.sample === "left"
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
                metrics: withOptionalStatus([
                    { label: "n", value: String(tool.n), tone: "slate" },
                    { label: "\u0412\u044b\u0431\u043e\u0440\u043a\u0430", value: tool.sample, tone: "violet" },
                    { label: "\u0421\u0443\u043c\u043c\u0430 \u0420\u0438\u043c\u0430\u043d\u0430", value: formatNumber(approx), tone: "blue" },
                    { label: "\u0418\u043d\u0442\u0435\u0433\u0440\u0430\u043b", value: formatNumber(exact), tone: "emerald" },
                    { label: "\u0410\u0431\u0441. \u043e\u0448\u0438\u0431\u043a\u0430", value: formatNumber(Math.abs(approx - exact)), tone: "rose" },
                    { label: "\u041f\u0440\u044f\u043c\u043e\u0443\u0433\u043e\u043b\u044c\u043d\u0438\u043a\u043e\u0432", value: String(used), tone: "amber" },
                ], "\u041d\u0430 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u043c \u0440\u0430\u0437\u0431\u0438\u0435\u043d\u0438\u0438 \u043d\u0435\u0442 \u043a\u043e\u043d\u0435\u0447\u043d\u044b\u0445 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0439.", used === 0),
                formulaTex: "S_n = \\sum_{i=1}^{n} f(\\xi_i)\\,\\Delta x",
                volumePreview: null,
            };
        }
        if (tool.mode === "trap") {
            if (!fnA) {
                return emptyOverlay("\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u0443\u044e \u0444\u0443\u043d\u043a\u0446\u0438\u044e \u0434\u043b\u044f \u043c\u0435\u0442\u043e\u0434\u0430 \u0442\u0440\u0430\u043f\u0435\u0446\u0438\u0439.");
            }
            const width = (b - a) / tool.n;
            const polygons = [];
            const polylines = [];
            const points = [];
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
                metrics: withOptionalStatus([
                    { label: "n", value: String(tool.n), tone: "slate" },
                    { label: "\u0428\u0430\u0433 h", value: formatNumber(width), tone: "amber" },
                    { label: "\u0422\u0440\u0430\u043f\u0435\u0446\u0438\u0438", value: formatNumber(approx), tone: "blue" },
                    { label: "\u0418\u043d\u0442\u0435\u0433\u0440\u0430\u043b", value: formatNumber(exact), tone: "emerald" },
                    { label: "\u0410\u0431\u0441. \u043e\u0448\u0438\u0431\u043a\u0430", value: formatNumber(Math.abs(approx - exact)), tone: "rose" },
                    { label: "\u0422\u0440\u0430\u043f\u0435\u0446\u0438\u0439", value: String(used), tone: "violet" },
                ], "\u041d\u0430 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u043c \u0438\u043d\u0442\u0435\u0440\u0432\u0430\u043b\u0435 \u043d\u0435\u0442 \u043a\u043e\u043d\u0435\u0447\u043d\u044b\u0445 \u0442\u0440\u0430\u043f\u0435\u0446\u0438\u0439.", used === 0),
                formulaTex: "\\int_a^b f(x)\\,dx \\approx \\frac{h}{2}\\bigl(f(x_0)+2\\sum_{i=1}^{n-1}f(x_i)+f(x_n)\\bigr)",
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
            const regions = [];
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
                metrics: withOptionalStatus([
                    { label: "\u0418\u043d\u0442\u0435\u0440\u0432\u0430\u043b", value: `[${formatNumber(a, 3)}; ${formatNumber(b, 3)}]`, tone: "slate" },
                    { label: "\u041e\u0431\u044a\u0435\u043c", value: formatNumber(volume), tone: "violet" },
                    { label: "\u0420\u0430\u0434\u0438\u0443\u0441 \u0441\u0435\u0447\u0435\u043d\u0438\u044f", value: formatNumber(sampleR), tone: "amber" },
                ], "\u041d\u0430 \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u043c \u0438\u043d\u0442\u0435\u0440\u0432\u0430\u043b\u0435 \u043d\u0435\u0442 \u043a\u043e\u043d\u0435\u0447\u043d\u044b\u0445 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0439 \u0434\u043b\u044f \u043f\u043e\u0441\u0442\u0440\u043e\u0435\u043d\u0438\u044f \u0442\u0435\u043b\u0430 \u0432\u0440\u0430\u0449\u0435\u043d\u0438\u044f.", !Number.isFinite(volume)),
                formulaTex: "V = \\pi \\int_a^b (f(x))^2\\,dx",
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
    }
    catch {
        return emptyOverlay("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043f\u043e\u0441\u0442\u0440\u043e\u0438\u0442\u044c overlay \u0434\u043b\u044f \u0442\u0435\u043a\u0443\u0449\u0435\u0433\u043e \u0441\u043e\u0441\u0442\u043e\u044f\u043d\u0438\u044f.");
    }
}

