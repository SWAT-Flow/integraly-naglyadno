import { useEffect, useRef, useState, type RefObject } from "react";
import { COLORS } from "../constants";
import type { VolumePreviewData } from "../types";
import { decodeEscapedUnicode } from "../utils/decodeEscapedUnicode";

interface VolumePreviewProps {
  data: VolumePreviewData | null;
}

function useCanvasSize(containerRef: RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ width: 320, height: 220 });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return undefined;
    }
    if (typeof globalThis.window === "undefined") {
      return undefined;
    }

    const update = () => {
      const rect = element.getBoundingClientRect();
      setSize({
        width: Math.max(280, Math.floor(rect.width)),
        height: Math.max(220, Math.floor(rect.height)),
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
  }, [containerRef]);

  return size;
}

export function VolumePreview({ data }: VolumePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = useCanvasSize(containerRef);

  useEffect(() => {
    if (!data) {
      return undefined;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return undefined;
    }
    if (typeof globalThis.window === "undefined") {
      return undefined;
    }

    let frame = 0;
    let animationId = 0;

    const draw = () => {
      frame += 1;
      const phase = frame / 60;
      const ratio = globalThis.window.devicePixelRatio || 1;
      canvas.width = Math.floor(size.width * ratio);
      canvas.height = Math.floor(size.height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, size.width, size.height);

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, size.width, size.height);

      const padding = { left: 24, right: 18, top: 18, bottom: 22 };
      const plotWidth = size.width - padding.left - padding.right;
      const plotHeight = size.height - padding.top - padding.bottom;
      const baseY = padding.top + plotHeight * 0.52;
      const maxRadius = Math.max(1e-6, ...data.slices.map((slice) => slice.outerR));
      const yScale = (plotHeight * 0.38) / maxRadius;
      const xTo = (x: number) =>
        padding.left + ((x - data.a) / Math.max(1e-9, data.b - data.a)) * plotWidth;
      const rTo = (value: number) => value * yScale;
      const squash = 0.34;

      context.strokeStyle = COLORS.ink;
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(padding.left, baseY);
      context.lineTo(size.width - padding.right, baseY);
      context.stroke();

      context.strokeStyle = COLORS.violet;
      context.fillStyle = "rgba(124, 58, 237, 0.12)";
      for (const slice of data.slices) {
        const outerRadius = rTo(slice.outerR);
        const innerRadius = rTo(slice.innerR);
        const ellipseRadiusX = Math.max(1.5, outerRadius * squash);
        context.beginPath();
        context.ellipse(xTo(slice.x), baseY, ellipseRadiusX, outerRadius, 0, 0, Math.PI * 2);
        context.fill();
        context.stroke();

        if (slice.section === "washer" && innerRadius > 0.5) {
          context.save();
          context.fillStyle = "#ffffff";
          context.strokeStyle = "rgba(217, 119, 6, 0.7)";
          context.beginPath();
          context.ellipse(xTo(slice.x), baseY, Math.max(1, innerRadius * squash), innerRadius, 0, 0, Math.PI * 2);
          context.fill();
          context.stroke();
          context.restore();
        }
      }

      const frontFactor = Math.cos(phase);
      const drawBody = (sign: 1 | -1, dashed: boolean, radiusKey: "outerR" | "innerR", strokeStyle: string) => {
        context.beginPath();
        data.slices.forEach((slice, index) => {
          const radius = rTo(slice[radiusKey]) * frontFactor * sign;
          const x = xTo(slice.x);
          const y = baseY - radius;
          if (index === 0) {
            context.moveTo(x, y);
          } else {
            context.lineTo(x, y);
          }
        });
        context.lineWidth = dashed ? 1.2 : 2;
        context.strokeStyle = dashed ? "rgba(124, 58, 237, 0.4)" : strokeStyle;
        context.setLineDash(dashed ? [7, 5] : []);
        context.stroke();
      };

      drawBody(1, false, "outerR", COLORS.ink);
      drawBody(-1, true, "outerR", COLORS.ink);
      if (data.section === "washer") {
        drawBody(1, false, "innerR", COLORS.amber);
        drawBody(-1, true, "innerR", COLORS.amber);
      }

      const sampleX = xTo(data.sampleX);
      const sampleOuterR = rTo(data.sampleOuterR);
      const sampleInnerR = rTo(data.sampleInnerR);
      context.setLineDash([]);
      context.strokeStyle = COLORS.amber;
      context.fillStyle = "rgba(217, 119, 6, 0.18)";
      context.beginPath();
      context.ellipse(sampleX, baseY, Math.max(1.5, sampleOuterR * squash), sampleOuterR, 0, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      if (data.section === "washer" && sampleInnerR > 0.5) {
        context.fillStyle = "#ffffff";
        context.strokeStyle = COLORS.amber;
        context.beginPath();
        context.ellipse(sampleX, baseY, Math.max(1, sampleInnerR * squash), sampleInnerR, 0, 0, Math.PI * 2);
        context.fill();
        context.stroke();
      }
      context.fillStyle = COLORS.slate;
      context.font = "12px ui-sans-serif, system-ui, sans-serif";
      context.fillText(decodeEscapedUnicode("\u043e\u0441\u044c Ox"), size.width - 56, baseY - 10);
      context.fillText(data.section === "washer" ? "R(x), r(x)" : "R(x) = |f(x)|", sampleX + 10, baseY - sampleOuterR - 8);

      animationId = globalThis.window.requestAnimationFrame(draw);
    };

    animationId = globalThis.window.requestAnimationFrame(draw);
    return () => globalThis.window.cancelAnimationFrame(animationId);
  }, [data, size.height, size.width]);

  return (
    <div ref={containerRef} className="volume-preview-shell">
      {data ? (
        <canvas ref={canvasRef} className="graph-canvas" />
      ) : (
        <div className="empty-state">
          {decodeEscapedUnicode("\u041d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445 \u0434\u043b\u044f \u043f\u0440\u0435\u0434\u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440\u0430.")}
        </div>
      )}
    </div>
  );
}
