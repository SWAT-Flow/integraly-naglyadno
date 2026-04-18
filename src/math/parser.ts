import { all, create } from "mathjs";
import type { ExpressionOrientation } from "../types";

const math = create(all, {});

const CUSTOM_SCOPE = {
  pi: Math.PI,
  e: Math.E,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  sec: (x: number) => 1 / Math.cos(x),
  csc: (x: number) => 1 / Math.sin(x),
  cot: (x: number) => 1 / Math.tan(x),
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  asec: (x: number) => Math.acos(1 / x),
  acsc: (x: number) => Math.asin(1 / x),
  acot: (x: number) => Math.atan(1 / x),
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  asinh: Math.asinh,
  acosh: Math.acosh,
  atanh: Math.atanh,
  exp: Math.exp,
  ln: Math.log,
  log: (...args: number[]) => {
    if (args.length === 1) {
      return Math.log10(args[0]);
    }
    if (args.length === 2) {
      return Math.log(args[1]) / Math.log(args[0]);
    }
    throw new Error("log expects one or two arguments");
  },
  sqrt: Math.sqrt,
  abs: Math.abs,
};

const NORMALIZATION_RULES: Array<[RegExp, string]> = [
  [/\u03c0|\u03a0/g, "pi"],
  [/\u00d7/g, "*"],
  [/\u00f7/g, "/"],
  [/\u2212/g, "-"],
];

const IMPLICIT_UNARY_FUNCTIONS = [
  "asinh",
  "acosh",
  "atanh",
  "asin",
  "acos",
  "atan",
  "asec",
  "acsc",
  "acot",
  "sinh",
  "cosh",
  "tanh",
  "sqrt",
  "sin",
  "cos",
  "tan",
  "sec",
  "csc",
  "cot",
  "abs",
  "exp",
  "log",
  "ln",
] as const;

const INCOMPLETE_UNARY_FUNCTIONS = IMPLICIT_UNARY_FUNCTIONS.filter((name) => name !== "log");

const EMPTY_UNARY_FUNCTION_PATTERN = new RegExp(
  `^(?:${INCOMPLETE_UNARY_FUNCTIONS.join("|")})\\s*\\(\\s*\\)$`,
  "i",
);

const OPEN_UNARY_FUNCTION_PATTERN = new RegExp(
  `^(?:${INCOMPLETE_UNARY_FUNCTIONS.join("|")})(?:\\s*\\(\\s*)?$`,
  "i",
);

const IMPLICIT_FUNCTION_PATTERN = new RegExp(
  `\\b(${IMPLICIT_UNARY_FUNCTIONS.join("|")})\\s*(pi|e|x|y)\\b`,
  "gi",
);

const INVERSE_FUNCTION_TEXT_LABELS: Record<string, string> = {
  asin: "sin\u207b\u00b9",
  acos: "cos\u207b\u00b9",
  atan: "tan\u207b\u00b9",
  asec: "sec\u207b\u00b9",
  acsc: "csc\u207b\u00b9",
  acot: "cot\u207b\u00b9",
  asinh: "sinh\u207b\u00b9",
  acosh: "cosh\u207b\u00b9",
  atanh: "tanh\u207b\u00b9",
};

const FUNCTION_TEXT_LABELS: Record<string, string> = {
  sin: "sin",
  cos: "cos",
  tan: "tan",
  sec: "sec",
  csc: "csc",
  cot: "cot",
  asin: INVERSE_FUNCTION_TEXT_LABELS.asin,
  acos: INVERSE_FUNCTION_TEXT_LABELS.acos,
  atan: INVERSE_FUNCTION_TEXT_LABELS.atan,
  asec: INVERSE_FUNCTION_TEXT_LABELS.asec,
  acsc: INVERSE_FUNCTION_TEXT_LABELS.acsc,
  acot: INVERSE_FUNCTION_TEXT_LABELS.acot,
  sinh: "sinh",
  cosh: "cosh",
  tanh: "tanh",
  asinh: INVERSE_FUNCTION_TEXT_LABELS.asinh,
  acosh: INVERSE_FUNCTION_TEXT_LABELS.acosh,
  atanh: INVERSE_FUNCTION_TEXT_LABELS.atanh,
  exp: "exp",
  ln: "ln",
  log: "log",
  sqrt: "\u221a",
  abs: "||",
};

const FUNCTION_TEX_LABELS: Record<string, string> = {
  sin: "\\sin",
  cos: "\\cos",
  tan: "\\tan",
  sec: "\\sec",
  csc: "\\csc",
  cot: "\\cot",
  asin: "\\sin^{-1}",
  acos: "\\cos^{-1}",
  atan: "\\tan^{-1}",
  asec: "\\sec^{-1}",
  acsc: "\\csc^{-1}",
  acot: "\\cot^{-1}",
  sinh: "\\sinh",
  cosh: "\\cosh",
  tanh: "\\tanh",
  asinh: "\\sinh^{-1}",
  acosh: "\\cosh^{-1}",
  atanh: "\\tanh^{-1}",
  exp: "\\exp",
  ln: "\\ln",
  log: "\\log",
};

const SUPERSCRIPT_MAP: Record<string, string> = {
  "0": "\u2070",
  "1": "\u00b9",
  "2": "\u00b2",
  "3": "\u00b3",
  "4": "\u2074",
  "5": "\u2075",
  "6": "\u2076",
  "7": "\u2077",
  "8": "\u2078",
  "9": "\u2079",
  "-": "\u207b",
  "+": "\u207a",
};

const SUBSCRIPT_MAP: Record<string, string> = {
  "0": "\u2080",
  "1": "\u2081",
  "2": "\u2082",
  "3": "\u2083",
  "4": "\u2084",
  "5": "\u2085",
  "6": "\u2086",
  "7": "\u2087",
  "8": "\u2088",
  "9": "\u2089",
  a: "\u2090",
  e: "\u2091",
  h: "\u2095",
  i: "\u1d62",
  j: "\u2c7c",
  k: "\u2096",
  l: "\u2097",
  m: "\u2098",
  n: "\u2099",
  o: "\u2092",
  p: "\u209a",
  r: "\u1d63",
  s: "\u209b",
  t: "\u209c",
  u: "\u1d64",
  v: "\u1d65",
  x: "\u2093",
  "+": "\u208a",
  "-": "\u208b",
  "=": "\u208c",
  "(": "\u208d",
  ")": "\u208e",
};

const REVERSE_SUPERSCRIPT_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(SUPERSCRIPT_MAP).map(([plain, superscript]) => [superscript, plain]),
);
const REVERSE_SUBSCRIPT_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(SUBSCRIPT_MAP).map(([plain, subscript]) => [subscript, plain]),
);
const FRACTION_SLASH = "\u2044";
const SUPERSCRIPT_PLACEHOLDER = "\u200a";
const SUPERSCRIPT_CHARACTER_SET = Object.keys(REVERSE_SUPERSCRIPT_MAP).join("");
const SUBSCRIPT_CHARACTER_SET = Object.keys(REVERSE_SUBSCRIPT_MAP).join("");

function escapeForCharacterClass(value: string): string {
  return value.replace(/[\\\-\]\[]/g, "\\$&");
}

const INPUT_FRACTION_PATTERN = new RegExp(
  `([${escapeForCharacterClass(SUPERSCRIPT_CHARACTER_SET)}]+)${FRACTION_SLASH}([${escapeForCharacterClass(SUBSCRIPT_CHARACTER_SET)}]+)`,
  "g",
);

export interface CompiledEvaluator {
  evaluate: (scope: Record<string, unknown>) => unknown;
}

export interface ParsedExpression {
  orientation: ExpressionOrientation;
  normalized: string;
}

type RenderNode =
  | BaseRenderNode
  | SymbolRenderNode
  | ConstantRenderNode
  | OperatorRenderNode
  | FunctionRenderNode
  | ParenthesisRenderNode;

interface BaseRenderNode {
  type: string;
  toString: () => string;
}

interface SymbolRenderNode extends BaseRenderNode {
  type: "SymbolNode";
  name: string;
}

interface ConstantRenderNode extends BaseRenderNode {
  type: "ConstantNode";
  value: string | number;
}

interface OperatorRenderNode extends BaseRenderNode {
  type: "OperatorNode";
  op: string;
  args: RenderNode[];
  implicit?: boolean;
}

interface FunctionRenderNode extends BaseRenderNode {
  type: "FunctionNode";
  fn: RenderNode;
  args: RenderNode[];
}

interface ParenthesisRenderNode extends BaseRenderNode {
  type: "ParenthesisNode";
  content: RenderNode;
}

export type CompileResult =
  | {
      ok: true;
      normalized: string;
      orientation: ExpressionOrientation;
      compiled: CompiledEvaluator;
    }
  | {
      ok: false;
      normalized: string;
      orientation: ExpressionOrientation;
      error: string;
    };

function rewriteImplicitFunctionCalls(value: string): string {
  let previous = value;

  for (let iteration = 0; iteration < 3; iteration += 1) {
    const next = previous.replace(
      IMPLICIT_FUNCTION_PATTERN,
      (_match, fn: string, argument: string) => `${fn}(${argument})`,
    );
    if (next === previous) {
      return next;
    }
    previous = next;
  }

  return previous;
}

function hasSymbol(normalized: string, symbol: "x" | "y"): boolean {
  return new RegExp(`\\b${symbol}\\b`).test(normalized);
}

function suggestOrientationMessage(orientation: ExpressionOrientation, normalized: string): string | null {
  const hasX = hasSymbol(normalized, "x");
  const hasY = hasSymbol(normalized, "y");

  if (orientation === "yOfX" && hasY && !hasX) {
    return '\u041d\u0430\u0439\u0434\u0435\u043d\u0430 \u043f\u0435\u0440\u0435\u043c\u0435\u043d\u043d\u0430\u044f y. \u0415\u0441\u043b\u0438 \u0432\u044b \u0445\u043e\u0442\u0438\u0442\u0435 \u043f\u043e\u0441\u0442\u0440\u043e\u0438\u0442\u044c x \u043a\u0430\u043a \u0444\u0443\u043d\u043a\u0446\u0438\u044e y, \u043f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u0434\u043e\u0431\u0430\u0432\u0438\u0442\u044c "x =".';
  }

  if (orientation === "xOfY" && hasX && !hasY) {
    return '\u041d\u0430\u0439\u0434\u0435\u043d\u0430 \u043f\u0435\u0440\u0435\u043c\u0435\u043d\u043d\u0430\u044f x. \u0415\u0441\u043b\u0438 \u0432\u044b \u0445\u043e\u0442\u0438\u0442\u0435 \u043f\u043e\u0441\u0442\u0440\u043e\u0438\u0442\u044c y \u043a\u0430\u043a \u0444\u0443\u043d\u043a\u0446\u0438\u044e x, \u043f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u0434\u043e\u0431\u0430\u0432\u0438\u0442\u044c "y =".';
  }

  return null;
}

function getIncompleteExpressionMessage(normalized: string): string | null {
  if (EMPTY_UNARY_FUNCTION_PATTERN.test(normalized) || OPEN_UNARY_FUNCTION_PATTERN.test(normalized)) {
    return "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0430\u0440\u0433\u0443\u043c\u0435\u043d\u0442 \u0432\u043d\u0443\u0442\u0440\u0438 \u0441\u043a\u043e\u0431\u043e\u043a.";
  }

  if (/^log(?:\s*\(\s*)?$/i.test(normalized) || /^log\(\s*,?\s*\)?$/i.test(normalized)) {
    return "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043e\u0441\u043d\u043e\u0432\u0430\u043d\u0438\u0435 \u0438 \u0430\u0440\u0433\u0443\u043c\u0435\u043d\u0442 \u043b\u043e\u0433\u0430\u0440\u0438\u0444\u043c\u0430.";
  }

  if (/^log\(\s*,\s*\)$/i.test(normalized)) {
    return "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043e\u0441\u043d\u043e\u0432\u0430\u043d\u0438\u0435 \u0438 \u0430\u0440\u0433\u0443\u043c\u0435\u043d\u0442 \u043b\u043e\u0433\u0430\u0440\u0438\u0444\u043c\u0430.";
  }

  if (/^log\(\s*[^,()]+\s*,\s*\)$/i.test(normalized) || /^log\(\s*,\s*[^,()]+\s*\)$/i.test(normalized)) {
    return "\u0417\u0430\u043f\u043e\u043b\u043d\u0438\u0442\u0435 \u043e\u0431\u0430 \u0430\u0440\u0433\u0443\u043c\u0435\u043d\u0442\u0430 \u0432 log(., .).";
  }

  return null;
}

function toSuperscript(value: string): string {
  return value
    .split("")
    .map((character) => SUPERSCRIPT_MAP[character] ?? character)
    .join("");
}

function toSubscript(value: string): string | null {
  const normalized = value.replace(/\s+/g, "");
  if (!normalized) {
    return null;
  }

  let result = "";
  for (const character of normalized) {
    const mapped = SUBSCRIPT_MAP[character.toLowerCase()] ?? SUBSCRIPT_MAP[character];
    if (!mapped) {
      return null;
    }
    result += mapped;
  }

  return result;
}

function fromSuperscript(value: string): string | null {
  if (!value) {
    return null;
  }

  let result = "";
  for (const character of value) {
    const mapped = REVERSE_SUPERSCRIPT_MAP[character];
    if (!mapped) {
      return null;
    }
    result += mapped;
  }

  return result;
}

function fromSubscript(value: string): string | null {
  if (!value) {
    return null;
  }

  let result = "";
  for (const character of value) {
    const mapped = REVERSE_SUBSCRIPT_MAP[character];
    if (!mapped) {
      return null;
    }
    result += mapped;
  }

  return result;
}

function toSuperscriptToken(value: string): string | null {
  const normalized = value.replace(/\s+/g, "");
  if (!normalized) {
    return null;
  }

  let result = "";
  for (const character of normalized) {
    const mapped = SUPERSCRIPT_MAP[character];
    if (!mapped) {
      return null;
    }
    result += mapped;
  }

  return result;
}

function formatSimpleInputFractions(value: string): string {
  return value.replace(/\b(\d+)\s*\/\s*([a-z0-9]+)\b/gi, (match, numerator: string, denominator: string) => {
    const superscript = toSuperscriptToken(numerator);
    const subscript = toSubscript(denominator);

    if (!superscript || !subscript) {
      return match;
    }

    return `${superscript}${FRACTION_SLASH}${subscript}`;
  });
}

function restoreSimpleInputFractions(value: string): string {
  return value.replace(INPUT_FRACTION_PATTERN, (match, numerator: string, denominator: string) => {
    const plainNumerator = fromSuperscript(numerator);
    const plainDenominator = fromSubscript(denominator);

    if (!plainNumerator || !plainDenominator) {
      return match;
    }

    return `${plainNumerator}/${plainDenominator}`;
  });
}

function isSymbolNode(node: RenderNode): node is SymbolRenderNode {
  return node.type === "SymbolNode";
}

function isConstantNode(node: RenderNode): node is ConstantRenderNode {
  return node.type === "ConstantNode";
}

function isOperatorNode(node: RenderNode): node is OperatorRenderNode {
  return node.type === "OperatorNode";
}

function isFunctionNode(node: RenderNode): node is FunctionRenderNode {
  return node.type === "FunctionNode";
}

function isParenthesisNode(node: RenderNode): node is ParenthesisRenderNode {
  return node.type === "ParenthesisNode";
}

function parseRenderNode(expression: string): RenderNode | null {
  try {
    return math.parse(expression) as unknown as RenderNode;
  } catch {
    return null;
  }
}

function getFunctionName(node: RenderNode): string | null {
  return isSymbolNode(node) ? node.name : null;
}

function isSimpleFunctionArgument(node: RenderNode): boolean {
  if (isSymbolNode(node) || isConstantNode(node) || isFunctionNode(node) || isParenthesisNode(node)) {
    return true;
  }

  if (!isOperatorNode(node)) {
    return false;
  }

  if (node.args.length === 1) {
    return true;
  }

  if (node.op === "^") {
    return true;
  }

  return node.op === "*" && Boolean(node.implicit);
}

function isSimplePowerBase(node: RenderNode): boolean {
  return isSymbolNode(node) || isConstantNode(node) || isFunctionNode(node) || isParenthesisNode(node);
}

function wrapUnaryTextArgument(node: RenderNode): string {
  const rendered = renderTextNode(node);
  return isSimpleFunctionArgument(node) ? rendered : `(${rendered})`;
}

function wrapUnaryTexArgument(node: RenderNode): string {
  const rendered = renderTexNode(node);
  return isSimpleFunctionArgument(node) ? rendered : `\\left(${rendered}\\right)`;
}

function wrapBinaryTextOperand(node: RenderNode): string {
  if (!isOperatorNode(node) || node.args.length <= 1) {
    return renderTextNode(node);
  }

  if (node.op === "^") {
    return renderTextNode(node);
  }

  return `(${renderTextNode(node)})`;
}

function wrapBinaryTexOperand(node: RenderNode): string {
  if (!isOperatorNode(node) || node.args.length <= 1) {
    return renderTexNode(node);
  }

  if (node.op === "^") {
    return renderTexNode(node);
  }

  return `\\left(${renderTexNode(node)}\\right)`;
}

function renderExponentText(node: RenderNode): string {
  const rendered = renderTextNode(node);
  return /^[0-9+-]+$/.test(rendered) ? toSuperscript(rendered) : `^(${rendered})`;
}

function renderSymbolText(name: string): string {
  if (name === "pi") {
    return "\u03c0";
  }

  if (name === "sqrt") {
    return "\u221a";
  }

  return name;
}

function renderSymbolTex(name: string): string {
  if (name === "pi") {
    return "\\pi";
  }

  if (name === "sqrt") {
    return "\\sqrt{}";
  }

  return name;
}

function renderTextFunction(name: string, args: RenderNode[]): string {
  if (name === "sqrt") {
    return args[0] ? `\u221a(${renderTextNode(args[0])})` : "\u221a()";
  }

  if (name === "abs") {
    return args[0] ? `|${renderTextNode(args[0])}|` : "| |";
  }

  if (name === "log" && args.length === 1) {
    return `lg ${wrapUnaryTextArgument(args[0])}`;
  }

  if (name === "log" && args.length === 2) {
    const base = renderTextNode(args[0]);
    const baseSubscript = toSubscript(base);
    return `${baseSubscript ? `log${baseSubscript}` : `log_${base}`} ${wrapUnaryTextArgument(args[1])}`;
  }

  const label = FUNCTION_TEXT_LABELS[name] ?? name;

  if (!args.length) {
    return label;
  }

  if (args.length === 1) {
    return `${label} ${wrapUnaryTextArgument(args[0])}`;
  }

  return `${label}(${args.map((argument) => renderTextNode(argument)).join(", ")})`;
}

function renderTexFunction(name: string, args: RenderNode[]): string {
  if (name === "sqrt") {
    return args[0] ? `\\sqrt{${renderTexNode(args[0])}}` : "\\sqrt{}";
  }

  if (name === "abs") {
    return args[0] ? `\\left|${renderTexNode(args[0])}\\right|` : "\\left|\\,\\right|";
  }

  if (name === "log" && args.length === 1) {
    return `\\lg ${wrapUnaryTexArgument(args[0])}`;
  }

  if (name === "log" && args.length === 2) {
    return `\\log_{${renderTexNode(args[0])}} ${wrapUnaryTexArgument(args[1])}`;
  }

  const label = FUNCTION_TEX_LABELS[name] ?? `\\operatorname{${name}}`;

  if (!args.length) {
    return label;
  }

  if (args.length === 1) {
    return `${label} ${wrapUnaryTexArgument(args[0])}`;
  }

  return `${label}\\left(${args.map((argument) => renderTexNode(argument)).join(", ")}\\right)`;
}

function renderTextNode(node: RenderNode): string {
  if (isSymbolNode(node)) {
    return renderSymbolText(node.name);
  }

  if (isConstantNode(node)) {
    return String(node.value);
  }

  if (isParenthesisNode(node)) {
    return `(${renderTextNode(node.content)})`;
  }

  if (isFunctionNode(node)) {
    return renderTextFunction(getFunctionName(node.fn) ?? node.fn.toString(), node.args);
  }

  if (isOperatorNode(node)) {
    const [left, right] = node.args;

    if (node.args.length === 1 && left) {
      const rendered = renderTextNode(left);
      return node.op === "-" ? `-${wrapBinaryTextOperand(left)}` : `${node.op}${rendered}`;
    }

    if (!left || !right) {
      return node.toString();
    }

    if (node.op === "^") {
      const base = isSimplePowerBase(left) ? renderTextNode(left) : `(${renderTextNode(left)})`;
      return `${base}${renderExponentText(right)}`;
    }

    if (node.op === "/") {
      return `${wrapBinaryTextOperand(left)} / ${wrapBinaryTextOperand(right)}`;
    }

    if (node.op === "*") {
      const joiner = node.implicit ? " " : " \u00b7 ";
      return `${wrapBinaryTextOperand(left)}${joiner}${wrapBinaryTextOperand(right)}`;
    }

    return `${renderTextNode(left)} ${node.op} ${renderTextNode(right)}`;
  }

  return node.toString();
}

function renderTexNode(node: RenderNode): string {
  if (isSymbolNode(node)) {
    return renderSymbolTex(node.name);
  }

  if (isConstantNode(node)) {
    return String(node.value);
  }

  if (isParenthesisNode(node)) {
    return `\\left(${renderTexNode(node.content)}\\right)`;
  }

  if (isFunctionNode(node)) {
    return renderTexFunction(getFunctionName(node.fn) ?? node.fn.toString(), node.args);
  }

  if (isOperatorNode(node)) {
    const [left, right] = node.args;

    if (node.args.length === 1 && left) {
      return node.op === "-" ? `-${wrapBinaryTexOperand(left)}` : `${node.op}${renderTexNode(left)}`;
    }

    if (!left || !right) {
      return node.toString();
    }

    if (node.op === "^") {
      const base = isSimplePowerBase(left) ? renderTexNode(left) : `\\left(${renderTexNode(left)}\\right)`;
      return `${base}^{${renderTexNode(right)}}`;
    }

    if (node.op === "/") {
      return `\\frac{${renderTexNode(left)}}{${renderTexNode(right)}}`;
    }

    if (node.op === "*") {
      const joiner = node.implicit ? " " : " \\cdot ";
      return `${wrapBinaryTexOperand(left)}${joiner}${wrapBinaryTexOperand(right)}`;
    }

    return `${renderTexNode(left)} ${node.op} ${renderTexNode(right)}`;
  }

  return node.toString();
}

function formatLooseExpressionText(value: string): string {
  let display = value.trim();

  if (/^sqrt\s*$/i.test(display)) {
    return "\u221a";
  }

  if (/^sqrt\s*\(\s*$/i.test(display)) {
    return "\u221a(";
  }

  if (/^sqrt\s*\(\s*\)$/i.test(display)) {
    return "\u221a()";
  }

  for (const [pattern, replacement] of NORMALIZATION_RULES) {
    display = display.replace(pattern, replacement);
  }

  display = display.replace(/^\s*[xy]\s*=\s*/i, "");

  for (const [name, label] of Object.entries(INVERSE_FUNCTION_TEXT_LABELS)) {
    display = display.replace(new RegExp(`\\b${name}\\s*\\((?=\\s*$)`, "gi"), label);
  }

  display = display.replace(/\babs\s*\(\s*\)/gi, "| |");
  display = display.replace(/\bsqrt\s*\(\s*\)/gi, "\u221a");
  display = display.replace(/\bln\s*\(\s*\)/gi, "ln");
  display = display.replace(/\blog\s*\(\s*\)/gi, "lg");
  display = display.replace(/\blog\s*\(\s*,\s*\)/gi, "log");
  display = display.replace(/\bexp\s*\(\s*\)/gi, "exp");

  for (const [name, label] of Object.entries(FUNCTION_TEXT_LABELS)) {
    if (name === "abs" || name === "sqrt") {
      continue;
    }
    display = display.replace(new RegExp(`\\b${name}\\b`, "gi"), label);
  }

  display = display.replace(/\bpi\b/gi, "\u03c0");
  display = display.replace(/\bsqrt\b/gi, "\u221a");
  display = display.replace(/\babs\s*\(/gi, "|");
  display = display.replace(/\(\s*\)/g, "");
  display = display.replace(/\^([+-]?\d+)/g, (_match, exponent: string) => toSuperscript(exponent));
  display = display.replace(/\s+/g, " ").trim();

  return display;
}

export function formatExpressionText(expression: string): string {
  const parsed = parseRenderNode(expression);
  return parsed ? renderTextNode(parsed).trim() : formatLooseExpressionText(expression);
}

export function formatExpressionInputText(expression: string): string {
  let display = expression;

  for (const [pattern, replacement] of NORMALIZATION_RULES) {
    display = display.replace(pattern, replacement);
  }

  for (const [name, label] of Object.entries(INVERSE_FUNCTION_TEXT_LABELS)) {
    display = display.replace(new RegExp(`\\b${name}\\b`, "gi"), label);
  }

  display = display.replace(/\blog(?=\s*\()/gi, "lg");
  display = display.replace(/\bpi\b/gi, "\u03c0");
  display = display.replace(/\bsqrt\b/gi, "\u221a");
  display = formatSimpleInputFractions(display);
  display = display.replace(/\^(?=\s*(?:$|[+\-*/,)]))/g, SUPERSCRIPT_PLACEHOLDER);
  display = display.replace(/\^([+-]?\d+)/g, (_match, exponent: string) => toSuperscript(exponent));

  return display;
}

export function parseExpressionInputText(text: string): string {
  let raw = text;

  for (const [name, label] of Object.entries(INVERSE_FUNCTION_TEXT_LABELS)) {
    raw = raw.replace(new RegExp(label, "gi"), name);
  }

  raw = raw.replace(/\blg\b/gi, "log");
  raw = raw.replace(/\u03c0|\u03a0/g, "pi");
  raw = raw.replace(/\u221a/g, "sqrt");
  raw = restoreSimpleInputFractions(raw);
  raw = raw.replace(new RegExp(SUPERSCRIPT_PLACEHOLDER, "g"), "^");
  raw = raw.replace(/[\u2070\u00b9\u00b2\u00b3\u2074-\u2079\u207a\u207b]+/g, (superscriptRun) => {
    const plain = fromSuperscript(superscriptRun);
    return plain ? `^${plain}` : superscriptRun;
  });

  return raw;
}

export function expressionToTex(expression: string): string {
  const parsed = parseRenderNode(expression);
  return parsed ? renderTexNode(parsed) : expression;
}

function parseExpression(text: string): ParsedExpression {
  let normalized = text.trim();

  for (const [pattern, replacement] of NORMALIZATION_RULES) {
    normalized = normalized.replace(pattern, replacement);
  }

  let orientation: ExpressionOrientation = "yOfX";
  const yMatch = normalized.match(/^\s*y\s*=\s*(.*)$/i);
  const xMatch = normalized.match(/^\s*x\s*=\s*(.*)$/i);

  if (yMatch) {
    orientation = "yOfX";
    normalized = yMatch[1] ?? "";
  } else if (xMatch) {
    orientation = "xOfY";
    normalized = xMatch[1] ?? "";
  }

  normalized = rewriteImplicitFunctionCalls(normalized);
  normalized = normalized.replace(/\s+/g, " ").trim();

  return { orientation, normalized };
}

export function normalizeExpression(text: string): string {
  return parseExpression(text).normalized;
}

export function compileExpression(text: string): CompileResult {
  const parsed = parseExpression(text);
  const { normalized, orientation } = parsed;

  if (!normalized) {
    return {
      ok: false,
      normalized,
      orientation,
      error: "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0432\u044b\u0440\u0430\u0436\u0435\u043d\u0438\u0435.",
    };
  }

  const suggestion = suggestOrientationMessage(orientation, normalized);
  if (suggestion) {
    return {
      ok: false,
      normalized,
      orientation,
      error: suggestion,
    };
  }

  const incompleteMessage = getIncompleteExpressionMessage(normalized);
  if (incompleteMessage) {
    return {
      ok: false,
      normalized,
      orientation,
      error: incompleteMessage,
    };
  }

  try {
    const compiled = math.compile(normalized) as CompiledEvaluator;
    compiled.evaluate({ ...CUSTOM_SCOPE, x: 0, y: 0 });
    return { ok: true, normalized, orientation, compiled };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0440\u0430\u0437\u043e\u0431\u0440\u0430\u0442\u044c \u0432\u044b\u0440\u0430\u0436\u0435\u043d\u0438\u0435.";

    return { ok: false, normalized, orientation, error: message };
  }
}

export function evaluateCompiled(
  compiled: CompiledEvaluator,
  value: number,
  orientation: ExpressionOrientation = "yOfX",
): number {
  try {
    const raw = compiled.evaluate({
      ...CUSTOM_SCOPE,
      x: orientation === "yOfX" ? value : 0,
      y: orientation === "xOfY" ? value : 0,
    });
    const numeric = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(numeric) ? numeric : Number.NaN;
  } catch {
    return Number.NaN;
  }
}
