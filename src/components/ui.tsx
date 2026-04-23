import { useEffect, useRef, useState, type MouseEventHandler, type PropsWithChildren, type ReactNode } from "react";
import { formatBoundInput, parseBoundInput } from "../math/bounds";
import type { OverlayMetric } from "../types";
import { decodeEscapedUnicode } from "../utils/decodeEscapedUnicode";

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
          {subtitle ? <p>{decodeEscapedUnicode(subtitle)}</p> : null}
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
}

export function BoundField({ label, value, onChange }: BoundFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(() => formatBoundInput(value));

  useEffect(() => {
    if (inputRef.current === globalThis.document?.activeElement) {
      return;
    }
    setDraft(formatBoundInput(value));
  }, [value]);

  return (
    <label className="field">
      <span>{decodeEscapedUnicode(label)}</span>
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
