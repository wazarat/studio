"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { Field, inputClasses } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

/**
 * Native select in the site input styling with a chevron (canhav.dev's
 * Select, M74): keyboard and mobile behaviour come from the browser, the
 * look from inputClasses. `muted` while nothing is chosen so the
 * placeholder reads as one.
 */
export const selectClasses = cn(inputClasses, "cursor-pointer appearance-none pr-9");

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { muted?: boolean }
>(({ className, muted, ...props }, ref) => (
  <span className="relative block">
    <select ref={ref} className={cn(selectClasses, muted && "text-ink-500", className)} {...props} />
    <ChevronDown
      aria-hidden
      className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
    />
  </span>
));
Select.displayName = "Select";

/** Option styling for the native popup, which ignores most page CSS. */
export const optionClasses = "bg-ink-950 text-ink-50";

/** Label plus Select, one decision one control. */
export function SelectField<V extends string>({
  label,
  required,
  hint,
  value,
  onChange,
  options,
  placeholder = "Choose…",
  clearable = false,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  value: V | "";
  onChange: (value: V | "") => void;
  options: ReadonlyArray<{ value: V; label: string }>;
  placeholder?: string;
  /** Optional answers can go back to unset, so the blank choice stays selectable. */
  clearable?: boolean;
}) {
  return (
    <Field label={label} required={required} hint={hint}>
      <Select value={value} muted={!value} onChange={(e) => onChange(e.target.value as V | "")}>
        <option value="" disabled={!clearable}>
          {placeholder}
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className={optionClasses}>
            {opt.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}
