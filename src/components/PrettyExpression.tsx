import { Fragment, memo, useMemo, type ReactNode } from "react";
import { buildPrettyExpression, type PrettyFunctionNode, type PrettyLeafNode, type PrettyNode } from "../math/prettyExpression";
import type { MathFieldPointerTarget } from "../math/mathFieldEditing";

interface PrettyExpressionProps {
  expression: string;
  selectionStart?: number;
  selectionEnd?: number;
  className?: string;
  compact?: boolean;
  onPointerDown?: (target: MathFieldPointerTarget, event: React.PointerEvent<HTMLSpanElement>) => void;
}

interface SelectionRange {
  start: number;
  end: number;
}

interface ChunkDescriptor {
  rawStart: number;
  rawEnd: number;
  text: string;
  selected?: boolean;
  key: string;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toDisplayOffset(rawPosition: number, rawStart: number, rawEnd: number, displayLength: number) {
  if (displayLength <= 0 || rawEnd <= rawStart) {
    return 0;
  }

  const ratio = (rawPosition - rawStart) / (rawEnd - rawStart);
  return clamp(Math.round(ratio * displayLength), 0, displayLength);
}

function toRawOffset(displayOffset: number, rawStart: number, rawEnd: number, displayLength: number) {
  if (displayLength <= 0 || rawEnd <= rawStart) {
    return rawStart;
  }

  const ratio = displayOffset / displayLength;
  return clamp(Math.round(rawStart + ratio * (rawEnd - rawStart)), rawStart, rawEnd);
}

function splitDisplayText(
  display: string,
  rawStart: number,
  rawEnd: number,
  selection: SelectionRange | null,
  keyPrefix: string,
): ChunkDescriptor[] {
  const characters = Array.from(display);
  const displayLength = characters.length;

  if (!selection) {
    return [{ rawStart, rawEnd, text: display, key: `${keyPrefix}-full` }];
  }

  if (selection.start === selection.end) {
    const caret = selection.start;
    if (caret < rawStart || caret > rawEnd) {
      return [{ rawStart, rawEnd, text: display, key: `${keyPrefix}-full` }];
    }

    const offset = toDisplayOffset(caret, rawStart, rawEnd, displayLength);
    const beforeText = characters.slice(0, offset).join("");
    const afterText = characters.slice(offset).join("");
    const chunks: ChunkDescriptor[] = [];

    if (beforeText) {
      chunks.push({ rawStart, rawEnd: caret, text: beforeText, key: `${keyPrefix}-before` });
    }

    chunks.push({ rawStart: caret, rawEnd: caret, text: "", key: `${keyPrefix}-caret` });

    if (afterText) {
      chunks.push({ rawStart: caret, rawEnd, text: afterText, key: `${keyPrefix}-after` });
    }

    return chunks;
  }

  const overlapStart = Math.max(selection.start, rawStart);
  const overlapEnd = Math.min(selection.end, rawEnd);
  if (overlapStart >= overlapEnd) {
    return [{ rawStart, rawEnd, text: display, key: `${keyPrefix}-full` }];
  }

  let selectedStartOffset = toDisplayOffset(overlapStart, rawStart, rawEnd, displayLength);
  let selectedEndOffset = toDisplayOffset(overlapEnd, rawStart, rawEnd, displayLength);
  if (selectedEndOffset <= selectedStartOffset) {
    selectedEndOffset = Math.min(displayLength, selectedStartOffset + 1);
  }

  const beforeText = characters.slice(0, selectedStartOffset).join("");
  const selectedText = characters.slice(selectedStartOffset, selectedEndOffset).join("");
  const afterText = characters.slice(selectedEndOffset).join("");

  const chunks: ChunkDescriptor[] = [];
  if (beforeText) {
    chunks.push({ rawStart, rawEnd: overlapStart, text: beforeText, key: `${keyPrefix}-before` });
  }

  if (selectedText) {
    chunks.push({
      rawStart: overlapStart,
      rawEnd: overlapEnd,
      text: selectedText,
      selected: true,
      key: `${keyPrefix}-selected`,
    });
  }

  if (afterText) {
    chunks.push({ rawStart: overlapEnd, rawEnd, text: afterText, key: `${keyPrefix}-after` });
  }

  return chunks;
}

function renderInteractiveLeaf(
  display: string,
  rawStart: number,
  rawEnd: number,
  selection: SelectionRange | null,
  tokenClassName: string,
  keyPrefix: string,
) {
  const chunks = splitDisplayText(display, rawStart, rawEnd, selection, keyPrefix);

  return (
    <span className={`pretty-expression-token ${tokenClassName}`.trim()}>
      {chunks.map((chunk) => {
        if (chunk.text === "") {
          return (
            <span
              key={chunk.key}
              className="pretty-expression-caret-anchor"
              data-display-length={0}
              data-raw-end={chunk.rawEnd}
              data-raw-start={chunk.rawStart}
            >
              <span className="pretty-expression-caret" />
            </span>
          );
        }

        return (
          <span
            key={chunk.key}
            className={`pretty-expression-hit ${chunk.selected ? "pretty-expression-hit-selected" : ""}`.trim()}
            data-display-length={Array.from(chunk.text).length}
            data-raw-end={chunk.rawEnd}
            data-raw-start={chunk.rawStart}
          >
            {chunk.text}
          </span>
        );
      })}
    </span>
  );
}

function renderPlaceholder(node: Extract<PrettyNode, { kind: "placeholder" }>, selection: SelectionRange | null, key: string) {
  const hasCaret = Boolean(selection && selection.start === selection.end && selection.start === node.rawStart);
  const selected = Boolean(
    selection && selection.start !== selection.end && selection.start <= node.rawStart && selection.end >= node.rawEnd,
  );

  return (
    <span
      key={key}
      className={`pretty-expression-placeholder pretty-expression-placeholder-${node.placeholderType} ${selected ? "pretty-expression-hit-selected" : ""}`.trim()}
      data-display-length={0}
      data-raw-end={node.rawEnd}
      data-raw-start={node.rawStart}
    >
      {hasCaret ? <span className="pretty-expression-caret" /> : null}
    </span>
  );
}

function renderLeaf(node: PrettyLeafNode, selection: SelectionRange | null, key: string) {
  return (
    <Fragment key={key}>
      {renderInteractiveLeaf(node.display, node.rawStart, node.rawEnd, selection, `pretty-expression-token-${node.leafType}`, key)}
    </Fragment>
  );
}

function renderFunctionLabel(node: PrettyFunctionNode, selection: SelectionRange | null, key: string) {
  return (
    <span key={key} className="pretty-expression-function-label">
      {renderInteractiveLeaf(node.label, node.nameStart, node.nameEnd, selection, "pretty-expression-token-function", `${key}-label`)}
      {node.inverse ? (
        <span className="pretty-expression-function-inverse">
          <span className="pretty-expression-function-inverse-text">\u22121</span>
        </span>
      ) : null}
    </span>
  );
}

function renderNode(node: PrettyNode, selection: SelectionRange | null, key: string, path: string): ReactNode {
  switch (node.kind) {
    case "leaf":
      return renderLeaf(node, selection, key);

    case "placeholder":
      return renderPlaceholder(node, selection, key);

    case "sequence":
      return (
        <span key={key} className="pretty-expression-sequence">
          {node.children.map((child, index) => renderNode(child, selection, `${key}-${index}`, `${path}/${index}`))}
        </span>
      );

    case "group":
      return (
        <span key={key} className="pretty-expression-group" data-slot-path={`${path}/group`}>
          {renderInteractiveLeaf("(", node.openStart, node.openEnd, selection, "pretty-expression-token-paren", `${key}-open`)}
          {renderNode(node.content, selection, `${key}-content`, `${path}/group/content`)}
          {node.closeStart !== null && node.closeEnd !== null
            ? renderInteractiveLeaf(")", node.closeStart, node.closeEnd, selection, "pretty-expression-token-paren", `${key}-close`)
            : null}
        </span>
      );

    case "power":
      return (
        <span key={key} className="pretty-expression-power">
          <span className="pretty-expression-power-base">{renderNode(node.base, selection, `${key}-base`, `${path}/base`)}</span>
          <span className="pretty-expression-power-exponent" data-slot-path={`${path}/exp`}>
            {renderNode(node.exponent, selection, `${key}-exp`, `${path}/exp/content`)}
          </span>
        </span>
      );

    case "fraction":
      return (
        <span key={key} className="pretty-expression-fraction">
          <span className="pretty-expression-fraction-numerator" data-slot-path={`${path}/num`}>
            {renderNode(node.numerator, selection, `${key}-num`, `${path}/num/content`)}
          </span>
          <span
            className="pretty-expression-fraction-line"
            data-display-length={1}
            data-raw-end={node.slashEnd}
            data-raw-start={node.slashStart}
          />
          <span className="pretty-expression-fraction-denominator" data-slot-path={`${path}/den`}>
            {renderNode(node.denominator, selection, `${key}-den`, `${path}/den/content`)}
          </span>
        </span>
      );

    case "function":
      if (node.functionType === "sqrt") {
        return (
          <span key={key} className="pretty-expression-sqrt">
            {renderInteractiveLeaf("\u221a", node.nameStart, node.nameEnd, selection, "pretty-expression-token-function", `${key}-root`)}
            {node.openStart !== null && node.openEnd !== null
              ? renderInteractiveLeaf("(", node.openStart, node.openEnd, selection, "pretty-expression-token-paren", `${key}-open`)
              : null}
            {renderNode(
              node.args[0] ?? { kind: "placeholder", placeholderType: "argument", rawStart: node.rawEnd, rawEnd: node.rawEnd },
              selection,
              `${key}-arg`,
              `${path}/arg0/content`,
            )}
            {node.closeStart !== null && node.closeEnd !== null
              ? renderInteractiveLeaf(")", node.closeStart, node.closeEnd, selection, "pretty-expression-token-paren", `${key}-close`)
              : null}
          </span>
        );
      }

      if (node.functionType === "abs") {
        const leftStart = node.nameStart;
        const leftEnd = node.openEnd ?? node.nameEnd;
        const rightStart = node.closeStart ?? node.rawEnd;
        const rightEnd = node.closeEnd ?? node.rawEnd;

        return (
          <span key={key} className="pretty-expression-abs" data-slot-path={`${path}/arg0`}>
            {renderInteractiveLeaf("|", leftStart, leftEnd, selection, "pretty-expression-token-abs", `${key}-left`)}
            {renderNode(
              node.args[0] ?? { kind: "placeholder", placeholderType: "argument", rawStart: leftEnd, rawEnd: leftEnd },
              selection,
              `${key}-arg`,
              `${path}/arg0/content`,
            )}
            {renderInteractiveLeaf("|", rightStart, rightEnd, selection, "pretty-expression-token-abs", `${key}-right`)}
          </span>
        );
      }

      if (node.functionType === "logBase") {
        return (
          <span key={key} className="pretty-expression-log-base">
            <span className="pretty-expression-log-base-label">{renderFunctionLabel(node, selection, `${key}-label`)}</span>
            <span className="pretty-expression-log-base-subscript" data-slot-path={`${path}/arg0`}>
              {renderNode(
                node.args[0] ?? { kind: "placeholder", placeholderType: "argument", rawStart: node.rawEnd, rawEnd: node.rawEnd },
                selection,
                `${key}-base`,
                `${path}/arg0/content`,
              )}
            </span>
            <span className="pretty-expression-log-base-value" data-slot-path={`${path}/arg1`}>
              {renderNode(
                node.args[1] ?? { kind: "placeholder", placeholderType: "argument", rawStart: node.rawEnd, rawEnd: node.rawEnd },
                selection,
                `${key}-value`,
                `${path}/arg1/content`,
              )}
            </span>
          </span>
        );
      }

      return (
        <span key={key} className="pretty-expression-function">
          {renderFunctionLabel(node, selection, `${key}-label`)}
          {node.openStart !== null && node.openEnd !== null
            ? renderInteractiveLeaf("(", node.openStart, node.openEnd, selection, "pretty-expression-token-paren", `${key}-open`)
            : null}
          {node.args.length
              ? node.args.map((argument, index) => (
                <Fragment key={`${key}-arg-${index}`}>
                  {index > 0
                    ? renderInteractiveLeaf(",", node.openEnd ?? node.rawStart, node.openEnd ?? node.rawStart, selection, "pretty-expression-token-comma", `${key}-comma-${index}`)
                    : null}
                  <span className="pretty-expression-function-argument" data-slot-path={`${path}/arg${index}`}>
                    {renderNode(argument, selection, `${key}-arg-${index}`, `${path}/arg${index}/content`)}
                  </span>
                </Fragment>
              ))
            : null}
          {node.closeStart !== null && node.closeEnd !== null
            ? renderInteractiveLeaf(")", node.closeStart, node.closeEnd, selection, "pretty-expression-token-paren", `${key}-close`)
            : null}
        </span>
      );
  }
}

function resolvePointerTargetFromPoint(root: HTMLElement, clientX: number, clientY: number, fallback: number): MathFieldPointerTarget {
  const documentRef = globalThis.document as (Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  }) | undefined;

  if (!documentRef) {
    return { rawIndex: fallback, slotPath: null };
  }

  const caretPositionFromPoint = documentRef.caretPositionFromPoint;
  const caretRangeFromPoint = documentRef.caretRangeFromPoint;

  let node: Node | null = null;
  let offset = 0;

  if (typeof caretPositionFromPoint === "function") {
    const position = caretPositionFromPoint(clientX, clientY);
    node = position?.offsetNode ?? null;
    offset = position?.offset ?? 0;
  } else if (typeof caretRangeFromPoint === "function") {
    const range = caretRangeFromPoint(clientX, clientY);
    node = range?.startContainer ?? null;
    offset = range?.startOffset ?? 0;
  }

  const slotElement =
    documentRef.elementFromPoint?.(clientX, clientY)?.closest?.<HTMLElement>("[data-slot-path]") ?? null;

  const anchor =
    node?.nodeType === globalThis.Node.TEXT_NODE
      ? node.parentElement?.closest<HTMLElement>("[data-raw-start]")
      : (node as Element | null)?.closest?.<HTMLElement>("[data-raw-start]") ?? null;

  if (!anchor && slotElement) {
    const hits = Array.from(slotElement.querySelectorAll<HTMLElement>("[data-raw-start]"));
    if (hits.length) {
      const rawStart = Math.min(...hits.map((hit) => Number(hit.dataset.rawStart ?? fallback)));
      const rawEnd = Math.max(...hits.map((hit) => Number(hit.dataset.rawEnd ?? fallback)));
      const rect = slotElement.getBoundingClientRect();
      return {
        rawIndex: clientX <= rect.left + rect.width / 2 ? rawStart : rawEnd,
        slotPath: slotElement.dataset.slotPath ?? null,
      };
    }
  }

  if (!anchor) {
    const rect = root.getBoundingClientRect();
    return { rawIndex: clientX <= rect.left + rect.width / 2 ? 0 : fallback, slotPath: null };
  }

  const rawStart = Number(anchor.dataset.rawStart ?? fallback);
  const rawEnd = Number(anchor.dataset.rawEnd ?? fallback);
  const displayLength = Number(anchor.dataset.displayLength ?? Array.from(anchor.textContent ?? "").length);
  const slotPath = anchor.closest<HTMLElement>("[data-slot-path]")?.dataset.slotPath ?? slotElement?.dataset.slotPath ?? null;

  if (node?.nodeType === globalThis.Node.TEXT_NODE) {
    return { rawIndex: toRawOffset(offset, rawStart, rawEnd, displayLength), slotPath };
  }

  const rect = anchor.getBoundingClientRect();
  return { rawIndex: clientX <= rect.left + rect.width / 2 ? rawStart : rawEnd, slotPath };
}

function PrettyExpressionComponent({
  expression,
  selectionStart,
  selectionEnd,
  className = "",
  compact = false,
  onPointerDown,
}: PrettyExpressionProps) {
  const selection =
    selectionStart !== undefined && selectionEnd !== undefined ? { start: selectionStart, end: selectionEnd } : null;
  const model = useMemo(() => buildPrettyExpression(expression), [expression]);

  return (
    <span
      className={`pretty-expression ${compact ? "pretty-expression-compact" : ""} ${className}`.trim()}
      onPointerDown={
        onPointerDown
          ? (event) => {
              event.preventDefault();
              const target = resolvePointerTargetFromPoint(event.currentTarget, event.clientX, event.clientY, expression.length);
              onPointerDown(target, event);
            }
          : undefined
      }
      role="presentation"
    >
      {renderNode(model, selection, "root", "root")}
    </span>
  );
}

export const PrettyExpression = memo(PrettyExpressionComponent);
