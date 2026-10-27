"use client";

import { cn } from "@/lib/utils";

export interface StepDef {
  label: string;
  /** First validation problem for the step, or null when complete. */
  problem: string | null;
  key?: string;
}

/**
 * Numbered step pills (canhav.dev's StepNav without the product variant).
 * Completeness shows as a dot. `reachable` says how far back and forward a
 * click may go; later steps stay visible but inert.
 */
export function StepNav({
  steps,
  current,
  reachable,
  onSelect,
}: {
  steps: StepDef[];
  current: number;
  /** Highest index that can be selected. */
  reachable: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Steps">
      {steps.map((step, i) => {
        const off = i > reachable;
        return (
          <button
            key={step.key ?? step.label}
            type="button"
            disabled={off}
            aria-current={i === current ? "step" : undefined}
            onClick={() => onSelect(i)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
              i === current
                ? "border-electric-500 bg-electric-500/10 text-electric-300"
                : "border-ink-700/60 text-ink-400 hover:text-ink-200",
              off && "cursor-default opacity-60 hover:text-ink-400",
            )}
          >
            <span
              aria-hidden
              className={cn("h-1.5 w-1.5 rounded-full", step.problem === null ? "bg-signal-400" : "bg-ink-600")}
            />
            {i + 1}. {step.label}
          </button>
        );
      })}
    </div>
  );
}
