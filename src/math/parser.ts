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
  asinh: "asinh",
  acosh: "acosh",
  atanh: "atanh",
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
  asinh: "\\operatorname{asinh}",
  acosh: "\\operatorname{acosh}",
  atanh: "\\operatorname{atanh}",
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

function toSuperscript(value: string): string {
  return value
    .split("")
    .map((character) => SUPERSCRIPT_MAP[character] ?? character)
    .join("");
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

  return name;
}

function renderSymbolTex(name: string): string {
  if (name === "pi") {
    return "\\pi";
  }

  return name;
}

function renderTextFunction(name: string, args: RenderNode[]): string {
  if (name === "sqrt") {
    return args[0] ? `\u221a${wrapUnaryTextArgument(args[0])}` : "\u221a";
  }

  if (name === "abs") {
    return args[0] ? `|${renderTextNode(args[0])}|` : "| |";
  }

  if (name === "log" && args.length === 2) {
    return `log_{${renderTextNode(args[0])}} ${wrapUnaryTextArgument(args[1])}`;
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
