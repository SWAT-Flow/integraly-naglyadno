import { clampView } from "../math/numeric";
import {
  compileExpression,
  evaluateCompiled,
  expressionToTex,
  formatExpressionText,
  normalizeExpression,
} from "../math/parser";
import type { CompiledExpression } from "../types";
import { buildOverlay } from "../tools/buildOverlay";
import { normalizeTool } from "../tools/normalizeTool";

export interface SelfTestResult {
  name: string;
  passed: boolean;
}

function pass(name: string, condition: boolean): SelfTestResult {
  return { name, passed: condition };
}

function makeExpression(id: string, evaluate: (x: number) => number): CompiledExpression {
  return {
    id,
    raw: id,
    normalized: id,
    visible: true,
    color: "#2563eb",
    orientation: "yOfX",
    evaluate,
  };
}

export function runSelfTests(): SelfTestResult[] {
  const sinCompiled = compileExpression("sin(x)");
  const sinBroken = compileExpression("sin(");
  const constantsCompiled = compileExpression("pi + e + x");
  const logCompiled = compileExpression("log(2, 8)");
  const advancedCompiled = compileExpression("asinh(x) + sec(0)");
  const tanImplicitCompiled = compileExpression("tanx");
  const sidewaysCompiled = compileExpression("x=siny");
  const lnyCompiled = compileExpression("lny");
  const validExpressions = [makeExpression("f", (x) => x), makeExpression("g", (x) => x * x)];
  const validMap = new Map(validExpressions.map((expression) => [expression.id, expression]));

  const normalizedTool = normalizeTool(
    {
      mode: "between",
      exprA: "missing",
      exprB: "missing",
      a: Number.NEGATIVE_INFINITY,
      b: Number.POSITIVE_INFINITY,
      n: 0,
      sample: "weird" as never,
    },
    validExpressions,
  );
  const oneFunctionBetween = normalizeTool(
    { mode: "between", exprA: "missing", exprB: "missing", a: 2, b: -2, n: 1, sample: "left" },
    [validExpressions[0]],
  );
  const duplicateBetween = normalizeTool(
    { mode: "between", exprA: "f", exprB: "f", a: 0, b: 1, n: 8, sample: "mid" },
    validExpressions,
  );

  const betweenOverlay = buildOverlay(
    { mode: "between", exprA: "f", exprB: null, a: 0, b: 1, n: 5, sample: "mid" },
    [validExpressions[0]],
    new Map([["f", validExpressions[0]]]),
  );
  const invalidUnderOverlay = buildOverlay(
    { mode: "under", exprA: "missing", a: 0, b: 1, n: 5, sample: "mid" },
    validExpressions,
    validMap,
  );
  const emptyOverlay = buildOverlay({ mode: "under", exprA: null, a: 0, b: 1, n: 5, sample: "mid" }, [], new Map());
  const riemannOverlay = buildOverlay(
    { mode: "riemann", exprA: "f", a: 0, b: 1, n: 1, sample: "left" },
    validExpressions,
    validMap,
  );
  const trapOverlay = buildOverlay(
    { mode: "trap", exprA: "f", a: 0, b: 1, n: 1, sample: "mid" },
    validExpressions,
    validMap,
  );
  const volumeOverlay = buildOverlay(
    { mode: "volume", exprA: "f", a: Number.NEGATIVE_INFINITY, b: 4000, n: 5, sample: "mid" },
    validExpressions,
    validMap,
  );
  const clampedView = clampView({ xMin: -5000, xMax: 5000, yMin: -3, yMax: 3 });
  const shiftedView = clampView({ xMin: 995, xMax: 1005, yMin: -1, yMax: 1 });

  return [
    pass(`normalizeExpression strips y = prefix`, normalizeExpression("y = x^2") === "x^2"),
    pass(`normalizeExpression rewrites pi symbol`, normalizeExpression("\u03c0 + x") === "pi + x"),
    pass(`normalizeExpression rewrites tanx to tan(x)`, normalizeExpression("tanx") === "tan(x)"),
    pass(`normalizeExpression rewrites x=siny to sin(y)`, normalizeExpression("x=siny") === "sin(y)"),
    pass(`expressionToTex renders x^2 as superscript`, expressionToTex("x^2").includes("^{2}")),
    pass(`expressionToTex renders pi as \\pi`, expressionToTex("pi").includes("\\pi")),
    pass(`expressionToTex renders abs with bars`, expressionToTex("abs(x)").includes("\\left|x\\right|")),
    pass(`expressionToTex renders acos as inverse cosine`, expressionToTex("acos(x)").includes("\\cos^{-1}")),
    pass(`expressionToTex renders acosh as inverse hyperbolic cosine`, expressionToTex("acosh(x)").includes("\\cosh^{-1}")),
    pass(`formatExpressionText renders abs as bars`, formatExpressionText("abs(x)") === "|x|"),
    pass(
      `formatExpressionText renders sqrt without brackets`,
      formatExpressionText("sqrt(x)") === "\u221ax",
    ),
    pass(
      `formatExpressionText renders acos as inverse cosine`,
      formatExpressionText("acos(x)") === "cos\u207b\u00b9 x",
    ),
    pass(
      `formatExpressionText renders acosh as inverse hyperbolic cosine`,
      formatExpressionText("acosh(x)") === "cosh\u207b\u00b9 x",
    ),
    pass(`compileExpression("sin(x)") succeeds`, sinCompiled.ok),
    pass(`compileExpression("sin(") returns an error`, !sinBroken.ok),
    pass(`compileExpression("tanx") succeeds`, tanImplicitCompiled.ok),
    pass(
      `compileExpression("x=siny") succeeds as x=f(y)`,
      sidewaysCompiled.ok && sidewaysCompiled.orientation === "xOfY",
    ),
    pass(
      `compileExpression("lny") suggests adding x=`,
      "error" in lnyCompiled && lnyCompiled.error.includes('x ='),
    ),
    pass(
      `evaluateCompiled handles x, pi and e`,
      constantsCompiled.ok
        ? Math.abs(evaluateCompiled(constantsCompiled.compiled, 1) - (Math.PI + Math.E + 1)) < 1e-6
        : false,
    ),
    pass(
      `compileExpression supports log(base, x)`,
      logCompiled.ok ? Math.abs(evaluateCompiled(logCompiled.compiled, 0) - 3) < 1e-6 : false,
    ),
    pass(
      `compileExpression supports sec and asinh`,
      advancedCompiled.ok ? Math.abs(evaluateCompiled(advancedCompiled.compiled, 0) - 1) < 1e-6 : false,
    ),
    pass(
      `evaluateCompiled(sin, pi/2) ~= 1`,
      sinCompiled.ok ? Math.abs(evaluateCompiled(sinCompiled.compiled, Math.PI / 2) - 1) < 1e-6 : false,
    ),
    pass(`normalizeTool repairs missing exprA/exprB`, normalizedTool.exprA === "f" && normalizedTool.exprB === "g"),
    pass(`normalizeTool clamps a/b to [-1000, 1000]`, normalizedTool.a === -1000 && normalizedTool.b === 1000),
    pass(`normalizeTool enforces n >= 2`, normalizedTool.n === 2),
    pass(
      `normalizeTool keeps between mode stable with one function`,
      oneFunctionBetween.exprA === "f" && oneFunctionBetween.exprB === "f",
    ),
    pass(`normalizeTool picks the second function when exprA === exprB`, duplicateBetween.exprB === "g"),
    pass(`clampView keeps x inside [-1000, 1000]`, clampedView.xMin >= -1000 && clampedView.xMax <= 1000),
    pass(`clampView shifts overflowing windows back inside bounds`, shiftedView.xMin >= -1000 && shiftedView.xMax <= 1000),
    pass(`buildOverlay does not crash with 0 functions`, emptyOverlay.metrics.length > 0),
    pass(
      `buildOverlay between survives with 1 function`,
      betweenOverlay.metrics.length > 0 && betweenOverlay.regions.length === 0,
    ),
    pass(
      `buildOverlay under repairs invalid exprA safely`,
      invalidUnderOverlay.metrics.length > 0 && invalidUnderOverlay.verticals.length === 2,
    ),
    pass(
      `riemann/trap normalize bad n to 2`,
      riemannOverlay.metrics.some((metric) => metric.label === "n" && metric.value === "2") &&
        trapOverlay.metrics.some((metric) => metric.label === "n" && metric.value === "2"),
    ),
    pass(
      `volume overlay clamps bad bounds and returns preview`,
      volumeOverlay.volumePreview !== null &&
        volumeOverlay.volumePreview.a >= -1000 &&
        volumeOverlay.volumePreview.b <= 1000,
    ),
  ];
}
