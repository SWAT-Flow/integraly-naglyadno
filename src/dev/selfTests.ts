import { clampView } from "../math/numeric";
import {
  applyMathFieldCharacter,
  collapseSimpleDenominatorGroups,
  moveMathFieldSelection,
  type MathFieldSelectionState,
} from "../math/mathFieldEditing";
import { buildPrettyExpression, snapshotPrettyExpression } from "../math/prettyExpression";
import { tokenizeInlineMath } from "../learning/inlineMath";
import { LEARNING_MODULES } from "../learning/modules";
import { normalizeFormulaInput } from "../components/FormulaCard";
import {
  compileExpression,
  evaluateCompiled,
  expressionToTex,
  formatExpressionInputText,
  formatExpressionText,
  normalizeExpression,
  parseExpressionInputText,
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

function makeCompiledExpression(id: string, text: string, color = "#2563eb"): CompiledExpression | null {
  const compiled = compileExpression(text);
  if (!compiled.ok) {
    return null;
  }

  return {
    id,
    raw: text,
    normalized: compiled.normalized,
    visible: true,
    color,
    orientation: compiled.orientation,
    evaluate: (value: number) => evaluateCompiled(compiled.compiled, value, compiled.orientation),
  };
}

function simulateMathFieldInput(keys: string[]) {
  let raw = "";
  let state: MathFieldSelectionState = { start: 0, end: 0, activeSlotPath: null };

  for (const key of keys) {
    const next = applyMathFieldCharacter(raw, state, key);
    raw = next.raw;
    state = next.next;
  }

  return { raw, state };
}

export function runSelfTests(): SelfTestResult[] {
  const sinCompiled = compileExpression("sin(x)");
  const sinBroken = compileExpression("sin(");
  const sqrtOpen = compileExpression("sqrt(");
  const constantsCompiled = compileExpression("pi + e + x");
  const logCompiled = compileExpression("log(2, 8)");
  const advancedCompiled = compileExpression("asinh(x) + sec(0)");
  const tanImplicitCompiled = compileExpression("tanx");
  const sidewaysCompiled = compileExpression("x=siny");
  const lnyCompiled = compileExpression("lny");
  const inlineSqrtTokens = tokenizeInlineMath("Под графиком {{tex:y=\\sqrt{x}}} на [0,4].");
  const prettyX2 = snapshotPrettyExpression(buildPrettyExpression("x^2"));
  const prettyXPowGroup = snapshotPrettyExpression(buildPrettyExpression("x^(n+1)"));
  const prettySimpleFraction = snapshotPrettyExpression(buildPrettyExpression("1/x"));
  const prettyPowerFraction = snapshotPrettyExpression(buildPrettyExpression("1/x^2"));
  const prettyGroupedDenominatorFraction = snapshotPrettyExpression(buildPrettyExpression("1/(x^2+1)"));
  const prettyGroupedLinearFraction = snapshotPrettyExpression(buildPrettyExpression("1/(x+1)"));
  const prettyComplexExponentFraction = snapshotPrettyExpression(buildPrettyExpression("1/(x^(2+x))"));
  const prettyGroupedFraction = snapshotPrettyExpression(buildPrettyExpression("(x+1)/(x-1)"));
  const prettyPi = snapshotPrettyExpression(buildPrettyExpression("pi"));
  const prettySqrt = snapshotPrettyExpression(buildPrettyExpression("sqrt(x)"));
  const prettyAbs = snapshotPrettyExpression(buildPrettyExpression("abs(x)"));
  const prettySin = snapshotPrettyExpression(buildPrettyExpression("sin(x)"));
  const prettyLn = snapshotPrettyExpression(buildPrettyExpression("ln(x)"));
  const prettyLogBaseTwo = snapshotPrettyExpression(buildPrettyExpression("log(2, x)"));
  const prettyLogBaseTen = snapshotPrettyExpression(buildPrettyExpression("log(10, x)"));
  const prettyDanglingPower = snapshotPrettyExpression(buildPrettyExpression("x^"));
  const prettyDanglingFraction = snapshotPrettyExpression(buildPrettyExpression("1/"));
  const prettyDanglingGroupedFraction = snapshotPrettyExpression(buildPrettyExpression("1/("));
  const prettyDanglingSqrt = snapshotPrettyExpression(buildPrettyExpression("sqrt("));
  const prettyDanglingSin = snapshotPrettyExpression(buildPrettyExpression("sin("));
  const prettyDanglingPowerGroup = snapshotPrettyExpression(buildPrettyExpression("x^("));
  const prettyDanglingPowerGroupSum = snapshotPrettyExpression(buildPrettyExpression("x^(n+"));
  const typedGroupedDenominator = simulateMathFieldInput(["1", "/", "x", "^", "2", "+", "1"]);
  const typedHeldExponent = simulateMathFieldInput(["x", "^", "2", "+", "2"]);
  const typedLinearDenominator = simulateMathFieldInput(["1", "/", "x", "+", "1"]);
  const typedSqrtDenominator = simulateMathFieldInput(Array.from("1/sqrt(x)+1"));
  const typedBareSqrt = simulateMathFieldInput(Array.from("sqrtx+1"));
  const typedTrigDenominator = simulateMathFieldInput(Array.from("1/sin(x)+cos(x)"));
  const typedComplexExponent = simulateMathFieldInput(["1", "/", "x", "^", "(", "2", "+", "x", ")"]);
  const typedSimpleFraction = simulateMathFieldInput(["1", "/", "x", "^", "2"]);
  const typedEPi = simulateMathFieldInput(["e", "p", "i"]);
  const typedPiPi = simulateMathFieldInput(["p", "i", "p", "i"]);
  const typedPiSqrt = simulateMathFieldInput(Array.from("pisqrt(x)"));
  const exponentExit = moveMathFieldSelection(typedSimpleFraction.raw, typedSimpleFraction.state, "right");
  const denominatorExit = exponentExit ? moveMathFieldSelection(typedSimpleFraction.raw, exponentExit, "right") : null;
  const outsidePlus = denominatorExit ? applyMathFieldCharacter(typedSimpleFraction.raw, denominatorExit, "+") : null;
  const outsideOne = outsidePlus ? applyMathFieldCharacter(outsidePlus.raw, outsidePlus.next, "1") : null;
  const collapsedOutsideSum = outsideOne ? collapseSimpleDenominatorGroups(outsideOne.raw) : null;
  const validExpressions = [makeExpression("f", (x) => x), makeExpression("g", (x) => x * x)];
  const validMap = new Map(validExpressions.map((expression) => [expression.id, expression]));
  const logarithmExpression = makeCompiledExpression("ln-test", "ln(x)");
  const reciprocalExpression = makeCompiledExpression("reciprocal-test", "1 / x");
  const reciprocalSquaredExpression = makeCompiledExpression("reciprocal-squared-test", "1 / x^2");
  const reciprocalCubedExpression = makeCompiledExpression("reciprocal-cubed-test", "1 / x^3");
  const regularPlusTwoExpression = makeCompiledExpression("regular-plus-two-test", "1 / (x^2 + 1) + 2");
  const sincExpression = makeCompiledExpression("sinc-test", "sin(x) / x");
  const absSincExpression = makeCompiledExpression("abs-sinc-test", "abs(sin(x) / x)");
  const sineExpression = makeCompiledExpression("sine-test", "sin(x)");
  const squareExpression = makeCompiledExpression("square-test", "x^2");
  const halfLinearExpression = makeCompiledExpression("half-linear-test", "x / 2");
  const constantOneExpression = makeCompiledExpression("constant-one-test", "1");
  const sidewaysExpression =
    sidewaysCompiled.ok
      ? {
          id: "sideways-test",
          raw: "x=siny",
          normalized: sidewaysCompiled.normalized,
          visible: true,
          color: "#2563eb",
          orientation: sidewaysCompiled.orientation,
          evaluate: (value: number) => evaluateCompiled(sidewaysCompiled.compiled, value, sidewaysCompiled.orientation),
        }
      : null;
  const signedIntegralLabel = "\u041f\u043e\u0434\u043f\u0438\u0441\u0430\u043d\u043d\u044b\u0439 \u0438\u043d\u0442\u0435\u0433\u0440\u0430\u043b";
  const geometricAreaLabel = "\u0413\u0435\u043e\u043c\u0435\u0442\u0440\u0438\u0447\u0435\u0441\u043a\u0430\u044f \u043f\u043b\u043e\u0449\u0430\u0434\u044c";
  const areaLabel = "\u041f\u043b\u043e\u0449\u0430\u0434\u044c";
  const divergentValue = "\u0440\u0430\u0441\u0445\u043e\u0434\u0438\u0442\u0441\u044f";

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
  const clampedFiniteTool = normalizeTool(
    {
      mode: "between",
      exprA: "missing",
      exprB: "missing",
      a: -5000,
      b: 5000,
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
  const infiniteUnderTool = normalizeTool(
    { mode: "under", exprA: "f", a: 1, b: Number.POSITIVE_INFINITY, n: 8, sample: "mid" },
    validExpressions,
  );
  const volumeNoBTool = normalizeTool(
    { mode: "volume", exprA: "f", exprB: null, a: 0, b: 2, n: 8, sample: "mid" },
    validExpressions,
  );

  const betweenOverlay = buildOverlay(
    { mode: "between", exprA: "f", exprB: null, a: 0, b: 1, n: 5, sample: "mid" },
    [validExpressions[0]],
    new Map([["f", validExpressions[0]]]),
  );
  const divergentBetweenOverlay =
    reciprocalSquaredExpression !== null && sineExpression !== null
      ? buildOverlay(
          { mode: "between", exprA: "reciprocal-squared-test", exprB: "sine-test", a: -3, b: 3, n: 5, sample: "mid" },
          [reciprocalSquaredExpression, sineExpression],
          new Map([
            ["reciprocal-squared-test", reciprocalSquaredExpression],
            ["sine-test", sineExpression],
          ]),
        )
      : null;
  const finiteBetweenOverlay =
    squareExpression !== null && sineExpression !== null
      ? buildOverlay(
          { mode: "between", exprA: "square-test", exprB: "sine-test", a: -3, b: 3, n: 5, sample: "mid" },
          [squareExpression, sineExpression],
          new Map([
            ["square-test", squareExpression],
            ["sine-test", sineExpression],
          ]),
        )
      : null;
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
  const logarithmRiemannLeftOverlay =
    logarithmExpression !== null
      ? buildOverlay(
          { mode: "riemann", exprA: "ln-test", a: 0, b: 3, n: 6, sample: "left" },
          [logarithmExpression],
          new Map([["ln-test", logarithmExpression]]),
        )
      : null;
  const reciprocalRiemannOverlay =
    reciprocalExpression !== null
      ? buildOverlay(
          { mode: "riemann", exprA: "reciprocal-test", a: 0, b: 3, n: 6, sample: "mid" },
          [reciprocalExpression],
          new Map([["reciprocal-test", reciprocalExpression]]),
        )
      : null;
  const trapOverlay = buildOverlay(
    { mode: "trap", exprA: "f", a: 0, b: 1, n: 1, sample: "mid" },
    validExpressions,
    validMap,
  );
  const logarithmTrapOverlay =
    logarithmExpression !== null
      ? buildOverlay(
          { mode: "trap", exprA: "ln-test", a: 0, b: 3, n: 6, sample: "mid" },
          [logarithmExpression],
          new Map([["ln-test", logarithmExpression]]),
        )
      : null;
  const reciprocalSquaredTrapOverlay =
    reciprocalSquaredExpression !== null
      ? buildOverlay(
          { mode: "trap", exprA: "reciprocal-squared-test", a: -3, b: 3, n: 6, sample: "mid" },
          [reciprocalSquaredExpression],
          new Map([["reciprocal-squared-test", reciprocalSquaredExpression]]),
        )
      : null;
  const volumeOverlay = buildOverlay(
    { mode: "volume", exprA: "f", a: 0, b: 2, n: 5, sample: "mid" },
    validExpressions,
    validMap,
  );
  const improperFiniteVolumeOverlay =
    reciprocalExpression !== null
      ? buildOverlay(
          { mode: "volume", exprA: "reciprocal-test", a: 1, b: Number.POSITIVE_INFINITY, n: 5, sample: "mid" },
          [reciprocalExpression],
          new Map([["reciprocal-test", reciprocalExpression]]),
        )
      : null;
  const divergentVolumeOverlay =
    constantOneExpression !== null
      ? buildOverlay(
          { mode: "volume", exprA: "constant-one-test", a: 0, b: Number.POSITIVE_INFINITY, n: 5, sample: "mid" },
          [constantOneExpression],
          new Map([["constant-one-test", constantOneExpression]]),
        )
      : null;
  const washersVolumeOverlay =
    validExpressions[0] !== null && halfLinearExpression !== null
      ? buildOverlay(
          { mode: "volume", exprA: "f", exprB: "half-linear-test", a: 0, b: 2, n: 5, sample: "mid" },
          [validExpressions[0], halfLinearExpression],
          new Map([
            ["f", validExpressions[0]],
            ["half-linear-test", halfLinearExpression],
          ]),
        )
      : null;
  const unsupportedVolumeOverlay =
    sidewaysExpression !== null
      ? buildOverlay(
          { mode: "volume", exprA: "sideways-test", a: 0, b: 2, n: 5, sample: "mid" },
          [sidewaysExpression],
          new Map([["sideways-test", sidewaysExpression]]),
        )
      : null;
  const zeroVolumeOverlay = buildOverlay(
    { mode: "volume", exprA: "f", exprB: "f", a: 0, b: 2, n: 5, sample: "mid" },
    validExpressions,
    validMap,
  );
  const singularDivergentVolumeOverlay =
    regularPlusTwoExpression !== null && reciprocalCubedExpression !== null
      ? buildOverlay(
          { mode: "volume", exprA: "regular-plus-two-test", exprB: "reciprocal-cubed-test", a: -3, b: 3, n: 6, sample: "mid" },
          [regularPlusTwoExpression, reciprocalCubedExpression],
          new Map([
            ["regular-plus-two-test", regularPlusTwoExpression],
            ["reciprocal-cubed-test", reciprocalCubedExpression],
          ]),
        )
      : null;
  const infiniteRiemannOverlay =
    reciprocalExpression !== null
      ? buildOverlay(
          { mode: "riemann", exprA: "reciprocal-test", a: 1, b: Number.POSITIVE_INFINITY, n: 6, sample: "mid" },
          [reciprocalExpression],
          new Map([["reciprocal-test", reciprocalExpression]]),
        )
      : null;
  const infiniteTrapOverlay =
    reciprocalExpression !== null
      ? buildOverlay(
          { mode: "trap", exprA: "reciprocal-test", a: 1, b: Number.POSITIVE_INFINITY, n: 6, sample: "mid" },
          [reciprocalExpression],
          new Map([["reciprocal-test", reciprocalExpression]]),
        )
      : null;
  const averageOverlay = buildOverlay(
    { mode: "averageValue", exprA: "f", a: 0, b: 2, n: 5, sample: "mid" },
    validExpressions,
    validMap,
  );
  const reciprocalAverageOverlay =
    reciprocalExpression !== null
      ? buildOverlay(
          { mode: "averageValue", exprA: "reciprocal-test", a: 0, b: 3, n: 5, sample: "mid" },
          [reciprocalExpression],
          new Map([["reciprocal-test", reciprocalExpression]]),
        )
      : null;
  const reciprocalSquaredAverageOverlay =
    reciprocalSquaredExpression !== null
      ? buildOverlay(
          { mode: "averageValue", exprA: "reciprocal-squared-test", a: -3, b: 3, n: 5, sample: "mid" },
          [reciprocalSquaredExpression],
          new Map([["reciprocal-squared-test", reciprocalSquaredExpression]]),
        )
      : null;
  const newtonOverlay = buildOverlay(
    { mode: "newtonLeibniz", exprA: "f", a: 0, b: 2, n: 5, sample: "mid" },
    validExpressions,
    validMap,
  );
  const newtonReciprocalCubedOverlay =
    reciprocalCubedExpression !== null
      ? buildOverlay(
          { mode: "newtonLeibniz", exprA: "reciprocal-cubed-test", a: 0.1, b: 3, n: 5, sample: "mid" },
          [reciprocalCubedExpression],
          new Map([["reciprocal-cubed-test", reciprocalCubedExpression]]),
        )
      : null;
  const clampedView = clampView({ xMin: -5000, xMax: 5000, yMin: -3, yMax: 3 });
  const shiftedView = clampView({ xMin: 995, xMax: 1005, yMin: -1, yMax: 1 });
  const logarithmUnderOverlay =
    logarithmExpression !== null
      ? buildOverlay(
          { mode: "under", exprA: "ln-test", a: 0, b: 3, n: 5, sample: "mid" },
          [logarithmExpression],
          new Map([["ln-test", logarithmExpression]]),
        )
      : null;
  const reciprocalUnderOverlay =
    reciprocalExpression !== null
      ? buildOverlay(
          { mode: "under", exprA: "reciprocal-test", a: 0, b: 3, n: 5, sample: "mid" },
          [reciprocalExpression],
          new Map([["reciprocal-test", reciprocalExpression]]),
        )
      : null;
  const reciprocalSymmetricUnderOverlay =
    reciprocalExpression !== null
      ? buildOverlay(
          { mode: "under", exprA: "reciprocal-test", a: -3, b: 3, n: 5, sample: "mid" },
          [reciprocalExpression],
          new Map([["reciprocal-test", reciprocalExpression]]),
        )
      : null;
  const reciprocalSquaredUnderOverlay =
    reciprocalSquaredExpression !== null
      ? buildOverlay(
          { mode: "under", exprA: "reciprocal-squared-test", a: 0, b: 3, n: 5, sample: "mid" },
          [reciprocalSquaredExpression],
          new Map([["reciprocal-squared-test", reciprocalSquaredExpression]]),
        )
      : null;
  const reciprocalSquaredSymmetricUnderOverlay =
    reciprocalSquaredExpression !== null
      ? buildOverlay(
          { mode: "under", exprA: "reciprocal-squared-test", a: -3, b: 3, n: 5, sample: "mid" },
          [reciprocalSquaredExpression],
          new Map([["reciprocal-squared-test", reciprocalSquaredExpression]]),
        )
      : null;
  const reciprocalTailUnderOverlay =
    reciprocalExpression !== null
      ? buildOverlay(
          { mode: "under", exprA: "reciprocal-test", a: 1, b: Number.POSITIVE_INFINITY, n: 5, sample: "mid" },
          [reciprocalExpression],
          new Map([["reciprocal-test", reciprocalExpression]]),
        )
      : null;
  const reciprocalSquaredTailUnderOverlay =
    reciprocalSquaredExpression !== null
      ? buildOverlay(
          { mode: "under", exprA: "reciprocal-squared-test", a: 1, b: Number.POSITIVE_INFINITY, n: 5, sample: "mid" },
          [reciprocalSquaredExpression],
          new Map([["reciprocal-squared-test", reciprocalSquaredExpression]]),
        )
      : null;
  const sincUnderOverlay =
    sincExpression !== null
      ? buildOverlay(
          { mode: "under", exprA: "sinc-test", a: 0, b: Number.POSITIVE_INFINITY, n: 5, sample: "mid" },
          [sincExpression],
          new Map([["sinc-test", sincExpression]]),
        )
      : null;
  const absSincUnderOverlay =
    absSincExpression !== null
      ? buildOverlay(
          { mode: "under", exprA: "abs-sinc-test", a: 0, b: Number.POSITIVE_INFINITY, n: 5, sample: "mid" },
          [absSincExpression],
          new Map([["abs-sinc-test", absSincExpression]]),
        )
      : null;
  const averageModule = LEARNING_MODULES.find((module) => module.id === "average-value") ?? null;
  const allPracticeItems = LEARNING_MODULES.flatMap((module) =>
    module.sections.flatMap((section) => (section.type === "practice" ? section.items : [])),
  );
  const everyPracticeHasPreset = LEARNING_MODULES.every((module) => {
    const presetIds = new Set(module.presets.map((preset) => preset.id));

    return module.sections.every(
      (section) => section.type !== "practice" || section.items.every((item) => presetIds.has(item.presetId)),
    );
  });

  return [
    pass(`normalizeExpression strips y = prefix`, normalizeExpression("y = x^2") === "x^2"),
    pass(`normalizeExpression rewrites pi symbol`, normalizeExpression("\u03c0 + x") === "pi + x"),
    pass(`normalizeExpression rewrites tanx to tan(x)`, normalizeExpression("tanx") === "tan(x)"),
    pass(`normalizeExpression rewrites x=siny to sin(y)`, normalizeExpression("x=siny") === "sin(y)"),
    pass(`expressionToTex renders x^2 as superscript`, expressionToTex("x^2").includes("^{2}")),
    pass(`expressionToTex renders pi as \\pi`, expressionToTex("pi").includes("\\pi")),
    pass(`expressionToTex renders unary log as \\lg`, expressionToTex("log(x)").includes("\\lg")),
    pass(`expressionToTex renders abs with bars`, expressionToTex("abs(x)").includes("\\left|x\\right|")),
    pass(`normalizeFormulaInput preserves inline \\sqrt`, normalizeFormulaInput("\\sqrt{x}") === "\\sqrt{x}"),
    pass(
      `inline math tokenizer keeps \\sqrt block intact`,
      inlineSqrtTokens.length === 3 &&
        inlineSqrtTokens[1]?.type === "tex" &&
        inlineSqrtTokens[1]?.value === "y=\\sqrt{x}",
    ),
    pass(`expressionToTex renders acos as inverse cosine`, expressionToTex("acos(x)").includes("\\cos^{-1}")),
    pass(`expressionToTex renders acosh as inverse hyperbolic cosine`, expressionToTex("acosh(x)").includes("\\cosh^{-1}")),
    pass(`formatExpressionText renders abs as bars`, formatExpressionText("abs(x)") === "|x|"),
    pass(`formatExpressionText renders x^2 with superscript`, formatExpressionText("x^2 / 6") === "x\u00b2 / 6"),
    pass(`formatExpressionText renders unary log as lg`, formatExpressionText("log(x)") === "lg x"),
    pass(`formatExpressionText renders base log with subscript`, formatExpressionText("log(5, x)") === "log\u2085 x"),
    pass(`formatExpressionText renders bare sqrt as root sign`, formatExpressionText("sqrt") === "\u221a"),
    pass(`pretty renderer builds x^2 as a power node`, prettyX2 === "pow(x|2)"),
    pass(`pretty renderer builds x^(n+1) with grouped exponent`, prettyXPowGroup === "pow(x|group(seq(n + 1)))"),
    pass(`pretty renderer builds 1/x as a fraction`, prettySimpleFraction === "frac(1|x)"),
    pass(`pretty renderer builds 1/x^2 as fraction over a power`, prettyPowerFraction === "frac(1|pow(x|2))"),
    pass(
      `pretty renderer builds 1/(x^2+1) as fraction with grouped denominator`,
      prettyGroupedDenominatorFraction === "frac(1|group(seq(pow(x|2) + 1)))",
    ),
    pass(
      `pretty renderer builds 1/(x+1) as fraction with grouped denominator`,
      prettyGroupedLinearFraction === "frac(1|group(seq(x + 1)))",
    ),
    pass(
      `pretty renderer builds 1/(x^(2+x)) with a grouped exponent inside the denominator`,
      prettyComplexExponentFraction === "frac(1|group(pow(x|group(seq(2 + x)))))",
    ),
    pass(
      `pretty renderer builds (x+1)/(x-1) as grouped fraction`,
      prettyGroupedFraction === "frac(group(seq(x + 1))|group(seq(x − 1)))",
    ),
    pass(`pretty renderer displays pi as π`, prettyPi === "\u03c0"),
    pass(`pretty renderer builds sqrt(x) as root`, prettySqrt === "sqrt(x)"),
    pass(`pretty renderer builds abs(x) as modulus`, prettyAbs === "abs(x)"),
    pass(`pretty renderer builds sin(x) as a function node`, prettySin === "fn(sin|x)"),
    pass(`pretty renderer builds ln(x) as a function node`, prettyLn === "fn(ln|x)"),
    pass(`pretty renderer builds log(2, x) with visible base`, prettyLogBaseTwo === "logbase(2|x)"),
    pass(`pretty renderer builds log(10, x) with visible base`, prettyLogBaseTen === "logbase(10|x)"),
    pass(`pretty renderer keeps x^ as an incomplete power`, prettyDanglingPower === "pow(x|□)"),
    pass(`pretty renderer keeps 1/ as an incomplete fraction`, prettyDanglingFraction === "frac(1|□)"),
    pass(`pretty renderer keeps 1/( as a grouped denominator`, prettyDanglingGroupedFraction === "frac(1|group-open(□))"),
    pass(`pretty renderer keeps sqrt( as an incomplete root`, prettyDanglingSqrt === "sqrt(□)"),
    pass(`pretty renderer keeps sin( as an incomplete function call`, prettyDanglingSin === "fn(sin|□)"),
    pass(`pretty renderer keeps x^( as an open grouped exponent`, prettyDanglingPowerGroup === "pow(x|group-open(□))"),
    pass(
      `pretty renderer keeps x^(n+ as an open grouped exponent sum`,
      prettyDanglingPowerGroupSum === "pow(x|group-open(seq(n + □)))",
    ),
    pass(`formatExpressionInputText renders sqrt inline`, formatExpressionInputText("sqrt(x)") === "\u221a(x)"),
    pass(`formatExpressionInputText renders pi inline`, formatExpressionInputText("pi / 2") === "\u03c0 / 2"),
    pass(`formatExpressionInputText renders dangling exponent slot as blank`, formatExpressionInputText("x^") === "x\u200a"),
    pass(`formatExpressionInputText renders simple fraction inline`, formatExpressionInputText("1/x") === "\u00b9\u2044\u2093"),
    pass(`parseExpressionInputText restores sqrt`, parseExpressionInputText("\u221a(x)") === "sqrt(x)"),
    pass(`parseExpressionInputText restores superscripts`, parseExpressionInputText("x\u00b2") === "x^2"),
    pass(`parseExpressionInputText restores exponent placeholder`, parseExpressionInputText("x\u200a") === "x^"),
    pass(`parseExpressionInputText restores simple fraction`, parseExpressionInputText("\u00b9\u2044\u2093") === "1/x"),
    pass(`slot-aware input keeps operators inside an active exponent until explicit exit`, typedHeldExponent.raw === "x^(2+2)"),
    pass(`slot-aware input keeps 1 / x ^ 2 + 1 inside the active exponent before explicit exit`, typedGroupedDenominator.raw === "1/(x^(2+1))"),
    pass(`slot-aware input keeps 1 / x + 1 inside the denominator`, typedLinearDenominator.raw === "1/(x+1)"),
    pass(`slot-aware input keeps 1 / sqrt(x) + 1 inside the denominator`, typedSqrtDenominator.raw === "1/(sqrt(x)+1)"),
    pass(`slot-aware input turns typed sqrt into a root slot`, typedBareSqrt.raw === "sqrt(x+1)"),
    pass(`slot-aware input keeps 1 / sin(x) + cos(x) inside the denominator`, typedTrigDenominator.raw === "1/(sin(x)+cos(x))"),
    pass(`slot-aware input keeps 1 / x ^ (2+x) as a grouped exponent inside the denominator`, typedComplexExponent.raw === "1/(x^(2+x))"),
    pass(`slot-aware input separates e and pi into distinct tokens`, typedEPi.raw === "e*pi"),
    pass(`slot-aware input separates pi and pi into distinct tokens`, typedPiPi.raw === "pi*pi"),
    pass(`slot-aware input separates pi and sqrt into distinct factors`, typedPiSqrt.raw === "pi*sqrt(x)"),
    pass(
      `arrow right exits exponent before leaving the denominator`,
      exponentExit?.activeSlotPath === "root/den" && denominatorExit?.activeSlotPath === null,
    ),
    pass(
      `explicit exit from denominator allows external +1`,
      collapsedOutsideSum === "1/x^2+1",
    ),
    pass(
      `arrow left re-enters the exponent before leaving the fraction`,
      moveMathFieldSelection(typedSimpleFraction.raw, exponentExit ?? typedSimpleFraction.state, "left")?.activeSlotPath ===
        "root/den/content/exp",
    ),
    pass(
      `formatExpressionText renders sqrt(x) as a root without parser brackets`,
      formatExpressionText("sqrt(x)") === "\u221ax",
    ),
    pass(`formatExpressionText keeps pretty sqrt for "sqrt("`, formatExpressionText("sqrt(") === "\u221a("),
    pass(`formatExpressionText keeps pretty sqrt for "sqrt()"`, formatExpressionText("sqrt()") === "\u221a"),
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
    pass(
      `compileExpression("sqrt(") reports missing argument`,
      !sqrtOpen.ok && sqrtOpen.error.includes("Введите аргумент"),
    ),
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
      `compileExpression supports lg(x)`,
      (() => {
        const compiled = compileExpression("lg(x)");
        return compiled.ok ? Math.abs(evaluateCompiled(compiled.compiled, 100) - 2) < 1e-6 : false;
      })(),
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
    pass(
      `normalizeTool accepts new modes`,
      normalizeTool({ mode: "newtonLeibniz" }, validExpressions).mode === "newtonLeibniz" &&
        normalizeTool({ mode: "averageValue" }, validExpressions).mode === "averageValue",
    ),
    pass(`normalizeTool clamps finite a/b to [-1000, 1000]`, clampedFiniteTool.a === -1000 && clampedFiniteTool.b === 1000),
    pass(
      `normalizeTool preserves infinity for supported modes`,
      infiniteUnderTool.b === Number.POSITIVE_INFINITY && infiniteUnderTool.a === 1,
    ),
    pass(`normalizeTool enforces n >= 2`, normalizedTool.n === 2),
    pass(
      `normalizeTool keeps between mode stable with one function`,
      oneFunctionBetween.exprA === "f" && oneFunctionBetween.exprB === "f",
    ),
    pass(`normalizeTool picks the second function when exprA === exprB`, duplicateBetween.exprB === "g"),
    pass(`normalizeTool keeps exprB optional in volume mode`, volumeNoBTool.exprB === null),
    pass(`clampView keeps x inside [-1000, 1000]`, clampedView.xMin >= -1000 && clampedView.xMax <= 1000),
    pass(`clampView shifts overflowing windows back inside bounds`, shiftedView.xMin >= -1000 && shiftedView.xMax <= 1000),
    pass(`buildOverlay does not crash with 0 functions`, emptyOverlay.metrics.length > 0),
    pass(
      `buildOverlay between survives with 1 function`,
      betweenOverlay.metrics.length > 0 && betweenOverlay.regions.length === 0,
    ),
    pass(
      `between marks 1/x^2 and sin(x) on [-3,3] as divergent`,
      divergentBetweenOverlay !== null &&
        divergentBetweenOverlay.metrics.some((metric) => metric.label === areaLabel && metric.value === divergentValue),
    ),
    pass(
      `divergent between does not build finite segment formulas`,
      divergentBetweenOverlay !== null &&
        divergentBetweenOverlay.formulaSteps.some((step) => step === "S = \\text{расходится}") &&
        divergentBetweenOverlay.formulaSteps.every((step) => !/^S_\d+ =/.test(step)),
    ),
    pass(
      `divergent between hides ordinary area shading`,
      divergentBetweenOverlay !== null && divergentBetweenOverlay.regions.length === 0,
    ),
    pass(
      `finite between case stays finite and keeps overlay shading`,
      finiteBetweenOverlay !== null &&
        finiteBetweenOverlay.metrics.some((metric) => metric.label === areaLabel && metric.value !== divergentValue) &&
        finiteBetweenOverlay.regions.length > 0,
    ),
    pass(
      `buildOverlay under repairs invalid exprA safely`,
      invalidUnderOverlay.metrics.length > 0 && invalidUnderOverlay.verticals.length === 2,
    ),
    pass(
      `under keeps ln(x) on [0,3] finite`,
      logarithmUnderOverlay !== null &&
        logarithmUnderOverlay.metrics.some(
          (metric) => metric.label === "Подписанный интеграл" && metric.value !== "расходится" && metric.value !== "-",
        ),
    ),
    pass(
      `under marks 1/x on [0,3] as divergent`,
      reciprocalUnderOverlay !== null &&
        reciprocalUnderOverlay.metrics.some(
          (metric) => metric.label === "Подписанный интеграл" && metric.value === "расходится",
        ),
    ),
    pass(
      `under marks geometric area for 1/x on [0,3] as divergent`,
      reciprocalUnderOverlay !== null &&
        reciprocalUnderOverlay.metrics.some(
          (metric) => metric.label === "Геометрическая площадь" && metric.value === "расходится",
        ),
    ),
    pass(
      `under keeps geometric area for ln(x) on [0,3] finite`,
      logarithmUnderOverlay !== null &&
        logarithmUnderOverlay.metrics.some(
          (metric) => metric.label === geometricAreaLabel && metric.value !== divergentValue && metric.value !== "-",
        ),
    ),
    pass(
      `under marks 1/x^2 on [0,3] as divergent`,
      reciprocalSquaredUnderOverlay !== null &&
        reciprocalSquaredUnderOverlay.metrics.some(
          (metric) => metric.label === signedIntegralLabel && metric.value === divergentValue,
        ),
    ),
    pass(
      `under marks 1/x^2 on [-3,3] as divergent`,
      reciprocalSquaredSymmetricUnderOverlay !== null &&
        reciprocalSquaredSymmetricUnderOverlay.metrics.some(
          (metric) => metric.label === signedIntegralLabel && metric.value === divergentValue,
        ),
    ),
    pass(
      `under marks geometric area for 1/x^2 on [-3,3] as divergent`,
      reciprocalSquaredSymmetricUnderOverlay !== null &&
        reciprocalSquaredSymmetricUnderOverlay.metrics.some(
          (metric) => metric.label === geometricAreaLabel && metric.value === divergentValue,
        ),
    ),
    pass(
      `under keeps sin(x)/x on [0,+∞) finite as a signed improper integral`,
      sincUnderOverlay !== null &&
        sincUnderOverlay.metrics.some(
          (metric) =>
            metric.label === signedIntegralLabel &&
            metric.value !== divergentValue &&
            metric.value !== "-" &&
            Math.abs(Number(metric.value) - Math.PI / 2) < 0.05,
        ),
    ),
    pass(
      `under marks geometric area for sin(x)/x on [0,+∞) as divergent`,
      sincUnderOverlay !== null &&
        sincUnderOverlay.metrics.some(
          (metric) => metric.label === geometricAreaLabel && metric.value === divergentValue,
        ),
    ),
    pass(
      `under marks abs(sin(x)/x) on [0,+∞) as divergent`,
      absSincUnderOverlay !== null &&
        absSincUnderOverlay.metrics.some(
          (metric) => metric.label === signedIntegralLabel && metric.value === divergentValue,
        ),
    ),
    pass(
      `under marks 1/x on [1,+∞) as divergent`,
      reciprocalTailUnderOverlay !== null &&
        reciprocalTailUnderOverlay.metrics.some(
          (metric) => metric.label === signedIntegralLabel && metric.value === divergentValue,
        ),
    ),
    pass(
      `under keeps 1/x^2 on [1,+∞) finite`,
      reciprocalSquaredTailUnderOverlay !== null &&
        reciprocalSquaredTailUnderOverlay.metrics.some(
          (metric) => metric.label === signedIntegralLabel && metric.value !== divergentValue && metric.value !== "-",
        ),
    ),
    pass(
      `under treats 1/x on [-3,3] as an ordinary divergent improper integral`,
      reciprocalSymmetricUnderOverlay !== null &&
        reciprocalSymmetricUnderOverlay.metrics.some(
          (metric) => metric.label === signedIntegralLabel && metric.value === divergentValue,
        ),
    ),
    pass(
      `under hides ordinary finite-area shading when result diverges`,
      reciprocalSquaredSymmetricUnderOverlay !== null && reciprocalSquaredSymmetricUnderOverlay.regions.length === 0,
    ),
    pass(
      `riemann/trap normalize bad n to 2`,
      riemannOverlay.metrics.some((metric) => metric.label === "n" && metric.value === "2") &&
        trapOverlay.metrics.some((metric) => metric.label === "n" && metric.value === "2"),
    ),
    pass(
      `riemann marks 1/x on [0,3] as divergent instead of a finite approximation`,
      reciprocalRiemannOverlay !== null &&
        reciprocalRiemannOverlay.metrics.some(
          (metric) => metric.label === "Сумма Римана" && metric.value === divergentValue,
        ) &&
        reciprocalRiemannOverlay.polygons.length === 0,
    ),
    pass(
      `trap marks 1/x^2 on [-3,3] as divergent instead of a finite approximation`,
      reciprocalSquaredTrapOverlay !== null &&
        reciprocalSquaredTrapOverlay.metrics.some(
          (metric) => metric.label === "Трапеции" && metric.value === divergentValue,
        ) &&
        reciprocalSquaredTrapOverlay.polygons.length === 0,
    ),
    pass(
      `riemann reports infinite bounds as unsupported without preview`,
      infiniteRiemannOverlay !== null &&
        infiniteRiemannOverlay.metrics.some(
          (metric) => metric.label === "Сумма Римана" && metric.value === "не поддерживается",
        ) &&
        infiniteRiemannOverlay.polygons.length === 0,
    ),
    pass(
      `trap reports infinite bounds as unsupported without preview`,
      infiniteTrapOverlay !== null &&
        infiniteTrapOverlay.metrics.some(
          (metric) => metric.label === "Трапеции" && metric.value === "не поддерживается",
        ) &&
        infiniteTrapOverlay.polygons.length === 0,
    ),
    pass(
      `riemann keeps finite ln(x) integral but hides approximation when left samples hit the singular boundary`,
      logarithmRiemannLeftOverlay !== null &&
        logarithmRiemannLeftOverlay.metrics.some(
          (metric) => metric.label === "Интеграл" && metric.value !== divergentValue && metric.value !== "-",
        ) &&
        logarithmRiemannLeftOverlay.metrics.some(
          (metric) => metric.label === "Сумма Римана" && metric.value === "недоступно",
        ) &&
        logarithmRiemannLeftOverlay.polygons.length === 0,
    ),
    pass(
      `trap keeps finite ln(x) integral but hides approximation when endpoints hit the singular boundary`,
      logarithmTrapOverlay !== null &&
        logarithmTrapOverlay.metrics.some(
          (metric) => metric.label === "Интеграл" && metric.value !== divergentValue && metric.value !== "-",
        ) &&
        logarithmTrapOverlay.metrics.some(
          (metric) => metric.label === "Трапеции" && metric.value === "недоступно",
        ) &&
        logarithmTrapOverlay.polygons.length === 0,
    ),
    pass(`volume overlay keeps preview for finite one-function case`, volumeOverlay.volumePreview !== null),
    pass(
      `volume preview uses enough slices to avoid a coarse square-like body`,
      (volumeOverlay.volumePreview?.slices.length ?? 0) >= 64,
    ),
    pass(
      `volume supports improper finite tail for 1/x on [1,+∞)`,
      improperFiniteVolumeOverlay !== null &&
        improperFiniteVolumeOverlay.metrics.some(
          (metric) => metric.label === "Объём" && metric.value !== divergentValue && metric.value !== "-",
        ) &&
        improperFiniteVolumeOverlay.volumePreview !== null,
    ),
    pass(
      `volume marks divergent infinite case without preview`,
      divergentVolumeOverlay !== null &&
        divergentVolumeOverlay.metrics.some((metric) => metric.label === "Объём" && metric.value === divergentValue) &&
        divergentVolumeOverlay.volumePreview === null,
    ),
    pass(
      `volume supports washers between two explicit graphs`,
      washersVolumeOverlay !== null &&
        washersVolumeOverlay.metrics.some(
          (metric) => metric.label === "Объём" && metric.value !== divergentValue && metric.value !== "-",
        ) &&
        washersVolumeOverlay.volumePreview?.section === "washer" &&
        (washersVolumeOverlay.volumePreview?.sampleInnerR ?? 0) > 0,
    ),
    pass(
      `volume keeps equal radii as a compact zero-volume case without preview`,
      zeroVolumeOverlay.metrics.some((metric) => metric.label === "Объём" && metric.value === "0") &&
        zeroVolumeOverlay.volumePreview === null,
    ),
    pass(
      `volume rejects unsupported x=f(y) input without preview`,
      unsupportedVolumeOverlay !== null &&
        unsupportedVolumeOverlay.volumePreview === null &&
        unsupportedVolumeOverlay.metrics.length > 0,
    ),
    pass(
      `volume hides preview for an internal singularity that makes the radius blow up`,
      singularDivergentVolumeOverlay !== null &&
        singularDivergentVolumeOverlay.metrics.some((metric) => metric.label === "Объём" && metric.value === divergentValue) &&
        singularDivergentVolumeOverlay.volumePreview === null,
    ),
    pass(
      `average value overlay computes mean and returns guide line`,
      averageOverlay.metrics.some((metric) => metric.label === "\u0422\u0435\u043e\u0440\u0435\u043c\u0430 \u043e \u0441\u0440\u0435\u0434\u043d\u0435\u043c" && metric.value === "1") &&
        averageOverlay.polylines.length > 0,
    ),
    pass(
      `average value overlay adds overlay shading for the average rectangle`,
      averageOverlay.regions.length >= 2,
    ),
    pass(
      `average value marks 1/x on [0,3] as divergent`,
      reciprocalAverageOverlay !== null &&
        reciprocalAverageOverlay.metrics.some(
          (metric) => metric.label === "Теорема о среднем" && metric.value === divergentValue,
        ) &&
        reciprocalAverageOverlay.polylines.length === 0,
    ),
    pass(
      `average value marks 1/x^2 on [-3,3] as divergent`,
      reciprocalSquaredAverageOverlay !== null &&
        reciprocalSquaredAverageOverlay.metrics.some(
          (metric) => metric.label === "Теорема о среднем" && metric.value === divergentValue,
        ) &&
        reciprocalSquaredAverageOverlay.regions.length === 0,
    ),
    pass(
      `average value divergent formula avoids a fraction with "расходится" inside`,
      reciprocalSquaredAverageOverlay !== null &&
        reciprocalSquaredAverageOverlay.formulaSteps.every((step) => !step.includes("\\frac{\\text{расходится}}")),
    ),
    pass(
      `average value formula emphasizes integral = average height times width`,
      averageOverlay.formulaSteps.some((step) => step.includes("f_{\\text{ср}}") && step.includes("\\int")) &&
        averageOverlay.formulaSteps.every((step) => !step.includes("\\frac{1}{")),
    ),
    pass(
      `average value module starts from the average-value formula`,
      averageModule !== null &&
        averageModule.sections.some(
          (section) =>
            section.type === "formula" &&
            section.tex === "f_{\\text{ср}}=\\frac{1}{b-a}\\int_a^b f(x)\\,dx",
        ),
    ),
    pass(
      `newton-leibniz overlay stays safe and returns formula steps`,
      newtonOverlay.metrics.length > 0 &&
        newtonOverlay.formulaSteps.length >= 2 &&
        newtonOverlay.explanation.length > 0,
    ),
    pass(
      `newton-leibniz shows an explicit primitive for simple reciprocal powers`,
      newtonReciprocalCubedOverlay !== null &&
        newtonReciprocalCubedOverlay.formulaSteps[0]?.includes("F(x)") &&
        newtonReciprocalCubedOverlay.formulaSteps.some((step) => step.includes("\\frac")),
    ),
    pass(
      `riemann formula steps avoid abstract I`,
      riemannOverlay.formulaSteps.every((step) => !step.includes(" I")) &&
        riemannOverlay.formulaSteps.every((step) => !step.includes("\\sum")),
    ),
    pass(
      `trap formula steps avoid abstract I`,
      trapOverlay.formulaSteps.every((step) => !step.includes(" I")) &&
        trapOverlay.formulaSteps.every((step) => !step.includes("\\sum")),
    ),
    pass(`learning registry contains exactly 11 modules`, LEARNING_MODULES.length === 11),
    pass(
      `every module has title summary and content`,
      LEARNING_MODULES.every((module) => module.title && module.summary && module.sections.length > 0),
    ),
    pass(
      `every module has preset or practice`,
      LEARNING_MODULES.every(
        (module) =>
          module.presets.length > 0 ||
          module.sections.some((section) => section.type === "practice" && section.items.length > 0),
      ),
    ),
    pass(
      `every module contains basic medium and hard practice examples`,
      LEARNING_MODULES.every((module) => {
        const practiceSection = module.sections.find((section) => section.type === "practice");
        if (!practiceSection || practiceSection.type !== "practice" || practiceSection.items.length !== 3) {
          return false;
        }

        const levels = practiceSection.items.map((item) => item.level);
        return levels.includes("Базовый") && levels.includes("Средний") && levels.includes("Сложный");
      }),
    ),
    pass(`every practice item has a calculator preset id`, allPracticeItems.every((item) => Boolean(item.presetId))),
    pass(`every practice item resolves to a valid calculator preset`, everyPracticeHasPreset),
    pass(
      `learning presets use supported tool modes`,
      LEARNING_MODULES.every((module) =>
        module.presets.every((preset) =>
          ["none", "under", "between", "riemann", "trap", "volume", "newtonLeibniz", "averageValue"].includes(
            preset.tool.mode ?? "none",
          ),
        ),
      ),
    ),
  ];
}
