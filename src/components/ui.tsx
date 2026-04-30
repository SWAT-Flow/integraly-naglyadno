import { useEffect, useRef, useState, type MouseEventHandler, type PropsWithChildren, type ReactNode } from "react";
import { formatBoundInput, parseBoundInput } from "../math/bounds";
import type { OverlayMetric } from "../types";
import { decodeEscapedUnicode } from "../utils/decodeEscapedUnicode";
import { InlineContent } from "./InlineContent";

interface CardProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  footer?: ReactNode;
}

export function Card({ title, subtitle, footer, children }: CardProps) {
  return (
    <section className="card">
      <header className="card-header">
        <div>
          <h2>{decodeEscapedUnicode(title)}</h2>
          {subtitle ? (
            <p>
              <InlineContent text={subtitle} />
            </p>
          ) : null}
        </div>
      </header>
      <div className="card-body">{children}</div>
      {footer ? <footer className="card-footer">{footer}</footer> : null}
    </section>
  );
}

interface ButtonProps extends PropsWithChildren {
  active?: boolean;
  onClick?: () => void;
  onMouseDown?: MouseEventHandler<HTMLButtonElement>;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  className?: string;
}

export function Button({
  active = false,
  onClick,
  onMouseDown,
  type = "button",
  disabled = false,
  className = "",
  children,
}: ButtonProps) {
  const content = typeof children === "string" ? decodeEscapedUnicode(children) : children;

  return (
    <button
      className={`button ${active ? "button-active" : ""} ${className}`.trim()}
      disabled={disabled}
      onClick={onClick}
      onMouseDown={onMouseDown}
      type={type}
    >
      {content}
    </button>
  );
}

interface IconButtonProps extends PropsWithChildren {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}

export function IconButton({ label, onClick, disabled = false, children }: IconButtonProps) {
  const decodedLabel = decodeEscapedUnicode(label);
  const content = typeof children === "string" ? decodeEscapedUnicode(children) : children;

  return (
    <button
      aria-label={decodedLabel}
      className="icon-button"
      disabled={disabled}
      onClick={onClick}
      title={decodedLabel}
      type="button"
    >
      {content}
    </button>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  options: Array<{ label: string; value: string; render?: ReactNode; selectedRender?: ReactNode }>;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function SelectField({ label, value, options, onChange, disabled = false }: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0] ?? null;

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    globalThis.document?.addEventListener("pointerdown", handlePointerDown);
    globalThis.window?.addEventListener("keydown", handleEscape);

    return () => {
      globalThis.document?.removeEventListener("pointerdown", handlePointerDown);
      globalThis.window?.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="field select-field">
      <span>{decodeEscapedUnicode(label)}</span>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        className="select-trigger"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        title={selectedOption ? decodeEscapedUnicode(selectedOption.label) : undefined}
        type="button"
      >
        <span className="select-value">
          {selectedOption?.selectedRender ?? selectedOption?.render ?? decodeEscapedUnicode(selectedOption?.label ?? "")}
        </span>
        <span className={`select-caret ${open ? "select-caret-open" : ""}`} aria-hidden="true">
          ▾
        </span>
      </button>

      {open ? (
        <div className="select-menu" role="listbox">
          {options.map((option) => (
            <button
              key={option.value}
              aria-selected={option.value === value}
              className={`select-option ${option.value === value ? "select-option-active" : ""}`}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              title={decodeEscapedUnicode(option.label)}
              type="button"
            >
              {option.render ?? decodeEscapedUnicode(option.label)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
}

export function NumberField({ label, value, onChange, step = 0.1 }: NumberFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(() => (Number.isFinite(value) ? String(value) : ""));

  useEffect(() => {
    if (inputRef.current === globalThis.document?.activeElement) {
      return;
    }
    setDraft(Number.isFinite(value) ? String(value) : "");
  }, [value]);

  return (
    <label className="field">
      <span>{decodeEscapedUnicode(label)}</span>
      <input
        ref={inputRef}
        type="number"
        value={draft}
        step={step}
        onBlur={() => setDraft(Number.isFinite(value) ? String(value) : "")}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          const parsed = Number(next);
          onChange(next.trim() === "" || Number.isNaN(parsed) ? Number.NaN : parsed);
        }}
      />
    </label>
  );
}

interface BoundFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  resetKey?: string;
}

const DEFAULT_BOUND_SLIDER_MIN = -10;
const DEFAULT_BOUND_SLIDER_MAX = 10;
const DEFAULT_BOUND_SLIDER_STEP = 1;
const MIN_BOUND_SLIDER_STEP = 0.05;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatSliderNumber(value: number): string {
  return Number.isFinite(value) ? String(Number(value.toFixed(6))) : "";
}

function sanitizeSliderStep(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return MIN_BOUND_SLIDER_STEP;
  }

  return Math.max(value, MIN_BOUND_SLIDER_STEP);
}

function defaultRangeDraft() {
  return {
    min: formatSliderNumber(DEFAULT_BOUND_SLIDER_MIN),
    max: formatSliderNumber(DEFAULT_BOUND_SLIDER_MAX),
    step: formatSliderNumber(DEFAULT_BOUND_SLIDER_STEP),
  };
}

export function BoundField({ label, value, onChange, resetKey = "" }: BoundFieldProps) {
  const rootRef = useRef<HTMLLabelElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(() => formatBoundInput(value));
  const [sliderMin, setSliderMin] = useState(DEFAULT_BOUND_SLIDER_MIN);
  const [sliderMax, setSliderMax] = useState(DEFAULT_BOUND_SLIDER_MAX);
  const [sliderStep, setSliderStep] = useState(DEFAULT_BOUND_SLIDER_STEP);
  const [rangeDraft, setRangeDraft] = useState(defaultRangeDraft);
  const [showRangeSettings, setShowRangeSettings] = useState(false);
  const finiteValue = Number.isFinite(value);
  const safeStep = sanitizeSliderStep(sliderStep);
  const safeMax = sliderMax > sliderMin ? sliderMax : sliderMin + safeStep;
  const sliderValue = finiteValue ? clamp(value, sliderMin, safeMax) : sliderMin;
  const boundName = decodeEscapedUnicode(label);

  useEffect(() => {
    if (inputRef.current === globalThis.document?.activeElement) {
      return;
    }
    setDraft(formatBoundInput(value));
  }, [value]);

  useEffect(() => {
    setSliderMin(DEFAULT_BOUND_SLIDER_MIN);
    setSliderMax(DEFAULT_BOUND_SLIDER_MAX);
    setSliderStep(DEFAULT_BOUND_SLIDER_STEP);
    setRangeDraft(defaultRangeDraft());
    setShowRangeSettings(false);
  }, [resetKey]);

  useEffect(() => {
    if (!showRangeSettings) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) {
        return;
      }

      commitRangeDraft();
      setShowRangeSettings(false);
    }

    globalThis.document?.addEventListener("pointerdown", handlePointerDown);
    return () => {
      globalThis.document?.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [showRangeSettings, rangeDraft.min, rangeDraft.max, rangeDraft.step, sliderMin, sliderMax]);

  function commitRangeDraft() {
    const nextStep = sanitizeSliderStep(parseBoundInput(rangeDraft.step));
    const parsedMin = parseBoundInput(rangeDraft.min);
    const parsedMax = parseBoundInput(rangeDraft.max);
    const nextMin = Number.isFinite(parsedMin) ? parsedMin : sliderMin;
    const nextMaxBase = Number.isFinite(parsedMax) ? parsedMax : sliderMax;
    const nextMax = nextMaxBase > nextMin ? nextMaxBase : nextMin + nextStep;

    setSliderStep(nextStep);
    setSliderMin(nextMin);
    setSliderMax(nextMax);
    setRangeDraft({
      min: formatSliderNumber(nextMin),
      max: formatSliderNumber(nextMax),
      step: formatSliderNumber(nextStep),
    });
  }

  return (
    <label className="field" ref={rootRef}>
      <span>{boundName}</span>
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={draft}
        onBlur={() => setDraft(formatBoundInput(value))}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          onChange(parseBoundInput(next));
        }}
      />
      <div className="bound-slider">
        <div className="bound-slider-row">
          <button
            type="button"
            className="bound-slider-edge"
            onClick={(event) => {
              event.preventDefault();
              setShowRangeSettings((current) => !current);
            }}
          >
            {formatSliderNumber(sliderMin)}
          </button>
          <input
            aria-label={`${boundName}: ползунок`}
            disabled={!finiteValue}
            type="range"
            min={sliderMin}
            max={safeMax}
            step={safeStep}
            value={sliderValue}
            onChange={(event) => onChange(Number(event.target.value))}
          />
          <button
            type="button"
            className="bound-slider-edge"
            onClick={(event) => {
              event.preventDefault();
              setShowRangeSettings((current) => !current);
            }}
          >
            {formatSliderNumber(safeMax)}
          </button>
        </div>

        {showRangeSettings ? (
          <div className="bound-slider-settings">
            <input
              aria-label={`${boundName}: минимум ползунка`}
              value={rangeDraft.min}
              inputMode="decimal"
              onBlur={commitRangeDraft}
              onChange={(event) => setRangeDraft((current) => ({ ...current, min: event.target.value }))}
            />
            <span>≤ {boundName} ≤</span>
            <input
              aria-label={`${boundName}: максимум ползунка`}
              value={rangeDraft.max}
              inputMode="decimal"
              onBlur={commitRangeDraft}
              onChange={(event) => setRangeDraft((current) => ({ ...current, max: event.target.value }))}
            />
            <span>Шаг:</span>
            <input
              aria-label={`${boundName}: шаг ползунка`}
              value={rangeDraft.step}
              inputMode="decimal"
              onBlur={commitRangeDraft}
              onChange={(event) => setRangeDraft((current) => ({ ...current, step: event.target.value }))}
            />
          </div>
        ) : null}
      </div>
    </label>
  );
}

export function MetricGrid({ metrics }: { metrics: OverlayMetric[] }) {
  return (
    <div className="metric-grid">
      {metrics.map((metric) => (
        <div key={`${metric.label}-${metric.value}`} className={`metric-pill metric-${metric.tone ?? "slate"}`}>
          <span>{decodeEscapedUnicode(metric.label)}</span>
          <strong>{decodeEscapedUnicode(metric.value)}</strong>
        </div>
      ))}
    </div>
  );
}
