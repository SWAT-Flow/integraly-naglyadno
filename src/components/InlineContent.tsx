import { tokenizeInlineMath } from "../learning/inlineMath";
import { decodeEscapedUnicode } from "../utils/decodeEscapedUnicode";
import { InlineFormula } from "./FormulaCard";

interface InlineContentProps {
  text: string;
  formulaClassName?: string;
}

export function renderInlineContent(text: string, formulaClassName = "") {
  return tokenizeInlineMath(text).map((part, index) =>
    part.type === "tex" ? (
      <InlineFormula key={`${part.value}-${index}`} tex={part.value} className={formulaClassName} />
    ) : (
      <span key={`${part.value}-${index}`}>{decodeEscapedUnicode(part.value)}</span>
    ),
  );
}

export function InlineContent({ text, formulaClassName = "" }: InlineContentProps) {
  return <>{renderInlineContent(text, formulaClassName)}</>;
}
