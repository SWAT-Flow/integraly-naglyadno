export interface InlineMathToken {
  type: "text" | "tex";
  value: string;
}

const INLINE_TEX_START = "{{tex:";

function pushTextToken(tokens: InlineMathToken[], value: string) {
  if (!value) {
    return;
  }

  tokens.push({ type: "text", value });
}

function findInlineTexEnd(source: string, startIndex: number): number {
  let braceDepth = 0;

  for (let index = startIndex; index < source.length - 1; index += 1) {
    const symbol = source[index];

    if (symbol === "{") {
      braceDepth += 1;
      continue;
    }

    if (symbol !== "}") {
      continue;
    }

    if (braceDepth > 0) {
      braceDepth -= 1;
      continue;
    }

    if (source[index + 1] === "}") {
      return index;
    }
  }

  return -1;
}

export function tokenizeInlineMath(source: string): InlineMathToken[] {
  const tokens: InlineMathToken[] = [];
  let cursor = 0;

  while (cursor < source.length) {
    const startIndex = source.indexOf(INLINE_TEX_START, cursor);

    if (startIndex === -1) {
      pushTextToken(tokens, source.slice(cursor));
      break;
    }

    pushTextToken(tokens, source.slice(cursor, startIndex));

    const texStart = startIndex + INLINE_TEX_START.length;
    const texEnd = findInlineTexEnd(source, texStart);

    if (texEnd === -1) {
      pushTextToken(tokens, source.slice(startIndex));
      break;
    }

    tokens.push({ type: "tex", value: source.slice(texStart, texEnd) });
    cursor = texEnd + 2;
  }

  return tokens;
}
