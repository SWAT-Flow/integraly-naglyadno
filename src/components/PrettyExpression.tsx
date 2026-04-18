import { Fragment, memo, useMemo, type ReactNode } from "react";
import { buildPrettyExpression, type PrettyFunctionNode, type PrettyLeafNode, type PrettyNode } from "../math/prettyExpression";

interface PrettyExpressionProps {
  expression: string;
  selectionStart?: number;
  selectionEnd?: number;
  className?: string;
  compact?: boolean;
  onPointerDown?: (rawIndex: number, event: React.PointerEvent<HTMLSpanElement>) => void;
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
    return [
      {
        rawStart,
        rawEnd,
        text: display,
        key: `${keyPrefix}-full`,
      },
    ];
  }

  if (selection.start === selection.end) {
    const caret = selection.start;
    if (caret < rawStart || caret > rawEnd) {
      return [
        {
          rawStart,
          rawEnd,
          text: display,
          key: `${keyPrefix}-full`,
        },
      ];
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
    return [
      {
        rawStart,
        rawEnd,
        text: display,
        key: `${keyPrefix}-full`,
      },
    ];
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
  const tokenClassName = `pretty-expression-token-${node.leafType}`;
  return (
    <Fragment key={key}>
      {renderInteractiveLeaf(node.display, node.rawStart, node.rawEnd, selection, tokenClassName, key)}
    </Fragment>
  );
}

function renderFunctionLabel(node: PrettyFunctionNode, selection: SelectionRange | null, key: string) {
  return (
    <span key={key} className="pretty-expression-function-label">
      {renderInteractiveLeaf(
        node.label,
        node.nameStart,
        node.nameEnd,
        selection,
        "pretty-expression-token-function",
        `${key}-label`,
      )}
      {node.inverse ? (
        <span className="pretty-expression-function-inverse">
          <span className="pretty-expression-function-inverse-text">−1</span>
        </span>
      ) : null}
    </span>
  );
}

function renderNode(node: PrettyNode, selection: SelectionRange | null, key: string): ReactNode {
  switch (node.kind) {
    case "leaf":
      return renderLeaf(node, selection, key);
    case "placeholder":
      return renderPlaceholder(node, selection, key);
    case "sequence":
      return (
        <span key={key} className="pretty-expression-sequence">
          {node.children.map((child, index) => renderNode(child, selection, `${key}-${index}`))}
        </span>
      );
    case "group":
      return (
        <span key={key} className="pretty-expression-group">
          {renderInteractiveLeaf("(", node.openStart, node.openEnd, selection, "pretty-expression-token-paren", `${key}-open`)}
          {renderNode(node.content, selection, `${key}-content`)}
          {node.closeStart !== null && node.closeEnd !== null
            ? renderInteractiveLeaf(")", node.closeStart, node.closeEnd, selection, "pretty-expression-token-paren", `${key}-close`)
            : null}
        </span>
      );
    case "power":
      return (
        <span key={key} className="pretty-expression-power">
          <span className="pretty-expression-power-base">{renderNode(node.base, selection, `${key}-base`)}</span>
          <span className="pretty-expression-power-exponent">{renderNode(node.exponent, selection, `${key}-exp`)}</span>
        </span>
      );
    case "fraction":
      return (
        <span key={key} className="pretty-expression-fraction">
          <span className="pretty-expression-fraction-numerator">
            {renderNode(node.numerator, selection, `${key}-num`)}
          </span>
          <span
            className="pretty-expression-fraction-line"
            data-display-length={1}
            data-raw-end={node.slashEnd}
            data-raw-start={node.slashStart}
          />
          <span className="pretty-expression-fraction-denominator">
            {renderNode(node.denominator, selection, `${key}-den`)}
          </span>
        </span>
      );
    case "function":
      if (node.functionType === "sqrt") {
        return (
          <span key={key} className="pretty-expression-sqrt">
            {renderInteractiveLeaf("√", node.nameStart, node.nameEnd, selection, "pretty-expression-token-function", `${key}-root`)}
            {node.openStart !== null && node.openEnd !== null
              ? renderInteractiveLeaf("(", node.openStart, node.openEnd, selection, "pretty-expression-token-paren", `${key}-open`)
              : null}
            {renderNode(node.args[0] ?? { kind: "placeholder", placeholderType: "argument", rawStart: node.rawEnd, rawEnd: node.rawEnd }, selection, `${key}-arg`)}
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
          <span key={key} className="pretty-expression-abs">
            {renderInteractiveLeaf("|", leftStart, leftEnd, selection, "pretty-expression-token-abs", `${key}-left`)}
            {renderNode(node.args[0] ?? { kind: "placeholder", placeholderType: "argument", rawStart: leftEnd, rawEnd: leftEnd }, selection, `${key}-arg`)}
            {renderInteractiveLeaf("|", rightStart, rightEnd, selection, "pretty-expression-token-abs", `${key}-right`)}
          </span>
        );
      }

      if (node.functionType === "logBase") {
        return (
          <span key={key} className="pretty-expression-log-base">
            <span className="pretty-expression-log-base-label">{renderFunctionLabel(node, selection, `${key}-label`)}</span>
            <span className="pretty-expression-log-base-subscript">
              {renderNode(node.args[0] ?? { kind: "placeholder", placeholderType: "argument", rawStart: node.rawEnd, rawEnd: node.rawEnd }, selection, `${key}-base`)}
            </span>
            {renderInteractiveLeaf("(", node.openStart ?? node.nameEnd, node.openEnd ?? node.nameEnd, selection, "pretty-expression-token-paren", `${key}-open`)}
            {renderNode(node.args[1] ?? { kind: "placeholder", placeholderType: "argument", rawStart: node.rawEnd, rawEnd: node.rawEnd }, selection, `${key}-value`)}
            {node.closeStart !== null && node.closeEnd !== null
              ? renderInteractiveLeaf(")", node.closeStart, node.closeEnd, selection, "pretty-expression-token-paren", `${key}-close`)
              : null}
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
                  {renderNode(argument, selection, `${key}-arg-${index}`)}
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

function resolveRawIndexFromPoint(root: HTMLElement, clientX: number, clientY: number, fallback: number) {
  const documentRef = globalThis.document as (Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  }) | undefined;

  if (!documentRef) {
    return fallback;
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

  const anchor =
    node?.nodeType === globalThis.Node.TEXT_NODE
      ? node.parentElement?.closest<HTMLElement>("[data-raw-start]")
      : (node as Element | null)?.closest?.<HTMLElement>("[data-raw-start]") ?? null;

  if (!anchor) {
    const rect = root.getBoundingClientRect();
    return clientX <= rect.left + rect.width / 2 ? 0 : fallback;
  }

  const rawStart = Number(anchor.dataset.rawStart ?? fallback);
  const rawEnd = Number(anchor.dataset.rawEnd ?? fallback);
  const displayLength = Number(anchor.dataset.displayLength ?? Array.from(anchor.textContent ?? "").length);

  if (node?.nodeType === globalThis.Node.TEXT_NODE) {
    return toRawOffset(offset, rawStart, rawEnd, displayLength);
  }

  const rect = anchor.getBoundingClientRect();
  return clientX <= rect.left + rect.width / 2 ? rawStart : rawEnd;
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
    selectionStart !== undefined && selectionEnd !== undefined
      ? { start: selectionStart, end: selectionEnd }
      : null;
  const model = useMemo(() => buildPrettyExpression(expression), [expression]);

  return (
    <span
      className={`pretty-expression ${compact ? "pretty-expression-compact" : ""} ${className}`.trim()}
      onPointerDown={
        onPointerDown
          ? (event) => {
              event.preventDefault();
              const rawIndex = resolveRawIndexFromPoint(event.currentTarget, event.clientX, event.clientY, expression.length);
              onPointerDown(rawIndex, event);
            }
          : undefined
      }
      role="presentation"
    >
      {renderNode(model, selection, "root")}
    </span>
  );
}

export const PrettyExpression = memo(PrettyExpressionComponent);
