"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import { inputClasses } from "@/components/ui/Input";
import { CONTACT_COPY, STUDIO_PRO_SOLUTIONS, type SolutionKey } from "@/content/studio-pro";
import { cn } from "@/lib/utils";

/**
 * The "How can we help?" picker in the contact modal. A trigger in the site
 * input styling opens an in-flow list of the nine solutions, any number of
 * which can be checked. In flow rather than floating so the modal's scroll
 * box never clips it. Escape closes the list and stops there, so the modal
 * underneath stays open; a second Escape closes the modal.
 */
export function SolutionsDropdown({
  value,
  onChange,
}: {
  value: SolutionKey[];
  onChange: (next: SolutionKey[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function toggle(key: SolutionKey) {
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
  }

  const picked = STUDIO_PRO_SOLUTIONS.filter((s) => value.includes(s.key));
  const summary =
    picked.length === 0
      ? CONTACT_COPY.solutionsPlaceholder
      : picked.length <= 2
        ? picked.map((s) => s.label).join(", ")
        : CONTACT_COPY.solutionsCount(picked.length);

  return (
    <div
      ref={rootRef}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          inputClasses,
          "flex items-center justify-between gap-3 overflow-hidden text-left",
          picked.length === 0 && "text-ink-500",
          open && "border-electric-500/60",
        )}
      >
        <span className="min-w-0 flex-1 truncate">{summary}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn("h-4 w-4 shrink-0 text-ink-400 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-multiselectable="true"
          aria-label={CONTACT_COPY.solutionsLabel}
          className="mt-2 grid gap-1 rounded-xl border border-ink-700/60 bg-ink-950/80 p-1.5 sm:grid-cols-2"
        >
          {STUDIO_PRO_SOLUTIONS.map((s) => {
            const on = value.includes(s.key);
            return (
              <li key={s.key} role="option" aria-selected={on}>
                <button
                  type="button"
                  onClick={() => toggle(s.key)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    on ? "bg-electric-500/15 text-electric-200" : "text-ink-200 hover:bg-ink-800/60 hover:text-ink-50",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      on ? "border-electric-400 bg-electric-500/30" : "border-ink-600 bg-ink-900/60",
                    )}
                  >
                    {on && <Check className="h-3 w-3" />}
                  </span>
                  {s.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
