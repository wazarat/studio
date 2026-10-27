import * as React from "react";

import { InfoTip } from "@/components/ui/InfoTip";
import { cn } from "@/lib/utils";

/**
 * Shared text-input styling used by every form on the site (flat since M74):
 * a hairline border, a surface one step below the card in dark and white in
 * light, rounded-lg like the buttons.
 */
export const inputClasses =
  "w-full rounded-lg border border-ink-700/60 bg-ink-950/50 px-3.5 py-2.5 text-sm text-ink-50 light:bg-ink-900 " +
  "placeholder:text-ink-500 focus:border-electric-500 focus:outline-none focus:ring-1 focus:ring-electric-500/40";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(inputClasses, className)} {...props} />
));
Input.displayName = "Input";

/**
 * A textarea that grows with its text (M136): `rows` is the minimum, the
 * box follows the content up to sixty percent of the viewport and scrolls
 * past that. Browsers with field-sizing do it in CSS; the others get the
 * same from a layout effect on the value.
 */
export const TextArea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, value, ...props }, ref) => {
  const inner = React.useRef<HTMLTextAreaElement | null>(null);
  const setRef = (el: HTMLTextAreaElement | null) => {
    inner.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
  };
  React.useLayoutEffect(() => {
    const el = inner.current;
    if (!el || "fieldSizing" in el.style) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return <textarea ref={setRef} value={value} className={cn(inputClasses, "max-h-[60vh] resize-none overflow-y-auto [field-sizing:content]", className)} {...props} />;
});
TextArea.displayName = "TextArea";

/**
 * Label + control + hint/error/counter wrapper. Mirrors the field markup of
 * the contact modal so forms stay visually consistent. `hint` is the one
 * short line that stays visible; anything longer goes in `info`, which
 * renders as an InfoTip beside the label (M76).
 */
export function Field({
  label,
  required,
  error,
  hint,
  info,
  infoTitle,
  counter,
  range,
  counterMet,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  /** Longer helper copy behind the info icon beside the label. */
  info?: React.ReactNode;
  infoTitle?: string;
  /** Live character count, e.g. "123" (or a full "123/500" string). */
  counter?: string;
  /** Required range shown beside the counter, e.g. "80–2,000". */
  range?: string;
  /** When true the counter renders in the signal accent (minimum reached). */
  counterMet?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-baseline justify-between">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-200">
          <span>
            {label} {required ? <span className="text-rose-400">*</span> : null}
          </span>
          {info ? <InfoTip title={infoTitle}>{info}</InfoTip> : null}
        </span>
        {counter || range ? (
          <span className="flex items-baseline gap-1 text-xs">
            {counter ? (
              <span
                className={cn(
                  "tabular font-medium",
                  counterMet ? "text-signal-400" : "text-ink-200",
                )}
              >
                {counter}
              </span>
            ) : null}
            {range ? <span className="tabular font-medium text-ink-300">/ {range}</span> : null}
          </span>
        ) : null}
      </span>
      {children}
      {error ? (
        <span className="block text-xs text-rose-400">{error}</span>
      ) : hint ? (
        <span className="block text-xs text-ink-500">{hint}</span>
      ) : null}
    </label>
  );
}
