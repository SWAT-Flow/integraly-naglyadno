import { useEffect, useRef, useState, type PropsWithChildren, type ReactNode } from "react";
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
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  className?: string;
}

export function Button({
  active = false,
  onClick,
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
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
  preview?: ReactNode;
}

export function SelectField({ label, value, options, onChange, disabled = false, preview }: SelectFieldProps) {
  return (
    <label className="field">
      <span>{decodeEscapedUnicode(label)}</span>
      <select disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {decodeEscapedUnicode(option.label)}
          </option>
        ))}
      </select>
      {preview ? <div className="field-preview">{preview}</div> : null}
    </label>
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
