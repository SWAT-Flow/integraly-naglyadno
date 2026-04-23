import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_VIEW, PALETTE } from "./constants";
import { ExpressionList } from "./components/ExpressionList";
import { LearningHub } from "./components/LearningHub";
import { TemplateKeyboard, type TemplateInsert } from "./components/TemplateKeyboard";
import { ToolPanel } from "./components/ToolPanel";
import { Button } from "./components/ui";
import { runSelfTests } from "./dev/selfTests";
import { estimateDefaultView } from "./graph/estimateDefaultView";
import { GraphCanvas } from "./graph/GraphCanvas";
import { LEARNING_MODULES } from "./learning/modules";
import type { LearningPreset } from "./learning/types";
import { clampView } from "./math/numeric";
import { compileExpression, evaluateCompiled } from "./math/parser";
import { buildOverlay } from "./tools/buildOverlay";
import { normalizeTool } from "./tools/normalizeTool";
import type { CompiledExpression, ExpressionDraft, ExpressionViewModel, ToolState, ViewBox } from "./types";

const createId = () => Math.random().toString(36).slice(2, 10);

function nextColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}

function createExpression(seed = "", index = 0): ExpressionDraft {
  return {
    id: createId(),
    text: seed,
    visible: true,
    color: nextColor(index),
  };
}

function startsWithMathAtom(value: string): boolean {
  return /^[a-z0-9(]/i.test(value);
}

function needsImplicitProductBeforeTemplate(source: string, insertAt: number, templateText: string): boolean {
  if (insertAt <= 0 || !startsWithMathAtom(templateText)) {
    return false;
  }

  const previous = source[insertAt - 1] ?? "";
  return /[a-z0-9)]/i.test(previous);
}

function buildExpressionModels(expressions: ExpressionDraft[]): {
  rows: ExpressionViewModel[];
  compiled: CompiledExpression[];
} {
  const rows: ExpressionViewModel[] = [];
  const compiled: CompiledExpression[] = [];

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
        evaluate: (value: number) => evaluateCompiled(result.compiled, value, result.orientation),
      });
    } else {
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

function patchNeedsNormalization(source: ToolState, next: ToolState): boolean {
  return (
    source.mode !== next.mode ||
    source.exprA !== next.exprA ||
    source.exprB !== next.exprB ||
    source.a !== next.a ||
    source.b !== next.b ||
    source.n !== next.n ||
    source.sample !== next.sample
  );
}

export default function App() {
  const [appMode, setAppMode] = useState<"calculator" | "modules">("calculator");
  const [activeModuleId, setActiveModuleId] = useState<string>(LEARNING_MODULES[0]?.id ?? "");
  const [expressions, setExpressions] = useState<ExpressionDraft[]>([
    createExpression("sin(x)", 0),
    createExpression("x^2 / 6", 1),
  ]);
  const [activeId, setActiveId] = useState<string | null>(expressions[0]?.id ?? null);
  const [editorRequest, setEditorRequest] = useState(0);
  const [tool, setTool] = useState<ToolState>({
    mode: "under",
    exprA: expressions[0]?.id ?? null,
    exprB: expressions[1]?.id ?? null,
    a: -3,
    b: 3,
    n: 8,
    sample: "mid",
  });
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const pendingInsertRef = useRef<{ targetId: string; template: TemplateInsert } | null>(null);
  const [viewOverride, setViewOverride] = useState<ViewBox | null>(null);
  const [graphResetToken, setGraphResetToken] = useState(0);

  const expressionState = useMemo(() => buildExpressionModels(expressions), [expressions]);
  const deferredCompiled = useDeferredValue(expressionState.compiled);
  const validExpressions = useMemo(
    () => deferredCompiled.filter((expression) => expression.raw.trim().length > 0),
    [deferredCompiled],
  );
  const calculableExpressions = useMemo(
    () => validExpressions.filter((expression) => expression.orientation === "yOfX"),
    [validExpressions],
  );
  const visibleExpressions = useMemo(
    () => validExpressions.filter((expression) => expression.visible),
    [validExpressions],
  );
  const validMap = useMemo(
    () => new Map(calculableExpressions.map((expression) => [expression.id, expression])),
    [calculableExpressions],
  );
  const normalizedTool = useMemo(() => normalizeTool(tool, calculableExpressions), [tool, calculableExpressions]);
  const overlay = useMemo(
    () => buildOverlay(normalizedTool, calculableExpressions, validMap),
    [normalizedTool, calculableExpressions, validMap],
  );
  const defaultView = useMemo(
    () => estimateDefaultView(visibleExpressions.length ? visibleExpressions : validExpressions, normalizedTool),
    [normalizedTool, validExpressions, visibleExpressions],
  );
  const graphDefaultView = viewOverride ?? defaultView ?? DEFAULT_VIEW;
  const selfTests = useMemo(() => runSelfTests(), []);

  const clearViewOverride = () => {
    setViewOverride(null);
  };

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

    console.table(
      selfTests.map((test) => ({
        status: test.passed ? "PASS" : "FAIL",
        name: test.name,
      })),
    );
  }, [selfTests]);

  const applyTemplateInsertion = (targetId: string, template: TemplateInsert) => {
    const input = inputRefs.current[targetId];
    if (!input) {
      return false;
    }

    clearViewOverride();

    input.focus();
    const source = input.value;
    const start = input.selectionStart ?? source.length;
    const end = input.selectionEnd ?? source.length;
    const selected = source.slice(start, end);

    let nextText = template.text;
    let cursorOffset = template.cursorOffset;

    if (template.wrapSelection && selected && template.text.endsWith("()")) {
      nextText = `${template.text.slice(0, -1)}${selected})`;
      cursorOffset = 0;
    }

    const prefix = needsImplicitProductBeforeTemplate(source, start, nextText) ? "*" : "";
    const updated = `${source.slice(0, start)}${prefix}${nextText}${source.slice(end)}`;
    const nextCursor = start + prefix.length + nextText.length + cursorOffset;

    setExpressions((current) =>
      current.map((expression) =>
        expression.id === targetId ? { ...expression, text: updated } : expression,
      ),
    );

    requestAnimationFrame(() => {
      const nextInput = inputRefs.current[targetId];
      nextInput?.focus();
      nextInput?.setSelectionRange(nextCursor, nextCursor);
      nextInput?.dispatchEvent(new Event("select", { bubbles: true }));
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

  const insertTemplate = (template: TemplateInsert) => {
    const targetId = ensureActiveInput();
    if (!targetId) {
      return;
    }

    if (applyTemplateInsertion(targetId, template)) {
      return;
    }

    pendingInsertRef.current = { targetId, template };
  };

  const applyLearningPreset = (preset: LearningPreset) => {
    startTransition(() => {
      const nextExpressions = preset.expressions.map((expression, index) => ({
        id: createId(),
        text: expression.text,
        visible: expression.visible ?? true,
        color: expression.color ?? nextColor(index),
      }));
      const primaryId = nextExpressions[0]?.id ?? null;
      const secondaryId = nextExpressions[1]?.id ?? primaryId;

      pendingInsertRef.current = null;
      inputRefs.current = {};
      setEditorRequest(0);
      setExpressions(nextExpressions);
      setActiveId(primaryId);
      setTool({
        mode: preset.tool.mode ?? "none",
        exprA: primaryId,
        exprB: secondaryId,
        a: preset.tool.a ?? -2,
        b: preset.tool.b ?? 2,
        n: preset.tool.n ?? 8,
        sample: preset.tool.sample ?? "mid",
      });
      setViewOverride(preset.view ? clampView(preset.view) : null);
      setGraphResetToken((current) => current + 1);
      setAppMode("calculator");
    });
  };

  return (
    <div className={`app-shell app-shell-${appMode}`}>
      <div className="app-mode-bar">
        <Button active={appMode === "calculator"} onClick={() => setAppMode("calculator")}>
          Калькулятор
        </Button>
        <Button active={appMode === "modules"} onClick={() => setAppMode("modules")}>
          Учебные модули
        </Button>
      </div>

      {appMode === "calculator" ? (
        <main className="app-grid">
          <aside className="left-column">
            <ExpressionList
              activeId={activeId}
              availableColors={PALETTE}
              editorRequest={editorRequest}
              expressions={expressionState.rows}
              inputRefs={inputRefs}
              onActivate={(id) => {
                setActiveId(id);
                setEditorRequest((current) => current + 1);
              }}
              onAdd={() => {
                startTransition(() => {
                  clearViewOverride();
                  const created = createExpression("", expressions.length);
                  setExpressions((current) => [...current, created]);
                  setActiveId(created.id);
                  setEditorRequest((current) => current + 1);
                });
              }}
              onChange={(id, value) => {
                clearViewOverride();
                setExpressions((current) =>
                  current.map((expression) => (expression.id === id ? { ...expression, text: value } : expression)),
                );
              }}
              onChangeColor={(id, color) => {
                clearViewOverride();
                setExpressions((current) =>
                  current.map((expression) => (expression.id === id ? { ...expression, color } : expression)),
                );
              }}
              onDelete={(id) => {
                startTransition(() => {
                  clearViewOverride();
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
              }}
              onToggleVisible={(id) => {
                clearViewOverride();
                setExpressions((current) =>
                  current.map((expression) =>
                    expression.id === id ? { ...expression, visible: !expression.visible } : expression,
                  ),
                );
              }}
            />
            <TemplateKeyboard onInsert={insertTemplate} />
          </aside>

          <section className="center-column">
            <GraphCanvas
              defaultView={graphDefaultView}
              expressions={visibleExpressions}
              overlay={overlay}
              viewResetToken={graphResetToken}
            />
          </section>

          <aside className="right-column">
            <ToolPanel
              onChange={(patch) => {
                clearViewOverride();
                setTool((current) => ({ ...current, ...patch }));
              }}
              overlay={overlay}
              tool={normalizedTool}
              validExpressions={calculableExpressions}
            />
          </aside>
        </main>
      ) : (
        <LearningHub
          activeModuleId={activeModuleId}
          onOpenPreset={applyLearningPreset}
          onSelectModule={setActiveModuleId}
        />
      )}
    </div>
  );
}
