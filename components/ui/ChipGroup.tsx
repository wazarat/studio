"use client";

import { cn } from "@/lib/utils";

/**
 * Quiet chip radio: no border until a chip is picked, then the electric
 * hairline. The label is a <p>, not a <label> around the buttons, which
 * would forward clicks to the first chip.
 */
export interface ChipOption<V extends string> {
  value: V;
  label: string;
}

const CHIP_BASE =
  "inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-medium transition-colors";
const CHIP_ON = "border-electric-500 bg-electric-500/10 text-electric-300";
const CHIP_OFF = "border-transparent bg-ink-800/60 text-ink-300 hover:bg-ink-800 hover:text-ink-50";

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
  onChange: (value: V | "") => void;
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
              onClick={() => onChange(selected ? "" : opt.value)}
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
