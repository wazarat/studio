"use client";

import * as React from "react";
import Link from "next/link";

import { Field } from "@/components/ui/Input";
import { InfoTip } from "@/components/ui/InfoTip";
import { cn } from "@/lib/utils";

/**
 * Segmented control (M74): two to four exclusive options on a flat track,
 * the active segment a raised surface. Replaces pill radios, hand rolled
 * step pills and tablists. Options with `href` render as links (the choice
 * lives in the URL, the page stays a server component); otherwise buttons.
 * Arrow keys move the choice within a radiogroup.
 */
export interface SegmentedOption<V extends string> {
  value: V;
  label: React.ReactNode;
  disabled?: boolean;
  href?: string;
  /** Title attribute, for a disabled reason or a longer label. */
  title?: string;
}

const TRACK = "inline-flex max-w-full gap-0.5 rounded-lg border border-ink-700/60 bg-ink-950/50 p-0.5 light:bg-ink-800/50";
const ITEM =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-500/60 disabled:cursor-not-allowed disabled:opacity-50";
const ITEM_ON = "border-ink-700/60 bg-ink-900 text-ink-50 shadow-sm";
const ITEM_OFF = "text-ink-400 hover:text-ink-200";
const SIZES = { sm: "px-2.5 py-1 text-xs", md: "px-3.5 py-1.5 text-sm" } as const;

export function Segmented<V extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  role = "radiogroup",
  size = "md",
  fill = false,
  className,
}: {
  value: V | "";
  onChange?: (value: V) => void;
  options: ReadonlyArray<SegmentedOption<V>>;
  ariaLabel?: string;
  /** "tablist" when the segments switch views rather than record a choice. */
  role?: "radiogroup" | "tablist";
  size?: keyof typeof SIZES;
  /** Stretch the segments to fill the track. */
  fill?: boolean;
  className?: string;
}) {
  const itemRole = role === "tablist" ? "tab" : "radio";
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!onChange || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
    const enabled = options.filter((o) => !o.disabled && !o.href);
    const i = enabled.findIndex((o) => o.value === value);
    if (enabled.length === 0) return;
    const next = e.key === "ArrowRight" ? (i + 1) % enabled.length : (i - 1 + enabled.length) % enabled.length;
    e.preventDefault();
    onChange(enabled[next].value);
  };
  return (
    <div role={role} aria-label={ariaLabel} className={cn(TRACK, fill && "flex w-full", className)} onKeyDown={onKeyDown}>
      {options.map((opt) => {
        const on = opt.value === value;
        const classes = cn(ITEM, SIZES[size], on ? ITEM_ON : ITEM_OFF, fill && "flex-1");
        if (opt.href) {
          return (
            <Link
              key={opt.value}
              href={opt.href}
              aria-current={on ? "page" : undefined}
              scroll={false}
              title={opt.title}
              className={classes}
            >
              {opt.label}
            </Link>
          );
        }
        return (
          <button
            key={opt.value}
            type="button"
            role={itemRole}
            aria-checked={itemRole === "radio" ? on : undefined}
            aria-selected={itemRole === "tab" ? on : undefined}
            tabIndex={on || value === "" ? 0 : -1}
            disabled={opt.disabled}
            title={opt.title}
            onClick={() => onChange?.(opt.value)}
            className={classes}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** Segmented inside a Field, the form flavour (chain, project mode). */
export function SegmentedField<V extends string>({
  label,
  required,
  hint,
  info,
  value,
  onChange,
  options,
  fill,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  info?: React.ReactNode;
  value: V | "";
  onChange: (value: V) => void;
  options: ReadonlyArray<SegmentedOption<V>>;
  fill?: boolean;
}) {
  // Not a <label>: a label around several buttons forwards clicks to the first.
  return (
    <div className="space-y-1.5">
      <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-200">
        <span>
          {label} {required ? <span className="text-rose-400">*</span> : null}
        </span>
        {info ? <InfoTip>{info}</InfoTip> : null}
      </span>
      <Segmented value={value} onChange={onChange} options={options} ariaLabel={label} fill={fill} />
      {hint ? <span className="block text-xs text-ink-500">{hint}</span> : null}
    </div>
  );
}

// Field is re-exported so call sites that only need the label shell import one module.
export { Field };
