import katex from "katex";
import { expressionToTex } from "../math/parser";
import { decodeEscapedUnicode } from "../utils/decodeEscapedUnicode";

interface FormulaCardProps {
  tex: string | null;
  displayMode?: boolean;
  className?: string;
}

interface InlineFormulaProps {
  tex: string | null;
  className?: string;
}

function normalizeFormulaInput(tex: string) {
  const decoded = decodeEscapedUnicode(tex);
  const looksLikePlainExpression =
    !decoded.includes("\\") &&
    /(?:^|[^a-z])(sqrt|abs|asin|acos|atan|asec|acsc|acot|asinh|acosh|atanh|sin|cos|tan|sec|csc|cot|sinh|cosh|tanh|exp|ln|log|pi)(?:$|[^a-z])|[xy]\s*=|[\^*/]/i.test(
      decoded,
    );

  return looksLikePlainExpression ? expressionToTex(decoded) : decoded;
}

export function FormulaCard({ tex, displayMode = true, className = "" }: FormulaCardProps) {
  if (!tex) {
    return null;
  }

  const normalizedTex = normalizeFormulaInput(tex);

  return (
    <div
      className={`formula-card ${displayMode ? "" : "formula-inline"} ${className}`.trim()}
      dangerouslySetInnerHTML={{
        __html: katex.renderToString(normalizedTex, { displayMode, throwOnError: false }),
      }}
    />
  );
}

export function InlineFormula({ tex, className = "" }: InlineFormulaProps) {
  if (!tex) {
    return null;
  }

  const normalizedTex = normalizeFormulaInput(tex);

  return (
    <span
      className={`formula-inline-text ${className}`.trim()}
      dangerouslySetInnerHTML={{
        __html: katex.renderToString(normalizedTex, { displayMode: false, throwOnError: false }),
      }}
    />
  );
}
