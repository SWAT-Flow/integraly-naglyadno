import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { IconButton } from "../components/ui.js";
import { COLORS } from "../constants.js";
import { clamp, clampView, niceStep } from "../math/numeric.js";
import { formatExpressionText } from "../math/parser.js";
import { decodeEscapedUnicode } from "../utils/decodeEscapedUnicode.js";
function formatTick(value) {
    if (!Number.isFinite(value)) {
        return "";
    }
    const digits = Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2;
    return value.toFixed(digits).replace(/\.?0+$/, "");
}
function drawPolygon(context, polygon, toX, toY) {
    if (polygon.points.length < 3) {
        return;
    }
    context.beginPath();
    polygon.points.forEach((point, index) => {
        if (index === 0) {
            context.moveTo(toX(point.x), toY(point.y));
        }
        else {
            context.lineTo(toX(point.x), toY(point.y));
        }
    });
    context.closePath();
    context.fillStyle = polygon.fill;
    context.globalAlpha = polygon.opacity ?? 0.2;
    context.fill();
    context.globalAlpha = 1;
    context.strokeStyle = polygon.stroke ?? polygon.fill;
    context.lineWidth = polygon.strokeWidth ?? 1.2;
    context.stroke();
}
function drawPolyline(context, polyline, toX, toY) {
    if (polyline.points.length < 2) {
        return;
    }
    context.beginPath();
    polyline.points.forEach((point, index) => {
        if (index === 0) {
            context.moveTo(toX(point.x), toY(point.y));
        }
        else {
            context.lineTo(toX(point.x), toY(point.y));
        }
    });
    context.setLineDash(polyline.dash ?? []);
    context.strokeStyle = polyline.stroke;
    context.lineWidth = polyline.strokeWidth ?? 2;
    context.stroke();
    context.setLineDash([]);
}
function sampleFunctionSegments(expression, view, plotWidth, plotHeight, samples) {
    const segments = [];
    let current = [];
    if (expression.orientation === "yOfX") {
        let previousScreenY = null;
        const ySpan = view.yMax - view.yMin;
        const extendedMin = view.yMin - ySpan * 3;
        const extendedMax = view.yMax + ySpan * 3;
        for (let index = 0; index <= samples; index += 1) {
            const x = view.xMin + ((view.xMax - view.xMin) * index) / samples;
            const y = expression.evaluate(x);
            if (!Number.isFinite(y) || y < extendedMin || y > extendedMax) {
                if (current.length > 1) {
                    segments.push(current);
                }
                current = [];
                previousScreenY = null;
                continue;
            }
            const screenY = ((view.yMax - y) / (view.yMax - view.yMin)) * plotHeight;
            if (previousScreenY !== null && Math.abs(screenY - previousScreenY) > plotHeight * 1.1) {
                if (current.length > 1) {
                    segments.push(current);
                }
                current = [];
            }
            current.push({ x, y });
            previousScreenY = screenY;
        }
    }
    else {
        let previousScreenX = null;
        const xSpan = view.xMax - view.xMin;
        const extendedMin = view.xMin - xSpan * 3;
        const extendedMax = view.xMax + xSpan * 3;
        for (let index = 0; index <= samples; index += 1) {
            const y = view.yMin + ((view.yMax - view.yMin) * index) / samples;
            const x = expression.evaluate(y);
            if (!Number.isFinite(x) || x < extendedMin || x > extendedMax) {
                if (current.length > 1) {
                    segments.push(current);
                }
                current = [];
                previousScreenX = null;
                continue;
            }
            const screenX = ((x - view.xMin) / (view.xMax - view.xMin)) * plotWidth;
            if (previousScreenX !== null && Math.abs(screenX - previousScreenX) > plotWidth * 1.1) {
                if (current.length > 1) {
                    segments.push(current);
                }
                current = [];
            }
            current.push({ x, y });
            previousScreenX = screenX;
        }
    }
    if (current.length > 1) {
        segments.push(current);
    }
    return segments;
}
function expressionLabel(expression) {
    const prefix = expression.orientation === "xOfY" ? "x = " : "y = ";
    return `${prefix}${formatExpressionText(expression.normalized || expression.raw)}`;
}
function sampleRegionPolygons(region, view, plotHeight, samples) {
    const left = Math.max(region.x1, view.xMin);
    const right = Math.min(region.x2, view.xMax);
    if (!(right > left)) {
        return [];
    }
    const polygons = [];
    let topPoints = [];
    let bottomPoints = [];
    let previousTopY = null;
    let previousBottomY = null;
    const flush = () => {
        if (topPoints.length > 1 && bottomPoints.length > 1) {
            polygons.push([...topPoints, ...bottomPoints.reverse()]);
        }
        topPoints = [];
        bottomPoints = [];
        previousTopY = null;
        previousBottomY = null;
    };
    for (let index = 0; index <= samples; index += 1) {
        const x = left + ((right - left) * index) / samples;
        const topY = region.topFn(x);
        const bottomY = region.bottomFn(x);
        if (!Number.isFinite(topY) || !Number.isFinite(bottomY)) {
            flush();
            continue;
        }
        const topScreenY = ((view.yMax - topY) / (view.yMax - view.yMin)) * plotHeight;
        const bottomScreenY = ((view.yMax - bottomY) / (view.yMax - view.yMin)) * plotHeight;
        const hasJump = previousTopY !== null &&
            previousBottomY !== null &&
            (Math.abs(topScreenY - previousTopY) > plotHeight * 1.1 ||
                Math.abs(bottomScreenY - previousBottomY) > plotHeight * 1.1);
        if (hasJump) {
            flush();
        }
        topPoints.push({ x, y: topY });
        bottomPoints.push({ x, y: bottomY });
        previousTopY = topScreenY;
        previousBottomY = bottomScreenY;
    }
    flush();
    return polygons;
}
function drawAxesAndGrid(context, view, geometry, size, toX, toY) {
    const { padding } = geometry;
    const xStep = niceStep(view.xMax - view.xMin, 10);
    const yStep = niceStep(view.yMax - view.yMin, 8);
    const hasXAxis = view.yMin <= 0 && view.yMax >= 0;
    const hasYAxis = view.xMin <= 0 && view.xMax >= 0;
    const axisY = hasXAxis ? toY(0) : size.height - padding.bottom;
    const axisX = hasYAxis ? toX(0) : padding.left;
    const xLabelY = clamp(axisY + 4, padding.top + 2, size.height - padding.bottom - 16);
    const placeYLabelsRight = axisX < size.width - padding.right - 56;
    const yLabelX = clamp(axisX + (placeYLabelsRight ? 8 : -8), padding.left + 8, size.width - padding.right - 8);
    context.save();
    context.strokeStyle = COLORS.grid;
    context.fillStyle = COLORS.slate;
    context.lineWidth = 1;
    context.font = "12px ui-sans-serif, system-ui, sans-serif";
    const xStart = Math.ceil(view.xMin / xStep) * xStep;
    for (let x = xStart; x <= view.xMax + xStep * 0.5; x += xStep) {
        const screenX = toX(x);
        context.beginPath();
        context.moveTo(screenX, padding.top);
        context.lineTo(screenX, size.height - padding.bottom);
        context.stroke();
        if (!(hasYAxis && Math.abs(x) < xStep * 0.25)) {
            context.textAlign = "center";
            context.textBaseline = "top";
            context.fillText(formatTick(x), screenX, xLabelY);
        }
    }
    const yStart = Math.ceil(view.yMin / yStep) * yStep;
    for (let y = yStart; y <= view.yMax + yStep * 0.5; y += yStep) {
        const screenY = toY(y);
        context.beginPath();
        context.moveTo(padding.left, screenY);
        context.lineTo(size.width - padding.right, screenY);
        context.stroke();
        if (!(hasXAxis && Math.abs(y) < yStep * 0.25)) {
            context.textAlign = placeYLabelsRight ? "left" : "right";
            context.textBaseline = "middle";
            context.fillText(formatTick(y), yLabelX, screenY);
        }
    }
    context.strokeStyle = COLORS.ink;
    context.lineWidth = 1.5;
    if (hasXAxis) {
        context.beginPath();
        context.moveTo(padding.left, axisY);
        context.lineTo(size.width - padding.right, axisY);
        context.stroke();
    }
    if (hasYAxis) {
        context.beginPath();
        context.moveTo(axisX, padding.top);
        context.lineTo(axisX, size.height - padding.bottom);
        context.stroke();
    }
    context.restore();
}
function drawPoints(context, points, view, size, geometry, toX, toY) {
    const { padding } = geometry;
    context.save();
    context.font = "12px ui-sans-serif, system-ui, sans-serif";
    for (const point of points) {
        if (point.x < view.xMin ||
            point.x > view.xMax ||
            point.y < view.yMin - (view.yMax - view.yMin) * 0.5 ||
            point.y > view.yMax + (view.yMax - view.yMin) * 0.5) {
            continue;
        }
        const x = toX(point.x);
        const y = toY(point.y);
        context.fillStyle = point.color ?? COLORS.ink;
        context.beginPath();
        context.arc(x, y, point.radius ?? 4, 0, Math.PI * 2);
        context.fill();
        if (point.label) {
            context.fillStyle = COLORS.slate;
            context.fillText(point.label, clamp(x + 7, padding.left + 4, size.width - 120), clamp(y - 8, padding.top + 12, size.height - padding.bottom - 8));
        }
    }
    context.restore();
}
function drawVerticals(context, verticals, view, size, geometry, toX) {
    const { padding } = geometry;
    context.save();
    context.font = "12px ui-sans-serif, system-ui, sans-serif";
    for (const vertical of verticals) {
        if (vertical.x < view.xMin || vertical.x > view.xMax) {
            continue;
        }
        const x = toX(vertical.x);
        context.setLineDash(vertical.dash ?? [6, 6]);
        context.strokeStyle = vertical.color ?? COLORS.slate;
        context.beginPath();
        context.moveTo(x, padding.top);
        context.lineTo(x, size.height - padding.bottom);
        context.stroke();
        context.setLineDash([]);
        if (vertical.label) {
            context.fillStyle = vertical.color ?? COLORS.slate;
            context.fillText(vertical.label, x + 5, padding.top + 14);
        }
    }
    context.restore();
}
export function GraphCanvas({ expressions, overlay, defaultView }) {
    const wrapperRef = useRef(null);
    const canvasRef = useRef(null);
    const [size, setSize] = useState({ width: 900, height: 520 });
    const [view, setView] = useState(() => clampView(defaultView));
    const [dragging, setDragging] = useState(false);
    const dragRef = useRef(null);
    const normalizedDefaultView = useMemo(() => clampView(defaultView), [defaultView]);
    useEffect(() => {
        const element = wrapperRef.current;
        if (!element) {
            return undefined;
        }
        const lockPageScroll = (event) => {
            event.preventDefault();
        };
        element.addEventListener("wheel", lockPageScroll, { passive: false });
        return () => element.removeEventListener("wheel", lockPageScroll);
    }, []);
    useEffect(() => {
        const element = wrapperRef.current;
        if (!element) {
            return undefined;
        }
        if (typeof globalThis.window === "undefined") {
            return undefined;
        }
        const update = () => {
            const rect = element.getBoundingClientRect();
            setSize({
                width: Math.max(360, Math.floor(rect.width)),
                height: Math.max(420, Math.floor(rect.height)),
            });
        };
        update();
        if (typeof globalThis.ResizeObserver !== "undefined") {
            const observer = new globalThis.ResizeObserver(update);
            observer.observe(element);
            return () => observer.disconnect();
        }
        globalThis.window.addEventListener("resize", update);
        return () => globalThis.window.removeEventListener("resize", update);
    }, []);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }
        const context = canvas.getContext("2d");
        if (!context) {
            return;
        }
        const ratio = typeof globalThis.window === "undefined" ? 1 : globalThis.window.devicePixelRatio || 1;
        canvas.width = Math.floor(size.width * ratio);
        canvas.height = Math.floor(size.height * ratio);
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        context.clearRect(0, 0, size.width, size.height);
        const geometry = {
            padding: { top: 18, right: 20, bottom: 32, left: 52 },
            plotWidth: size.width - 72,
            plotHeight: size.height - 50,
        };
        const { padding, plotWidth, plotHeight } = geometry;
        const toX = (x) => padding.left + ((x - view.xMin) / (view.xMax - view.xMin)) * plotWidth;
        const toY = (y) => padding.top + ((view.yMax - y) / (view.yMax - view.yMin)) * plotHeight;
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, size.width, size.height);
        drawAxesAndGrid(context, view, geometry, size, toX, toY);
        context.save();
        context.beginPath();
        context.rect(padding.left, padding.top, plotWidth, plotHeight);
        context.clip();
        for (const region of overlay.regions) {
            const polygons = sampleRegionPolygons(region, view, plotHeight, Math.max(48, Math.floor(plotWidth * 0.85)));
            for (const polygon of polygons) {
                drawPolygon(context, {
                    points: polygon,
                    fill: region.fill,
                    opacity: region.opacity,
                    stroke: region.stroke,
                    strokeWidth: region.strokeWidth,
                }, toX, toY);
            }
        }
        overlay.polygons.forEach((polygon) => drawPolygon(context, polygon, toX, toY));
        overlay.polylines.forEach((polyline) => drawPolyline(context, polyline, toX, toY));
        expressions.forEach((expression) => {
            const segments = sampleFunctionSegments(expression, view, plotWidth, plotHeight, Math.max(220, Math.floor(plotWidth * 1.15)));
            context.save();
            context.strokeStyle = expression.color;
            context.lineWidth = 2.5;
            context.lineCap = "round";
            context.lineJoin = "round";
            for (const segment of segments) {
                context.beginPath();
                segment.forEach((point, index) => {
                    if (index === 0) {
                        context.moveTo(toX(point.x), toY(point.y));
                    }
                    else {
                        context.lineTo(toX(point.x), toY(point.y));
                    }
                });
                context.stroke();
            }
            context.restore();
        });
        drawPoints(context, overlay.points, view, size, geometry, toX, toY);
        drawVerticals(context, overlay.verticals, view, size, geometry, toX);
        context.restore();
    }, [expressions, overlay, size.height, size.width, view]);
    const screenToWorld = (clientX, clientY) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) {
            return null;
        }
        const padding = { top: 18, right: 20, bottom: 32, left: 52 };
        const plotWidth = size.width - 72;
        const plotHeight = size.height - 50;
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        return {
            ratioX: (x - padding.left) / plotWidth,
            ratioY: (y - padding.top) / plotHeight,
        };
    };
    const zoomAt = (factor, anchorRatioX = 0.5, anchorRatioY = 0.5) => {
        setView((current) => {
            const xSpan = current.xMax - current.xMin;
            const ySpan = current.yMax - current.yMin;
            const nextXSpan = clamp(xSpan * factor, 0.02, 2000);
            const nextYSpan = clamp(ySpan * factor, 0.02, 2000);
            const anchorX = current.xMin + xSpan * anchorRatioX;
            const anchorY = current.yMax - ySpan * anchorRatioY;
            return clampView({
                xMin: anchorX - nextXSpan * anchorRatioX,
                xMax: anchorX + nextXSpan * (1 - anchorRatioX),
                yMin: anchorY - nextYSpan * (1 - anchorRatioY),
                yMax: anchorY + nextYSpan * anchorRatioY,
            });
        });
    };
    const releaseDrag = (pointerId) => {
        const canvas = canvasRef.current;
        if (canvas && typeof pointerId === "number" && canvas.hasPointerCapture(pointerId)) {
            canvas.releasePointerCapture(pointerId);
        }
        dragRef.current = null;
        setDragging(false);
    };
    return (_jsxs("div", { className: "graph-card", children: [_jsxs("div", { className: "graph-toolbar", children: [_jsx(IconButton, { label: "\\u0423\\u0432\\u0435\\u043b\\u0438\\u0447\\u0438\\u0442\\u044c", onClick: () => zoomAt(0.82), children: "+" }), _jsx(IconButton, { label: "\\u0423\\u043c\\u0435\\u043d\\u044c\\u0448\\u0438\\u0442\\u044c", onClick: () => zoomAt(1.22), children: "-" }), _jsx(IconButton, { label: "\\u0421\\u0431\\u0440\\u043e\\u0441\\u0438\\u0442\\u044c \\u0432\\u0438\\u0434", onClick: () => setView(normalizedDefaultView), children: "\u21ba" })] }), _jsx("div", { ref: wrapperRef, className: `graph-shell ${dragging ? "graph-shell-dragging" : ""}`, onPointerDown: (event) => {
                    if (event.button !== 0) {
                        return;
                    }
                    const canvas = canvasRef.current;
                    if (!canvas) {
                        return;
                    }
                    dragRef.current = {
                        pointerId: event.pointerId,
                        startX: event.clientX,
                        startY: event.clientY,
                        startView: view,
                    };
                    canvas.setPointerCapture(event.pointerId);
                    setDragging(true);
                }, onPointerMove: (event) => {
                    const drag = dragRef.current;
                    if (!drag || drag.pointerId !== event.pointerId) {
                        return;
                    }
                    const dx = event.clientX - drag.startX;
                    const dy = event.clientY - drag.startY;
                    const spanX = drag.startView.xMax - drag.startView.xMin;
                    const spanY = drag.startView.yMax - drag.startView.yMin;
                    setView(clampView({
                        xMin: drag.startView.xMin - (dx / Math.max(1, size.width - 72)) * spanX,
                        xMax: drag.startView.xMax - (dx / Math.max(1, size.width - 72)) * spanX,
                        yMin: drag.startView.yMin + (dy / Math.max(1, size.height - 50)) * spanY,
                        yMax: drag.startView.yMax + (dy / Math.max(1, size.height - 50)) * spanY,
                    }));
                }, onPointerUp: (event) => releaseDrag(event.pointerId), onPointerCancel: (event) => releaseDrag(event.pointerId), onLostPointerCapture: () => releaseDrag(), onWheel: (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const world = screenToWorld(event.clientX, event.clientY);
                    if (!world) {
                        return;
                    }
                    const factor = event.deltaY < 0 ? 0.88 : 1.14;
                    zoomAt(factor, clamp(world.ratioX, 0.05, 0.95), clamp(world.ratioY, 0.05, 0.95));
                }, children: _jsx("canvas", { ref: canvasRef, className: "graph-canvas" }) }), _jsx("div", { className: "graph-legend", children: expressions.length ? (expressions.map((expression) => (_jsxs("div", { className: "legend-item", children: [_jsx("span", { className: "legend-swatch", style: { backgroundColor: expression.color } }), _jsx("span", { children: expressionLabel(expression) })] }, expression.id)))) : (_jsx("span", { className: "empty-state", children: decodeEscapedUnicode("\u0414\u043e\u0431\u0430\u0432\u044c\u0442\u0435 \u0432\u044b\u0440\u0430\u0436\u0435\u043d\u0438\u0435 \u0441\u043b\u0435\u0432\u0430, \u0447\u0442\u043e\u0431\u044b \u0443\u0432\u0438\u0434\u0435\u0442\u044c \u0433\u0440\u0430\u0444\u0438\u043a.") })) })] }));
}

