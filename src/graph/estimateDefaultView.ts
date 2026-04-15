import { DEFAULT_VIEW } from "../constants";
import { clampView } from "../math/numeric";
import type { CompiledExpression, ToolState, ViewBox } from "../types";

export function estimateDefaultView(validExpressions: CompiledExpression[], tool: ToolState): ViewBox {
  const hasToolWindow = tool.mode !== "none";
  const windowMin = hasToolWindow ? Math.min(tool.a, tool.b) : DEFAULT_VIEW.xMin;
  const windowMax = hasToolWindow ? Math.max(tool.a, tool.b) : DEFAULT_VIEW.xMax;
  const focusSpan = Math.max(6, (windowMax - windowMin) * 1.8 || 6);
  const xCenter = hasToolWindow ? (windowMin + windowMax) / 2 : 0;
  const xMin = xCenter - focusSpan / 2;
  const xMax = xCenter + focusSpan / 2;
  const sampleStart = clampView({ xMin, xMax, yMin: -8, yMax: 8 });
  const samples = Math.max(160, validExpressions.length * 120);
  const xs: number[] = [0];
  const ys: number[] = [0];

  for (const expression of validExpressions.slice(0, 6)) {
    if (expression.orientation === "yOfX") {
      for (let index = 0; index <= samples; index += 1) {
        const x = sampleStart.xMin + ((sampleStart.xMax - sampleStart.xMin) * index) / samples;
        const y = expression.evaluate(x);
        if (Number.isFinite(y)) {
          xs.push(x);
          ys.push(y);
        }
      }
      continue;
    }

    for (let index = 0; index <= samples; index += 1) {
      const y = sampleStart.yMin + ((sampleStart.yMax - sampleStart.yMin) * index) / samples;
      const x = expression.evaluate(y);
      if (Number.isFinite(x)) {
        xs.push(x);
        ys.push(y);
      }
    }
  }

  if (xs.length === 1 || ys.length === 1) {
    return sampleStart;
  }

  const xMinRaw = Math.min(...xs);
  const xMaxRaw = Math.max(...xs);
  const yMinRaw = Math.min(...ys);
  const yMaxRaw = Math.max(...ys);
  const xSpan = Math.max(2, xMaxRaw - xMinRaw);
  const ySpan = Math.max(2, yMaxRaw - yMinRaw);

  return clampView({
    xMin: xMinRaw - xSpan * 0.18,
    xMax: xMaxRaw + xSpan * 0.18,
    yMin: yMinRaw - ySpan * 0.18,
    yMax: yMaxRaw + ySpan * 0.18,
  });
}
