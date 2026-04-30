import { clampView } from "../math/numeric";
import { buildPrettyExpression, snapshotPrettyExpression } from "../math/prettyExpression";
import { tokenizeInlineMath } from "../learning/inlineMath";
import { LEARNING_MODULES } from "../learning/modules";
import { normalizeFormulaInput } from "../components/FormulaCard";
import { compileExpression, evaluateCompiled, expressionToTex, formatExpressionInputText, formatExpressionText, normalizeExpression, parseExpressionInputText, } from "../math/parser";
import { buildOverlay } from "../tools/buildOverlay";
import { normalizeTool } from "../tools/normalizeTool";
function pass(name, condition) {
    return { name, passed: condition };
}
function makeExpression(id, evaluate) {
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
function makeCompiledExpression(id, text, color = "#2563eb") {
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
        evaluate: (value) => evaluateCompiled(compiled.compiled, value, compiled.orientation),
    };
}
export function runSelfTests() {
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
    const prettyGroupedFraction = snapshotPrettyExpression(buildPrettyExpression("(x+1)/(x-1)"));
    const prettyPi = snapshotPrettyExpression(buildPrettyExpression("pi"));
    const prettySqrt = snapshotPrettyExpression(buildPrettyExpression("sqrt(x)"));
    const prettyAbs = snapshotPrettyExpression(buildPrettyExpression("abs(x)"));
    const prettySin = snapshotPrettyExpression(buildPrettyExpression("sin(x)"));
    const prettyLn = snapshotPrettyExpression(buildPrettyExpression("ln(x)"));
    const prettyDanglingPower = snapshotPrettyExpression(buildPrettyExpression("x^"));
    const prettyDanglingFraction = snapshotPrettyExpression(buildPrettyExpression("1/"));
    const prettyDanglingSqrt = snapshotPrettyExpression(buildPrettyExpression("sqrt("));
    const prettyDanglingSin = snapshotPrettyExpression(buildPrettyExpression("sin("));
    const prettyDanglingPowerGroup = snapshotPrettyExpression(buildPrettyExpression("x^("));
    const prettyDanglingPowerGroupSum = snapshotPrettyExpression(buildPrettyExpression("x^(n+"));
    const validExpressions = [makeExpression("f", (x) => x), makeExpression("g", (x) => x * x)];
    const validMap = new Map(validExpressions.map((expression) => [expression.id, expression]));
    const logarithmExpression = makeCompiledExpression("ln-test", "ln(x)");
    const reciprocalExpression = makeCompiledExpression("reciprocal-test", "1 / x");
    const reciprocalSquaredExpression = makeCompiledExpression("reciprocal-squared-test", "1 / x^2");
    const signedIntegralLabel = "\u041f\u043e\u0434\u043f\u0438\u0441\u0430\u043d\u043d\u044b\u0439 \u0438\u043d\u0442\u0435\u0433\u0440\u0430\u043b";
    const geometricAreaLabel = "\u0413\u0435\u043e\u043c\u0435\u0442\u0440\u0438\u0447\u0435\u0441\u043a\u0430\u044f \u043f\u043b\u043e\u0449\u0430\u0434\u044c";
    const divergentValue = "\u0440\u0430\u0441\u0445\u043e\u0434\u0438\u0442\u0441\u044f";
    const normalizedTool = normalizeTool({
        mode: "between",
        exprA: "missing",
        exprB: "missing",
        a: Number.NEGATIVE_INFINITY,
        b: Number.POSITIVE_INFINITY,
        n: 0,
        sample: "weird",
    }, validExpressions);
    const oneFunctionBetween = normalizeTool({ mode: "between", exprA: "missing", exprB: "missing", a: 2, b: -2, n: 1, sample: "left" }, [validExpressions[0]]);
    const duplicateBetween = normalizeTool({ mode: "between", exprA: "f", exprB: "f", a: 0, b: 1, n: 8, sample: "mid" }, validExpressions);
    const betweenOverlay = buildOverlay({ mode: "between", exprA: "f", exprB: null, a: 0, b: 1, n: 5, sample: "mid" }, [validExpressions[0]], new Map([["f", validExpressions[0]]]));
    const invalidUnderOverlay = buildOverlay({ mode: "under", exprA: "missing", a: 0, b: 1, n: 5, sample: "mid" }, validExpressions, validMap);
    const emptyOverlay = buildOverlay({ mode: "under", exprA: null, a: 0, b: 1, n: 5, sample: "mid" }, [], new Map());
    const riemannOverlay = buildOverlay({ mode: "riemann", exprA: "f", a: 0, b: 1, n: 1, sample: "left" }, validExpressions, validMap);
    const trapOverlay = buildOverlay({ mode: "trap", exprA: "f", a: 0, b: 1, n: 1, sample: "mid" }, validExpressions, validMap);
    const volumeOverlay = buildOverlay({ mode: "volume", exprA: "f", a: Number.NEGATIVE_INFINITY, b: 4000, n: 5, sample: "mid" }, validExpressions, validMap);
    const averageOverlay = buildOverlay({ mode: "averageValue", exprA: "f", a: 0, b: 2, n: 5, sample: "mid" }, validExpressions, validMap);
    const newtonOverlay = buildOverlay({ mode: "newtonLeibniz", exprA: "f", a: 0, b: 2, n: 5, sample: "mid" }, validExpressions, validMap);
    const clampedView = clampView({ xMin: -5000, xMax: 5000, yMin: -3, yMax: 3 });
    const shiftedView = clampView({ xMin: 995, xMax: 1005, yMin: -1, yMax: 1 });
    const logarithmUnderOverlay = logarithmExpression !== null
        ? buildOverlay({ mode: "under", exprA: "ln-test", a: 0, b: 3, n: 5, sample: "mid" }, [logarithmExpression], new Map([["ln-test", logarithmExpression]]))
        : null;
    const reciprocalUnderOverlay = reciprocalExpression !== null
        ? buildOverlay({ mode: "under", exprA: "reciprocal-test", a: 0, b: 3, n: 5, sample: "mid" }, [reciprocalExpression], new Map([["reciprocal-test", reciprocalExpression]]))
        : null;
    const reciprocalSymmetricUnderOverlay = reciprocalExpression !== null
        ? buildOverlay({ mode: "under", exprA: "reciprocal-test", a: -3, b: 3, n: 5, sample: "mid" }, [reciprocalExpression], new Map([["reciprocal-test", reciprocalExpression]]))
        : null;
    const reciprocalSquaredUnderOverlay = reciprocalSquaredExpression !== null
        ? buildOverlay({ mode: "under", exprA: "reciprocal-squared-test", a: 0, b: 3, n: 5, sample: "mid" }, [reciprocalSquaredExpression], new Map([["reciprocal-squared-test", reciprocalSquaredExpression]]))
        : null;
    const reciprocalSquaredSymmetricUnderOverlay = reciprocalSquaredExpression !== null
        ? buildOverlay({ mode: "under", exprA: "reciprocal-squared-test", a: -3, b: 3, n: 5, sample: "mid" }, [reciprocalSquaredExpression], new Map([["reciprocal-squared-test", reciprocalSquaredExpression]]))
        : null;
    const allPracticeItems = LEARNING_MODULES.flatMap((module) => module.sections.flatMap((section) => (section.type === "practice" ? section.items : [])));
    const everyPracticeHasPreset = LEARNING_MODULES.every((module) => {
        const presetIds = new Set(module.presets.map((preset) => preset.id));
        return module.sections.every((section) => section.type !== "practice" || section.items.every((item) => presetIds.has(item.presetId)));
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
        pass(`inline math tokenizer keeps \\sqrt block intact`, inlineSqrtTokens.length === 3 &&
            inlineSqrtTokens[1]?.type === "tex" &&
            inlineSqrtTokens[1]?.value === "y=\\sqrt{x}"),
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
        pass(`pretty renderer builds (x+1)/(x-1) as grouped fraction`, prettyGroupedFraction === "frac(group(seq(x + 1))|group(seq(x − 1)))"),
        pass(`pretty renderer displays pi as π`, prettyPi === "\u03c0"),
        pass(`pretty renderer builds sqrt(x) as root`, prettySqrt === "sqrt(x)"),
        pass(`pretty renderer builds abs(x) as modulus`, prettyAbs === "abs(x)"),
        pass(`pretty renderer builds sin(x) as a function node`, prettySin === "fn(sin|x)"),
        pass(`pretty renderer builds ln(x) as a function node`, prettyLn === "fn(ln|x)"),
        pass(`pretty renderer keeps x^ as an incomplete power`, prettyDanglingPower === "pow(x|□)"),
        pass(`pretty renderer keeps 1/ as an incomplete fraction`, prettyDanglingFraction === "frac(1|□)"),
        pass(`pretty renderer keeps sqrt( as an incomplete root`, prettyDanglingSqrt === "sqrt(□)"),
        pass(`pretty renderer keeps sin( as an incomplete function call`, prettyDanglingSin === "fn(sin|□)"),
        pass(`pretty renderer keeps x^( as an open grouped exponent`, prettyDanglingPowerGroup === "pow(x|group-open(□))"),
        pass(`pretty renderer keeps x^(n+ as an open grouped exponent sum`, prettyDanglingPowerGroupSum === "pow(x|group-open(seq(n + □)))"),
        pass(`formatExpressionInputText renders sqrt inline`, formatExpressionInputText("sqrt(x)") === "\u221a(x)"),
        pass(`formatExpressionInputText renders pi inline`, formatExpressionInputText("pi / 2") === "\u03c0 / 2"),
        pass(`formatExpressionInputText renders dangling exponent slot as blank`, formatExpressionInputText("x^") === "x\u200a"),
        pass(`formatExpressionInputText renders simple fraction inline`, formatExpressionInputText("1/x") === "\u00b9\u2044\u2093"),
        pass(`parseExpressionInputText restores sqrt`, parseExpressionInputText("\u221a(x)") === "sqrt(x)"),
        pass(`parseExpressionInputText restores superscripts`, parseExpressionInputText("x\u00b2") === "x^2"),
        pass(`parseExpressionInputText restores exponent placeholder`, parseExpressionInputText("x\u200a") === "x^"),
        pass(`parseExpressionInputText restores simple fraction`, parseExpressionInputText("\u00b9\u2044\u2093") === "1/x"),
        pass(`formatExpressionText renders sqrt(x) as root with brackets`, formatExpressionText("sqrt(x)") === "\u221a(x)"),
        pass(`formatExpressionText keeps pretty sqrt for "sqrt("`, formatExpressionText("sqrt(") === "\u221a("),
        pass(`formatExpressionText keeps pretty sqrt for "sqrt()"`, formatExpressionText("sqrt()") === "\u221a()"),
        pass(`formatExpressionText renders acos as inverse cosine`, formatExpressionText("acos(x)") === "cos\u207b\u00b9 x"),
        pass(`formatExpressionText renders acosh as inverse hyperbolic cosine`, formatExpressionText("acosh(x)") === "cosh\u207b\u00b9 x"),
        pass(`compileExpression("sin(x)") succeeds`, sinCompiled.ok),
        pass(`compileExpression("sin(") returns an error`, !sinBroken.ok),
        pass(`compileExpression("sqrt(") reports missing argument`, !sqrtOpen.ok && sqrtOpen.error.includes("Введите аргумент")),
        pass(`compileExpression("tanx") succeeds`, tanImplicitCompiled.ok),
        pass(`compileExpression("x=siny") succeeds as x=f(y)`, sidewaysCompiled.ok && sidewaysCompiled.orientation === "xOfY"),
        pass(`compileExpression("lny") suggests adding x=`, "error" in lnyCompiled && lnyCompiled.error.includes('x =')),
        pass(`evaluateCompiled handles x, pi and e`, constantsCompiled.ok
            ? Math.abs(evaluateCompiled(constantsCompiled.compiled, 1) - (Math.PI + Math.E + 1)) < 1e-6
            : false),
        pass(`compileExpression supports log(base, x)`, logCompiled.ok ? Math.abs(evaluateCompiled(logCompiled.compiled, 0) - 3) < 1e-6 : false),
        pass(`compileExpression supports sec and asinh`, advancedCompiled.ok ? Math.abs(evaluateCompiled(advancedCompiled.compiled, 0) - 1) < 1e-6 : false),
        pass(`evaluateCompiled(sin, pi/2) ~= 1`, sinCompiled.ok ? Math.abs(evaluateCompiled(sinCompiled.compiled, Math.PI / 2) - 1) < 1e-6 : false),
        pass(`normalizeTool repairs missing exprA/exprB`, normalizedTool.exprA === "f" && normalizedTool.exprB === "g"),
        pass(`normalizeTool accepts new modes`, normalizeTool({ mode: "newtonLeibniz" }, validExpressions).mode === "newtonLeibniz" &&
            normalizeTool({ mode: "averageValue" }, validExpressions).mode === "averageValue"),
        pass(`normalizeTool clamps a/b to [-1000, 1000]`, normalizedTool.a === -1000 && normalizedTool.b === 1000),
        pass(`normalizeTool enforces n >= 2`, normalizedTool.n === 2),
        pass(`normalizeTool keeps between mode stable with one function`, oneFunctionBetween.exprA === "f" && oneFunctionBetween.exprB === "f"),
        pass(`normalizeTool picks the second function when exprA === exprB`, duplicateBetween.exprB === "g"),
        pass(`clampView keeps x inside [-1000, 1000]`, clampedView.xMin >= -1000 && clampedView.xMax <= 1000),
        pass(`clampView shifts overflowing windows back inside bounds`, shiftedView.xMin >= -1000 && shiftedView.xMax <= 1000),
        pass(`buildOverlay does not crash with 0 functions`, emptyOverlay.metrics.length > 0),
        pass(`buildOverlay between survives with 1 function`, betweenOverlay.metrics.length > 0 && betweenOverlay.regions.length === 0),
        pass(`buildOverlay under repairs invalid exprA safely`, invalidUnderOverlay.metrics.length > 0 && invalidUnderOverlay.verticals.length === 2),
        pass(`under keeps ln(x) on [0,3] finite`, logarithmUnderOverlay !== null &&
            logarithmUnderOverlay.metrics.some((metric) => metric.label === "Подписанный интеграл" && metric.value !== "расходится" && metric.value !== "-")),
        pass(`under marks 1/x on [0,3] as divergent`, reciprocalUnderOverlay !== null &&
            reciprocalUnderOverlay.metrics.some((metric) => metric.label === "Подписанный интеграл" && metric.value === "расходится")),
        pass(`under marks geometric area for 1/x on [0,3] as divergent`, reciprocalUnderOverlay !== null &&
            reciprocalUnderOverlay.metrics.some((metric) => metric.label === "Геометрическая площадь" && metric.value === "расходится")),
        pass(`under keeps geometric area for ln(x) on [0,3] finite`, logarithmUnderOverlay !== null &&
            logarithmUnderOverlay.metrics.some((metric) => metric.label === geometricAreaLabel && metric.value !== divergentValue && metric.value !== "-")),
        pass(`under marks 1/x^2 on [0,3] as divergent`, reciprocalSquaredUnderOverlay !== null &&
            reciprocalSquaredUnderOverlay.metrics.some((metric) => metric.label === signedIntegralLabel && metric.value === divergentValue)),
        pass(`under marks 1/x^2 on [-3,3] as divergent`, reciprocalSquaredSymmetricUnderOverlay !== null &&
            reciprocalSquaredSymmetricUnderOverlay.metrics.some((metric) => metric.label === signedIntegralLabel && metric.value === divergentValue)),
        pass(`under marks geometric area for 1/x^2 on [-3,3] as divergent`, reciprocalSquaredSymmetricUnderOverlay !== null &&
            reciprocalSquaredSymmetricUnderOverlay.metrics.some((metric) => metric.label === geometricAreaLabel && metric.value === divergentValue)),
        pass(`under treats 1/x on [-3,3] as an ordinary divergent improper integral`, reciprocalSymmetricUnderOverlay !== null &&
            reciprocalSymmetricUnderOverlay.metrics.some((metric) => metric.label === signedIntegralLabel && metric.value === divergentValue)),
        pass(`riemann/trap normalize bad n to 2`, riemannOverlay.metrics.some((metric) => metric.label === "n" && metric.value === "2") &&
            trapOverlay.metrics.some((metric) => metric.label === "n" && metric.value === "2")),
        pass(`volume overlay clamps bad bounds and returns preview`, volumeOverlay.volumePreview !== null &&
            volumeOverlay.volumePreview.a >= -1000 &&
            volumeOverlay.volumePreview.b <= 1000),
        pass(`average value overlay computes mean and returns guide line`, averageOverlay.metrics.some((metric) => metric.label === "\u0421\u0440\u0435\u0434\u043d\u0435\u0435 \u0437\u043d\u0430\u0447\u0435\u043d\u0438\u0435" && metric.value === "1") &&
            averageOverlay.polylines.length > 0),
        pass(`average value overlay adds overlay shading for the average rectangle`, averageOverlay.regions.length >= 2),
        pass(`newton-leibniz overlay stays safe and returns formula steps`, newtonOverlay.metrics.length > 0 &&
            newtonOverlay.formulaSteps.length >= 2 &&
            newtonOverlay.explanation.length > 0),
        pass(`learning registry contains exactly 10 modules`, LEARNING_MODULES.length === 10),
        pass(`every module has title summary and content`, LEARNING_MODULES.every((module) => module.title && module.summary && module.sections.length > 0)),
        pass(`every module has preset or practice`, LEARNING_MODULES.every((module) => module.presets.length > 0 ||
            module.sections.some((section) => section.type === "practice" && section.items.length > 0))),
        pass(`every module contains basic medium and hard practice examples`, LEARNING_MODULES.every((module) => {
            const practiceSection = module.sections.find((section) => section.type === "practice");
            if (!practiceSection || practiceSection.type !== "practice" || practiceSection.items.length !== 3) {
                return false;
            }
            const levels = practiceSection.items.map((item) => item.level);
            return levels.includes("Базовый") && levels.includes("Средний") && levels.includes("Сложный");
        })),
        pass(`every practice item has a calculator preset id`, allPracticeItems.every((item) => Boolean(item.presetId))),
        pass(`every practice item resolves to a valid calculator preset`, everyPracticeHasPreset),
        pass(`learning presets use supported tool modes`, LEARNING_MODULES.every((module) => module.presets.every((preset) => ["none", "under", "between", "riemann", "trap", "volume", "newtonLeibniz", "averageValue"].includes(preset.tool.mode ?? "none")))),
    ];
}
