import katex from "katex";
import { decodeEscapedUnicode } from "../utils/decodeEscapedUnicode";

interface FormulaCardProps {
  tex: string | null;
  displayMode?: boolean;
  className?: string;
}

export function FormulaCard({ tex, displayMode = true, className = "" }: FormulaCardProps) {
  if (!tex) {
    return null;
  }

  const normalizedTex = decodeEscapedUnicode(tex);

  return (
    <div
      className={`formula-card ${displayMode ? "" : "formula-inline"} ${className}`.trim()}
      dangerouslySetInnerHTML={{
        __html: katex.renderToString(normalizedTex, { displayMode, throwOnError: false }),
      }}
    />
  );
}
