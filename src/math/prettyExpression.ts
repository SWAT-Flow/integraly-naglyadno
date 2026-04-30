type TokenType = "number" | "identifier" | "operator" | "paren" | "comma" | "unknown";

interface Token {
  type: TokenType;
  value: string;
  start: number;
  end: number;
}

export type PrettyNode =
  | PrettyLeafNode
  | PrettyPlaceholderNode
  | PrettySequenceNode
  | PrettyGroupNode
  | PrettyPowerNode
  | PrettyFractionNode
  | PrettyFunctionNode;

export interface PrettyLeafNode {
  kind: "leaf";
  leafType: "identifier" | "number" | "operator" | "paren" | "comma" | "text";
  display: string;
  rawStart: number;
  rawEnd: number;
}

export interface PrettyPlaceholderNode {
  kind: "placeholder";
  placeholderType: "default" | "superscript" | "denominator" | "argument";
  rawStart: number;
  rawEnd: number;
}

export interface PrettySequenceNode {
  kind: "sequence";
  children: PrettyNode[];
  rawStart: number;
  rawEnd: number;
}

export interface PrettyGroupNode {
  kind: "group";
  content: PrettyNode;
  openStart: number;
  openEnd: number;
  closeStart: number | null;
  closeEnd: number | null;
  rawStart: number;
  rawEnd: number;
}

export interface PrettyPowerNode {
  kind: "power";
  base: PrettyNode;
  exponent: PrettyNode;
  caretStart: number;
  caretEnd: number;
  rawStart: number;
  rawEnd: number;
}

export interface PrettyFractionNode {
  kind: "fraction";
  numerator: PrettyNode;
  denominator: PrettyNode;
  slashStart: number;
  slashEnd: number;
  rawStart: number;
  rawEnd: number;
}

export interface PrettyFunctionNode {
  kind: "function";
  functionType: "normal" | "sqrt" | "abs" | "logBase";
  name: string;
  label: string;
  inverse: boolean;
  args: PrettyNode[];
  nameStart: number;
  nameEnd: number;
  openStart: number | null;
  openEnd: number | null;
  closeStart: number | null;
  closeEnd: number | null;
  rawStart: number;
  rawEnd: number;
}

interface FunctionMeta {
  label: string;
  inverse?: boolean;
  functionType?: PrettyFunctionNode["functionType"];
}

const FUNCTION_META: Record<string, FunctionMeta> = {
  sin: { label: "sin" },
  cos: { label: "cos" },
  tan: { label: "tan" },
  sec: { label: "sec" },
  csc: { label: "csc" },
  cot: { label: "cot" },
  asin: { label: "sin", inverse: true },
  acos: { label: "cos", inverse: true },
  atan: { label: "tan", inverse: true },
  asec: { label: "sec", inverse: true },
  acsc: { label: "csc", inverse: true },
  acot: { label: "cot", inverse: true },
  sinh: { label: "sinh" },
  cosh: { label: "cosh" },
  tanh: { label: "tanh" },
  asinh: { label: "sinh", inverse: true },
  acosh: { label: "cosh", inverse: true },
  atanh: { label: "tanh", inverse: true },
  exp: { label: "exp" },
  ln: { label: "ln" },
  lg: { label: "lg" },
  log: { label: "log" },
  sqrt: { label: "\u221a", functionType: "sqrt" },
  abs: { label: "| |", functionType: "abs" },
};

function isWhitespace(character: string): boolean {
  return /\s/.test(character);
}

function tokenize(raw: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < raw.length) {
    const character = raw[index];

    if (isWhitespace(character)) {
      index += 1;
      continue;
    }

    if (/[0-9]/.test(character) || (character === "." && /[0-9]/.test(raw[index + 1] ?? ""))) {
      const start = index;
      index += 1;
      while (index < raw.length && /[0-9.]/.test(raw[index])) {
        index += 1;
      }
      tokens.push({ type: "number", value: raw.slice(start, index), start, end: index });
      continue;
    }

    if (/[a-z]/i.test(character)) {
      const start = index;
      index += 1;
      while (index < raw.length && /[a-z0-9_]/i.test(raw[index])) {
        index += 1;
      }
      tokens.push({ type: "identifier", value: raw.slice(start, index), start, end: index });
      continue;
    }

    if ("+-*/^".includes(character)) {
      tokens.push({ type: "operator", value: character, start: index, end: index + 1 });
      index += 1;
      continue;
    }

    if ("()".includes(character)) {
      tokens.push({ type: "paren", value: character, start: index, end: index + 1 });
      index += 1;
      continue;
    }

    if (character === ",") {
      tokens.push({ type: "comma", value: character, start: index, end: index + 1 });
      index += 1;
      continue;
    }

    tokens.push({ type: "unknown", value: character, start: index, end: index + 1 });
    index += 1;
  }

  return tokens;
}

function rawSlice(raw: string, start: number, end: number): string {
  return raw.slice(start, end);
}

function normalizeLeafDisplay(value: string): string {
  if (/^pi$/i.test(value)) {
    return "\u03c0";
  }

  if (value === "*") {
    return "\u00b7";
  }

  if (value === "-") {
    return "\u2212";
  }

  return value;
}

function makeLeaf(rawStart: number, rawEnd: number, display: string, leafType: PrettyLeafNode["leafType"]): PrettyLeafNode {
  return { kind: "leaf", leafType, display, rawStart, rawEnd };
}

function makeTokenLeaf(raw: string, token: Token): PrettyLeafNode {
  const leafType =
    token.type === "identifier"
      ? "identifier"
      : token.type === "number"
        ? "number"
        : token.type === "paren"
          ? "paren"
          : token.type === "comma"
            ? "comma"
            : token.type === "operator"
              ? "operator"
              : "text";

  return makeLeaf(token.start, token.end, normalizeLeafDisplay(rawSlice(raw, token.start, token.end)), leafType);
}

function makePlaceholder(position: number, placeholderType: PrettyPlaceholderNode["placeholderType"] = "default"): PrettyPlaceholderNode {
  return { kind: "placeholder", placeholderType, rawStart: position, rawEnd: position };
}

function flattenSequenceChildren(node: PrettyNode): PrettyNode[] {
  return node.kind === "sequence" ? node.children : [node];
}

function makeSequence(children: PrettyNode[]): PrettyNode {
  const compact = children.flatMap(flattenSequenceChildren);
  if (!compact.length) {
    return makePlaceholder(0);
  }

  if (compact.length === 1) {
    return compact[0];
  }

  return {
    kind: "sequence",
    children: compact,
    rawStart: compact[0].rawStart,
    rawEnd: compact[compact.length - 1].rawEnd,
  };
}

function wrapSequence(left: PrettyNode, operatorLeaf: PrettyLeafNode, right: PrettyNode): PrettyNode {
  return makeSequence([left, operatorLeaf, right]);
}

function getNodeEnd(node: PrettyNode): number {
  return node.rawEnd;
}

function getNodeStart(node: PrettyNode): number {
  return node.rawStart;
}

class PrettyExpressionParser {
  private readonly raw: string;

  private readonly tokens: Token[];

  private index = 0;

  constructor(raw: string) {
    this.raw = raw;
    this.tokens = tokenize(raw);
  }

  parse(): PrettyNode {
    if (!this.tokens.length) {
      return makePlaceholder(0);
    }

    const expression = this.parseExpression(new Set());

    if (this.index >= this.tokens.length) {
      return expression;
    }

    const trailing = this.tokens.slice(this.index).map((token) => makeTokenLeaf(this.raw, token));
    return makeSequence([expression, ...trailing]);
  }

  private current(): Token | null {
    return this.tokens[this.index] ?? null;
  }

  private consume(): Token | null {
    const token = this.current();
    if (token) {
      this.index += 1;
    }
    return token;
  }

  private currentPosition(): number {
    return this.current()?.start ?? this.raw.length;
  }

  private atStop(stopValues: Set<string>): boolean {
    const token = this.current();
    return token ? stopValues.has(token.value) : false;
  }

  private parseExpression(stopValues: Set<string>): PrettyNode {
    return this.parseAdditive(stopValues);
  }

  private parseAdditive(stopValues: Set<string>): PrettyNode {
    let node = this.parseMultiplicative(stopValues);

    while (!this.atStop(stopValues)) {
      const token = this.current();
      if (!token || token.type !== "operator" || (token.value !== "+" && token.value !== "-")) {
        break;
      }

      const operator = this.consume();
      if (!operator) {
        break;
      }

      const right = this.atStop(stopValues)
        ? makePlaceholder(operator.end)
        : this.parseMultiplicative(stopValues);

      node = wrapSequence(node, makeTokenLeaf(this.raw, operator), right);
    }

    return node;
  }

  private parseMultiplicative(stopValues: Set<string>): PrettyNode {
    let node = this.parsePower(stopValues);

    while (!this.atStop(stopValues)) {
      const token = this.current();
      if (!token || token.type !== "operator" || (token.value !== "*" && token.value !== "/")) {
        break;
      }

      const operator = this.consume();
      if (!operator) {
        break;
      }

      const right = this.atStop(stopValues)
        ? makePlaceholder(operator.end, operator.value === "/" ? "denominator" : "default")
        : this.parsePower(stopValues);

      if (operator.value === "/") {
        node = {
          kind: "fraction",
          numerator: node,
          denominator: right,
          slashStart: operator.start,
          slashEnd: operator.end,
          rawStart: getNodeStart(node),
          rawEnd: getNodeEnd(right),
        };
      } else {
        node = wrapSequence(node, makeTokenLeaf(this.raw, operator), right);
      }
    }

    return node;
  }

  private parsePower(stopValues: Set<string>): PrettyNode {
    let node = this.parseUnary(stopValues);
    const token = this.current();

    if (!token || token.type !== "operator" || token.value !== "^" || this.atStop(stopValues)) {
      return node;
    }

    const caret = this.consume();
    if (!caret) {
      return node;
    }

    const exponent = this.atStop(stopValues)
      ? makePlaceholder(caret.end, "superscript")
      : this.parsePower(stopValues);

    return {
      kind: "power",
      base: node,
      exponent,
      caretStart: caret.start,
      caretEnd: caret.end,
      rawStart: getNodeStart(node),
      rawEnd: getNodeEnd(exponent),
    };
  }

  private parseUnary(stopValues: Set<string>): PrettyNode {
    const token = this.current();

    if (!token || this.atStop(stopValues)) {
      return makePlaceholder(this.currentPosition());
    }

    if (token.type === "operator" && (token.value === "+" || token.value === "-")) {
      const operator = this.consume();
      if (!operator) {
        return makePlaceholder(this.currentPosition());
      }

      const operand = this.atStop(stopValues) ? makePlaceholder(operator.end) : this.parseUnary(stopValues);
      return makeSequence([makeTokenLeaf(this.raw, operator), operand]);
    }

    return this.parsePrimary(stopValues);
  }

  private parsePrimary(stopValues: Set<string>): PrettyNode {
    const token = this.current();

    if (!token || this.atStop(stopValues)) {
      return makePlaceholder(this.currentPosition());
    }

    if (token.type === "number") {
      this.consume();
      return makeTokenLeaf(this.raw, token);
    }

    if (token.type === "identifier") {
      this.consume();
      return this.parseIdentifier(token);
    }

    if (token.type === "paren" && token.value === "(") {
      return this.parseGroup();
    }

    this.consume();
    return makeTokenLeaf(this.raw, token);
  }

  private parseIdentifier(token: Token): PrettyNode {
    const normalized = token.value.toLowerCase();

    if (normalized === "pi") {
      return makeLeaf(token.start, token.end, "\u03c0", "identifier");
    }

    const meta = FUNCTION_META[normalized];
    if (!meta) {
      return makeTokenLeaf(this.raw, token);
    }

    const next = this.current();
    if (!next || next.type !== "paren" || next.value !== "(") {
      return {
        kind: "function",
        functionType: meta.functionType ?? "normal",
        name: normalized,
        label: meta.label,
        inverse: Boolean(meta.inverse),
        args: [],
        nameStart: token.start,
        nameEnd: token.end,
        openStart: null,
        openEnd: null,
        closeStart: null,
        closeEnd: null,
        rawStart: token.start,
        rawEnd: token.end,
      };
    }

    this.consume();
    return this.parseFunctionCall(token, meta, next);
  }

  private parseFunctionCall(token: Token, meta: FunctionMeta, openToken: Token): PrettyNode {
    const args: PrettyNode[] = [];
    const closeStop = new Set([")"]);

    if (this.atStop(closeStop)) {
      args.push(makePlaceholder(openToken.end, meta.functionType === "sqrt" ? "argument" : "default"));
    } else {
      args.push(this.parseExpression(new Set([",", ")"])));
    }

    if (token.value.toLowerCase() === "log" && this.current()?.type === "comma") {
      const comma = this.consume();
      if (comma) {
        args.push(
          this.atStop(closeStop) ? makePlaceholder(comma.end, "argument") : this.parseExpression(new Set([")"])),
        );
      }
    }

    let closeStart: number | null = null;
    let closeEnd: number | null = null;
    if (this.current()?.type === "paren" && this.current()?.value === ")") {
      const closeToken = this.consume();
      closeStart = closeToken?.start ?? null;
      closeEnd = closeToken?.end ?? null;
    }

    const lastArg = args[args.length - 1] ?? makePlaceholder(openToken.end, "argument");

    return {
      kind: "function",
      functionType:
        token.value.toLowerCase() === "log" && args.length >= 2 ? "logBase" : meta.functionType ?? "normal",
      name: token.value.toLowerCase(),
      label: token.value.toLowerCase() === "log" && args.length === 1 ? "lg" : meta.label,
      inverse: Boolean(meta.inverse),
      args,
      nameStart: token.start,
      nameEnd: token.end,
      openStart: openToken.start,
      openEnd: openToken.end,
      closeStart,
      closeEnd,
      rawStart: token.start,
      rawEnd: closeEnd ?? getNodeEnd(lastArg),
    };
  }

  private parseGroup(): PrettyNode {
    const openToken = this.consume();
    if (!openToken) {
      return makePlaceholder(this.currentPosition());
    }

    const stopValues = new Set([")"]);
    const content = this.atStop(stopValues) ? makePlaceholder(openToken.end) : this.parseExpression(stopValues);

    let closeStart: number | null = null;
    let closeEnd: number | null = null;
    if (this.current()?.type === "paren" && this.current()?.value === ")") {
      const closeToken = this.consume();
      closeStart = closeToken?.start ?? null;
      closeEnd = closeToken?.end ?? null;
    }

    return {
      kind: "group",
      content,
      openStart: openToken.start,
      openEnd: openToken.end,
      closeStart,
      closeEnd,
      rawStart: openToken.start,
      rawEnd: closeEnd ?? getNodeEnd(content),
    };
  }
}

export function buildPrettyExpression(raw: string): PrettyNode {
  return new PrettyExpressionParser(raw).parse();
}

function snapshotChildren(children: PrettyNode[]): string {
  return children.map(snapshotPrettyExpression).join(" ");
}

export function snapshotPrettyExpression(node: PrettyNode): string {
  switch (node.kind) {
    case "leaf":
      return node.display;
    case "placeholder":
      return "\u25a1";
    case "sequence":
      return `seq(${snapshotChildren(node.children)})`;
    case "group":
      return node.closeEnd === null
        ? `group-open(${snapshotPrettyExpression(node.content)})`
        : `group(${snapshotPrettyExpression(node.content)})`;
    case "power":
      return `pow(${snapshotPrettyExpression(node.base)}|${snapshotPrettyExpression(node.exponent)})`;
    case "fraction":
      return `frac(${snapshotPrettyExpression(node.numerator)}|${snapshotPrettyExpression(node.denominator)})`;
    case "function":
      if (node.functionType === "sqrt") {
        return `sqrt(${snapshotPrettyExpression(node.args[0] ?? makePlaceholder(node.rawEnd))})`;
      }

      if (node.functionType === "abs") {
        return `abs(${snapshotPrettyExpression(node.args[0] ?? makePlaceholder(node.rawEnd))})`;
      }

      if (node.functionType === "logBase") {
        return `logbase(${snapshotPrettyExpression(node.args[0] ?? makePlaceholder(node.rawEnd))}|${snapshotPrettyExpression(
          node.args[1] ?? makePlaceholder(node.rawEnd),
        )})`;
      }

      return `fn(${node.label}${node.inverse ? "^-1" : ""}|${snapshotChildren(node.args)})`;
  }
}
