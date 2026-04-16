import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_VIEW, PALETTE } from "./constants.js";
import { ExpressionList } from "./components/ExpressionList.js";
import { TemplateKeyboard } from "./components/TemplateKeyboard.js";
import { ToolPanel } from "./components/ToolPanel.js";
import { runSelfTests } from "./dev/selfTests.js";
import { estimateDefaultView } from "./graph/estimateDefaultView.js";
import { GraphCanvas } from "./graph/GraphCanvas.js";
import { compileExpression, evaluateCompiled } from "./math/parser.js";
import { buildOverlay } from "./tools/buildOverlay.js";
import { normalizeTool } from "./tools/normalizeTool.js";
const createId = () => Math.random().toString(36).slice(2, 10);
function nextColor(index) {
    return PALETTE[index % PALETTE.length];
}
function createExpression(seed = "", index = 0) {
    return {
        id: createId(),
        text: seed,
        visible: true,
        color: nextColor(index),
    };
}
function buildExpressionModels(expressions) {
    const rows = [];
    const compiled = [];
    for (const expression of expressions) {
        const result = compileExpression(expression.text);
        if (result.ok) {
            rows.push({
                ...expression,
                normalized: result.normalized,
                orientation: result.orientation,
                error: null,
                isValid: true,
            });
            compiled.push({
                id: expression.id,
                raw: expression.text,
                normalized: result.normalized,
                visible: expression.visible,
                color: expression.color,
                orientation: result.orientation,
                evaluate: (value) => evaluateCompiled(result.compiled, value, result.orientation),
            });
        }
        else {
            rows.push({
                ...expression,
                normalized: result.normalized,
                orientation: result.orientation,
                error: expression.text.trim() ? result.error : null,
                isValid: false,
            });
        }
    }
    return { rows, compiled };
}
function patchNeedsNormalization(source, next) {
    return (source.mode !== next.mode ||
        source.exprA !== next.exprA ||
        source.exprB !== next.exprB ||
        source.a !== next.a ||
        source.b !== next.b ||
        source.n !== next.n ||
        source.sample !== next.sample);
}
export default function App() {
    const [expressions, setExpressions] = useState([
        createExpression("sin(x)", 0),
        createExpression("x^2 / 6", 1),
    ]);
    const [activeId, setActiveId] = useState(expressions[0]?.id ?? null);
    const [editorRequest, setEditorRequest] = useState(0);
    const [tool, setTool] = useState({
        mode: "under",
        exprA: expressions[0]?.id ?? null,
        exprB: expressions[1]?.id ?? null,
        a: -3,
        b: 3,
        n: 8,
        sample: "mid",
    });
    const inputRefs = useRef({});
    const pendingInsertRef = useRef(null);
    const expressionState = useMemo(() => buildExpressionModels(expressions), [expressions]);
    const deferredCompiled = useDeferredValue(expressionState.compiled);
    const validExpressions = useMemo(() => deferredCompiled.filter((expression) => expression.raw.trim().length > 0), [deferredCompiled]);
    const calculableExpressions = useMemo(() => validExpressions.filter((expression) => expression.orientation === "yOfX"), [validExpressions]);
    const visibleExpressions = useMemo(() => validExpressions.filter((expression) => expression.visible), [validExpressions]);
    const validMap = useMemo(() => new Map(calculableExpressions.map((expression) => [expression.id, expression])), [calculableExpressions]);
    const normalizedTool = useMemo(() => normalizeTool(tool, calculableExpressions), [tool, calculableExpressions]);
    const overlay = useMemo(() => buildOverlay(normalizedTool, calculableExpressions, validMap), [normalizedTool, calculableExpressions, validMap]);
    const defaultView = useMemo(() => estimateDefaultView(visibleExpressions.length ? visibleExpressions : validExpressions, normalizedTool), [normalizedTool, validExpressions, visibleExpressions]);
    const selfTests = useMemo(() => runSelfTests(), []);
    useEffect(() => {
        if (!patchNeedsNormalization(tool, normalizedTool)) {
            return;
        }
        setTool(normalizedTool);
    }, [normalizedTool, tool]);
    useEffect(() => {
        if (activeId && expressions.some((expression) => expression.id === activeId)) {
            return;
        }
        setActiveId(expressions[0]?.id ?? null);
    }, [activeId, expressions]);
    useEffect(() => {
        if (!import.meta.env.DEV) {
            return;
        }
        console.table(selfTests.map((test) => ({
            status: test.passed ? "PASS" : "FAIL",
            name: test.name,
        })));
    }, [selfTests]);
    const applyTemplateInsertion = (targetId, template) => {
        const input = inputRefs.current[targetId];
        if (!input) {
            return false;
        }
        input.focus();
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? input.value.length;
        const selected = input.value.slice(start, end);
        let nextText = template.text;
        let cursorOffset = template.cursorOffset;
        if (template.wrapSelection && selected && template.text.endsWith("()")) {
            nextText = `${template.text.slice(0, -1)}${selected})`;
            cursorOffset = 0;
        }
        const updated = `${input.value.slice(0, start)}${nextText}${input.value.slice(end)}`;
        const nextCursor = start + nextText.length + cursorOffset;
        setExpressions((current) => current.map((expression) => expression.id === targetId ? { ...expression, text: updated } : expression));
        requestAnimationFrame(() => {
            const nextInput = inputRefs.current[targetId];
            nextInput?.focus();
            nextInput?.setSelectionRange(nextCursor, nextCursor);
        });
        return true;
    };
    useEffect(() => {
        const pending = pendingInsertRef.current;
        if (!pending) {
            return;
        }
        if (applyTemplateInsertion(pending.targetId, pending.template)) {
            pendingInsertRef.current = null;
        }
    }, [activeId, editorRequest, expressions]);
    useEffect(() => {
        if (!activeId) {
            return;
        }
        requestAnimationFrame(() => {
            inputRefs.current[activeId]?.focus();
        });
    }, [activeId, editorRequest]);
    const ensureActiveInput = () => {
        if (activeId && expressions.some((expression) => expression.id === activeId)) {
            setEditorRequest((current) => current + 1);
            return activeId;
        }
        const fallbackId = expressions[0]?.id ?? null;
        if (fallbackId) {
            setActiveId(fallbackId);
            setEditorRequest((current) => current + 1);
            return fallbackId;
        }
        const created = createExpression("", expressions.length);
        setExpressions((current) => [...current, created]);
        setActiveId(created.id);
        setEditorRequest((current) => current + 1);
        return created.id;
    };
    const insertTemplate = (template) => {
        const targetId = ensureActiveInput();
        if (!targetId) {
            return;
        }
        if (applyTemplateInsertion(targetId, template)) {
            return;
        }
        pendingInsertRef.current = { targetId, template };
    };
    return (_jsx("div", { className: "app-shell", children: _jsxs("main", { className: "app-grid", children: [_jsxs("aside", { className: "left-column", children: [_jsx(ExpressionList, { activeId: activeId, editorRequest: editorRequest, expressions: expressionState.rows, inputRefs: inputRefs, onActivate: (id) => {
                                setActiveId(id);
                                setEditorRequest((current) => current + 1);
                            }, onAdd: () => {
                                startTransition(() => {
                                    const created = createExpression("", expressions.length);
                                    setExpressions((current) => [...current, created]);
                                    setActiveId(created.id);
                                    setEditorRequest((current) => current + 1);
                                });
                            }, onChange: (id, value) => {
                                setExpressions((current) => current.map((expression) => (expression.id === id ? { ...expression, text: value } : expression)));
                            }, onDelete: (id) => {
                                startTransition(() => {
                                    setExpressions((current) => {
                                        const next = current.filter((expression) => expression.id !== id);
                                        if (activeId === id) {
                                            setActiveId(next[0]?.id ?? null);
                                        }
                                        return next;
                                    });
                                    if (pendingInsertRef.current?.targetId === id) {
                                        pendingInsertRef.current = null;
                                    }
                                    delete inputRefs.current[id];
                                });
                            }, onToggleVisible: (id) => {
                                setExpressions((current) => current.map((expression) => expression.id === id ? { ...expression, visible: !expression.visible } : expression));
                            } }), _jsx(TemplateKeyboard, { onInsert: insertTemplate })] }), _jsx("section", { className: "center-column", children: _jsx(GraphCanvas, { defaultView: defaultView ?? DEFAULT_VIEW, expressions: visibleExpressions, overlay: overlay }) }), _jsx("aside", { className: "right-column", children: _jsx(ToolPanel, { onChange: (patch) => setTool((current) => ({ ...current, ...patch })), overlay: overlay, tool: normalizedTool, validExpressions: calculableExpressions }) })] }) }));
}

