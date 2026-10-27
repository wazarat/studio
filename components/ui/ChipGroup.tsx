"use client";

import { cn } from "@/lib/utils";

/**
 * Flat chip radio (from canhav.dev's ChipGroup, M74): rounded-md, a
 * hairline when off, an electric border when on. The label is a <p>, not a
 * <label> around the buttons, which would forward clicks to the first chip.
 */
export interface ChipOption<V extends string> {
  value: V;
  label: string;
}

const CHIP_BASE =
  "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors";
const CHIP_ON = "border-electric-500 bg-electric-500/10 text-electric-300";
const CHIP_OFF = "border-ink-700/60 bg-ink-900 text-ink-200 hover:border-ink-500 hover:text-ink-50";

export function ChipRadioGroup<V extends string>({
  label,
  hint,
  value,
  onChange,
  options,
}: {
  label: string;
  hint?: string;
  value: V | "";
  onChange: (value: V) => void;
  options: ReadonlyArray<ChipOption<V>>;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-ink-200">{label}</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(opt.value)}
              className={cn(CHIP_BASE, selected ? CHIP_ON : CHIP_OFF)}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {hint ? <p className="text-xs text-ink-500">{hint}</p> : null}
    </div>
  );
}
