"use client";

import * as React from "react";
import { Info } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Info icon that opens a small popover (M74): click or Enter opens, Escape
 * and an outside click close. The home of every helper line longer than
 * one sentence, next to a label or a chip, so the field itself stays quiet.
 */
export function InfoTip({
  title,
  children,
  label = "More about this",
  align = "left",
  className,
}: {
  title?: string;
  children: React.ReactNode;
  /** Accessible name of the icon button. */
  label?: string;
  align?: "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  // Flip to the right edge when the icon sits in the right half of the
  // viewport, so a popover near a rail or a card edge stays on screen.
  const [side, setSide] = React.useState<"left" | "right">(align);
  const ref = React.useRef<HTMLSpanElement>(null);
  const id = React.useId();

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    // Stops clicks reaching a wrapping <label> or CheckItem, which would
    // otherwise toggle the control the tip explains.
    <span
      ref={ref}
      className={cn("relative inline-flex align-middle", className)}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          const box = ref.current?.getBoundingClientRect();
          if (box) setSide(box.left > window.innerWidth / 2 ? "right" : "left");
          setOpen((v) => !v);
        }}
        className="inline-flex h-5 w-5 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-ink-800/60 hover:text-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-500/60"
      >
        <Info aria-hidden className="h-3.5 w-3.5" />
      </button>
      {open ? (
        <span
          id={id}
          role="dialog"
          className={cn(
            "absolute top-full z-30 mt-1.5 block w-72 max-w-[calc(100vw-2rem)] whitespace-normal rounded-lg border border-ink-700/60 bg-ink-900 p-3 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-ink-200 shadow-lg",
            side === "right" ? "right-0" : "left-0",
          )}
        >
          {title ? <span className="mb-1 block font-medium text-ink-50">{title}</span> : null}
          {children}
        </span>
      ) : null}
    </span>
  );
}
