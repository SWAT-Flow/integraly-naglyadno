import { TOOL_LABELS } from "../constants";
import { expressionToTex, formatExpressionText } from "../math/parser";
import type { CompiledExpression, OverlayData, ToolState } from "../types";
import { FormulaCard } from "./FormulaCard";
import { VolumePreview } from "./VolumePreview";
import { Card, MetricGrid, NumberField, SelectField } from "./ui";

interface ToolPanelProps {
  tool: ToolState;
  validExpressions: CompiledExpression[];
  overlay: OverlayData;
  onChange: (patch: Partial<ToolState>) => void;
}

function expressionOptions(validExpressions: CompiledExpression[]) {
  if (!validExpressions.length) {
    return [{ label: "\u041d\u0435\u0442 \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u043d\u044b\u0445 \u0444\u0443\u043d\u043a\u0446\u0438\u0439", value: "" }];
  }

  return validExpressions.map((expression) => ({
    label: `${expression.orientation === "xOfY" ? "x" : "y"} = ${formatExpressionText(expression.normalized)}`,
    value: expression.id,
  }));
}

function expressionPreviewTex(expression: CompiledExpression | null): string | null {
  if (!expression) {
    return null;
  }

  const prefix = expression.orientation === "xOfY" ? "x = " : "y = ";
  return `${prefix}${expressionToTex(expression.normalized)}`;
}

function currentFormulaTex(tool: ToolState, validExpressions: CompiledExpression[]): string | null {
  const expressionA = validExpressions.find((expression) => expression.id === tool.exprA) ?? null;
  const expressionB = validExpressions.find((expression) => expression.id === tool.exprB) ?? null;
  const left = Math.min(tool.a, tool.b);
  const right = Math.max(tool.a, tool.b);
  const aTex = Number.isFinite(left) ? String(left) : "a";
  const bTex = Number.isFinite(right) ? String(right) : "b";
  const texA = expressionA ? expressionToTex(expressionA.normalized) : "f(x)";
  const texB = expressionB ? expressionToTex(expressionB.normalized) : "g(x)";

  switch (tool.mode) {
    case "under":
      return `\\int_{${aTex}}^{${bTex}} ${texA}\\,dx`;
    case "between":
      return null;
    case "riemann":
      return `\\sum_{i=1}^{${tool.n}} \\left.${texA}\\right|_{x=\\xi_i}\\,\\Delta x`;
    case "trap":
      return `\\int_{${aTex}}^{${bTex}} ${texA}\\,dx \\approx \\frac{h}{2}\\left(\\left.${texA}\\right|_{x=x_0} + 2\\sum_{i=1}^{${Math.max(
        1,
        tool.n - 1,
      )}} \\left.${texA}\\right|_{x=x_i} + \\left.${texA}\\right|_{x=x_${tool.n}}\\right)`;
    case "volume":
      return `V = \\pi \\int_{${aTex}}^{${bTex}} \\left(${texA}\\right)^2\\,dx`;
    default:
      return null;
  }
}

export function ToolPanel({ tool, validExpressions, overlay, onChange }: ToolPanelProps) {
  const options = expressionOptions(validExpressions);
  const hasExpressions = validExpressions.length > 0;
  const expressionA = validExpressions.find((expression) => expression.id === tool.exprA) ?? null;
  const expressionB = validExpressions.find((expression) => expression.id === tool.exprB) ?? null;
  const formulaTex = currentFormulaTex(tool, validExpressions) ?? overlay.formulaTex;
  const showA =
    tool.mode === "under" ||
    tool.mode === "between" ||
    tool.mode === "riemann" ||
    tool.mode === "trap" ||
    tool.mode === "volume";
  const showB = tool.mode === "between";
  const showSample = tool.mode === "riemann";
  const showN = tool.mode === "riemann" || tool.mode === "trap";
  const showBounds = tool.mode !== "none";

  return (
    <div className="panel-stack">
      <Card
        title="\u0418\u043d\u0441\u0442\u0440\u0443\u043c\u0435\u043d\u0442\u044b"
        subtitle="\u041f\u0430\u043d\u0435\u043b\u044c \u043e\u0441\u0442\u0430\u0435\u0442\u0441\u044f \u0440\u0430\u0431\u043e\u0447\u0435\u0439 \u0434\u0430\u0436\u0435 \u043f\u043e\u0441\u043b\u0435 \u0443\u0434\u0430\u043b\u0435\u043d\u0438\u044f \u0432\u044b\u0440\u0430\u0436\u0435\u043d\u0438\u0439 \u0438\u043b\u0438 \u043d\u0435\u043f\u043e\u043b\u043d\u044b\u0445 \u043d\u0430\u0441\u0442\u0440\u043e\u0435\u043a \u0440\u0435\u0436\u0438\u043c\u0430."
      >
        <SelectField
          label="\u0420\u0435\u0436\u0438\u043c"
          onChange={(value) => onChange({ mode: value as ToolState["mode"] })}
          options={Object.entries(TOOL_LABELS).map(([value, label]) => ({ value, label }))}
          value={tool.mode}
        />

        {showA ? (
          <SelectField
            disabled={!hasExpressions}
            label="\u0424\u0443\u043d\u043a\u0446\u0438\u044f A"
            onChange={(value) => onChange({ exprA: value || null })}
            options={options}
            preview={
              expressionA ? <FormulaCard tex={expressionPreviewTex(expressionA)} displayMode={false} className="field-formula-preview" /> : null
            }
            value={hasExpressions ? tool.exprA ?? options[0]?.value ?? "" : ""}
          />
        ) : null}

        {showB ? (
          <SelectField
            disabled={validExpressions.length < 2}
            label="\u0424\u0443\u043d\u043a\u0446\u0438\u044f B"
            onChange={(value) => onChange({ exprB: value || null })}
            options={options}
            preview={
              expressionB ? <FormulaCard tex={expressionPreviewTex(expressionB)} displayMode={false} className="field-formula-preview" /> : null
            }
            value={hasExpressions ? tool.exprB ?? tool.exprA ?? options[0]?.value ?? "" : ""}
          />
        ) : null}

        {showBounds ? (
          <div className="field-row">
            <NumberField label="a" onChange={(value) => onChange({ a: value })} step={0.1} value={tool.a} />
            <NumberField label="b" onChange={(value) => onChange({ b: value })} step={0.1} value={tool.b} />
          </div>
        ) : null}

        {showN ? <NumberField label="n" onChange={(value) => onChange({ n: value })} step={1} value={tool.n} /> : null}

        {showSample ? (
          <SelectField
            label="\u0412\u044b\u0431\u043e\u0440\u043a\u0430"
            onChange={(value) => onChange({ sample: value as ToolState["sample"] })}
            options={[
              { value: "left", label: "\u0441\u043b\u0435\u0432\u0430" },
              { value: "mid", label: "\u043f\u043e \u0446\u0435\u043d\u0442\u0440\u0443" },
              { value: "right", label: "\u0441\u043f\u0440\u0430\u0432\u0430" },
            ]}
            value={tool.sample}
          />
        ) : null}
      </Card>

      <Card
        title="\u0424\u043e\u0440\u043c\u0443\u043b\u0430"
        subtitle="KaTeX \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u0442 \u0430\u043a\u0442\u0443\u0430\u043b\u044c\u043d\u0443\u044e \u0444\u043e\u0440\u043c\u0443\u043b\u0443 \u0434\u043b\u044f \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0445 \u0444\u0443\u043d\u043a\u0446\u0438\u0439 \u0438 \u0433\u0440\u0430\u043d\u0438\u0446."
      >
        <FormulaCard tex={formulaTex} />
      </Card>

      <Card
        title="\u041c\u0435\u0442\u0440\u0438\u043a\u0438"
        subtitle="\u0415\u0441\u043b\u0438 \u0434\u0430\u043d\u043d\u044b\u0445 \u043d\u0435\u0434\u043e\u0441\u0442\u0430\u0442\u043e\u0447\u043d\u043e, \u0437\u0434\u0435\u0441\u044c \u043e\u0441\u0442\u0430\u0435\u0442\u0441\u044f \u043f\u043e\u043d\u044f\u0442\u043d\u043e\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u0432\u043c\u0435\u0441\u0442\u043e \u043f\u0430\u0434\u0435\u043d\u0438\u044f \u0438\u043d\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430."
      >
        <MetricGrid metrics={overlay.metrics} />
      </Card>

      {tool.mode === "volume" ? (
        <Card
          title="\u041f\u0440\u0435\u0434\u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440 \u043e\u0431\u044a\u0435\u043c\u0430"
          subtitle="\u041e\u0442\u0434\u0435\u043b\u044c\u043d\u044b\u0439 canvas \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u0442 \u0432\u0440\u0430\u0449\u0435\u043d\u0438\u0435 \u043e\u0431\u043b\u0430\u0441\u0442\u0438 \u0432\u043e\u043a\u0440\u0443\u0433 \u043e\u0441\u0438 Ox."
        >
          <VolumePreview data={overlay.volumePreview} />
        </Card>
      ) : null}
    </div>
  );
}
