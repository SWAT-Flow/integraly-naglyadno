import { TOOL_LABELS } from "../constants";
import { formatBoundTex } from "../math/bounds";
import { expressionToTex, formatExpressionText } from "../math/parser";
import type { CompiledExpression, OverlayData, ToolState } from "../types";
import { FormulaCard } from "./FormulaCard";
import { PrettyExpression } from "./PrettyExpression";
import { VolumePreview } from "./VolumePreview";
import { BoundField, Card, MetricGrid, NumberField, SelectField } from "./ui";

interface ToolPanelProps {
  tool: ToolState;
  validExpressions: CompiledExpression[];
  overlay: OverlayData;
  onChange: (patch: Partial<ToolState>) => void;
}

function expressionOptions(validExpressions: CompiledExpression[], includeEmpty = false) {
  const baseOptions = includeEmpty ? [{ label: "Без второй функции", value: "" }] : [];

  if (!validExpressions.length) {
    return includeEmpty ? baseOptions : [{ label: "Нет корректных функций", value: "" }];
  }

  return [
    ...baseOptions,
    ...validExpressions.map((expression) => ({
      label: `${expression.orientation === "xOfY" ? "x" : "y"} = ${formatExpressionText(expression.normalized)}`,
      value: expression.id,
      render: <ExpressionSelectPreview expression={expression} />,
      selectedRender: <ExpressionSelectPreview expression={expression} compact />,
    })),
  ];
}

function expressionPreviewPrefix(expression: CompiledExpression | null): string {
  return expression?.orientation === "xOfY" ? "x =" : "y =";
}

function cleanSquaredTex(tex: string): string {
  const trimmed = tex.trim();
  const unwrapped =
    trimmed.startsWith("\\left(") && trimmed.endsWith("\\right)")
      ? trimmed.slice("\\left(".length, -("\\right)".length))
      : trimmed.startsWith("(") && trimmed.endsWith(")")
        ? trimmed.slice(1, -1)
        : trimmed;
  return /^(?:[a-zA-Z0-9]+|[a-zA-Z]+\([^()]+\)|\\sqrt\{[^{}]+\}|\\log_\{[^{}]+\}\s+.+)$/.test(unwrapped) &&
    !unwrapped.includes("^")
    ? `${unwrapped}^2`
    : `\\left(${unwrapped}\\right)^2`;
}

function ExpressionSelectPreview({
  expression,
  compact = false,
}: {
  expression: CompiledExpression;
  compact?: boolean;
}) {
  return (
    <span className={`select-expression-preview ${compact ? "select-expression-preview-compact" : ""}`}>
      <span className="select-expression-prefix">{expressionPreviewPrefix(expression)}</span>
      <PrettyExpression className="select-expression-math" compact expression={expression.normalized} />
    </span>
  );
}

function currentFormulaTex(tool: ToolState, validExpressions: CompiledExpression[]): string | null {
  const expressionA = validExpressions.find((expression) => expression.id === tool.exprA) ?? null;
  const expressionB = validExpressions.find((expression) => expression.id === tool.exprB) ?? null;
  const left = Math.min(tool.a, tool.b);
  const right = Math.max(tool.a, tool.b);
  const aTex = formatBoundTex(left);
  const bTex = formatBoundTex(right);
  const texA = expressionA ? expressionToTex(expressionA.normalized) : "f(x)";
  const texB = expressionB ? expressionToTex(expressionB.normalized) : "g(x)";

  switch (tool.mode) {
    case "under":
      return `\\int_{${aTex}}^{${bTex}} ${texA}\\,dx`;
    case "between":
      return null;
    case "riemann":
    case "trap":
      return `\\Delta x = \\frac{${bTex}-${aTex}}{${tool.n}}`;
    case "volume":
      return expressionB
        ? `V = \\pi \\int_{${aTex}}^{${bTex}} \\left(R(x)^2-r(x)^2\\right)\\,dx`
        : `V = \\pi \\int_{${aTex}}^{${bTex}} ${cleanSquaredTex(texA)}\\,dx`;
    case "newtonLeibniz":
      return `\\int_{${aTex}}^{${bTex}} ${texA}\\,dx = F(${bTex}) - F(${aTex})`;
    case "averageValue":
      return `f_{\\text{avg}}\\,(${bTex}-${aTex}) = \\int_{${aTex}}^{${bTex}} ${texA}\\,dx`;
    default:
      return null;
  }
}

export function ToolPanel({ tool, validExpressions, overlay, onChange }: ToolPanelProps) {
  const options = expressionOptions(validExpressions);
  const volumeOptions = expressionOptions(validExpressions, true);
  const hasExpressions = validExpressions.length > 0;
  const formulaTex = currentFormulaTex(tool, validExpressions) ?? overlay.formulaTex;
  const formulaSteps = overlay.formulaSteps.length ? overlay.formulaSteps : formulaTex ? [formulaTex] : [];
  const showA =
    tool.mode === "under" ||
    tool.mode === "between" ||
    tool.mode === "riemann" ||
    tool.mode === "trap" ||
    tool.mode === "volume" ||
    tool.mode === "newtonLeibniz" ||
    tool.mode === "averageValue";
  const showB = tool.mode === "between" || tool.mode === "volume";
  const showSample = tool.mode === "riemann";
  const showN = tool.mode === "riemann" || tool.mode === "trap";
  const showBounds = tool.mode !== "none";

  return (
    <div className="panel-stack">
      <Card
        title="Инструменты"
        subtitle="Панель остаётся рабочей даже после удаления выражений или неполных настроек режима."
      >
        <SelectField
          label="Режим"
          onChange={(value) => onChange({ mode: value as ToolState["mode"] })}
          options={Object.entries(TOOL_LABELS).map(([value, label]) => ({ value, label }))}
          value={tool.mode}
        />

        {showA ? (
          <SelectField
            disabled={!hasExpressions}
            label="Функция A"
            onChange={(value) => onChange({ exprA: value || null })}
            options={options}
            value={hasExpressions ? tool.exprA ?? options[0]?.value ?? "" : ""}
          />
        ) : null}

        {showB ? (
          <SelectField
            disabled={tool.mode === "between" ? validExpressions.length < 2 : !hasExpressions}
            label="Функция B"
            onChange={(value) => onChange({ exprB: value || null })}
            options={tool.mode === "volume" ? volumeOptions : options}
            value={
              tool.mode === "volume"
                ? tool.exprB ?? ""
                : hasExpressions
                  ? tool.exprB ?? tool.exprA ?? options[0]?.value ?? ""
                  : ""
            }
          />
        ) : null}

        {showBounds ? (
          <div className="field-row">
            <BoundField label="a" onChange={(value) => onChange({ a: value })} value={tool.a} />
            <BoundField label="b" onChange={(value) => onChange({ b: value })} value={tool.b} />
          </div>
        ) : null}

        {showN ? <NumberField label="n" onChange={(value) => onChange({ n: value })} step={1} value={tool.n} /> : null}

        {showSample ? (
          <SelectField
            label="Выборка"
            onChange={(value) => onChange({ sample: value as ToolState["sample"] })}
            options={[
              { value: "left", label: "слева" },
              { value: "mid", label: "по центру" },
              { value: "right", label: "справа" },
            ]}
            value={tool.sample}
          />
        ) : null}
      </Card>

      <Card title="Формула" subtitle="Здесь показывается актуальная формула для выбранных функций и границ.">
        <div className="formula-stack">
          {formulaSteps.length ? formulaSteps.map((step, index) => <FormulaCard key={`${step}-${index}`} tex={step} />) : null}
        </div>
      </Card>

      <Card
        title="Метрики"
        subtitle="Если данных недостаточно, здесь остаётся понятное сообщение вместо падения интерфейса."
      >
        <MetricGrid metrics={overlay.metrics} />
      </Card>

      {overlay.explanation.length ? (
        <Card title="Пояснение" subtitle="Короткое человекочитаемое объяснение выбранного режима.">
          <div className="explanation-block">
            {overlay.explanation.map((paragraph, index) => (
              <p key={`${paragraph}-${index}`}>{paragraph}</p>
            ))}
          </div>
        </Card>
      ) : null}

      {tool.mode === "volume" ? (
        <Card
          title="Предпросмотр объёма"
          subtitle="Отдельный график показывает вращение области вокруг оси Ox."
        >
          <VolumePreview data={overlay.volumePreview} />
        </Card>
      ) : null}
    </div>
  );
}
