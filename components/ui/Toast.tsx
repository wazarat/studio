"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * A small notice at the bottom right (canhav.dev's agent toast, generalised
 * and given its own flat card surface). Hides on its own after `hideAfterMs`
 * unless the pointer is over it.
 */
export function Toast({
  children,
  onDismiss,
  hideAfterMs = 8_000,
}: {
  children: React.ReactNode;
  onDismiss: () => void;
  hideAfterMs?: number;
}) {
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (hovered) return;
    const timer = setTimeout(onDismiss, hideAfterMs);
    return () => clearTimeout(timer);
  }, [hovered, hideAfterMs, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-40 max-w-sm animate-fade-in-up"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-start gap-3 rounded-xl border border-ink-700/60 bg-ink-900 px-4 py-3 text-sm leading-relaxed text-ink-100 shadow-lg">
        <span className="min-w-0">{children}</span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-mr-1 -mt-0.5 shrink-0 rounded-md p-1 text-ink-500 transition-colors hover:bg-ink-800/60 hover:text-ink-100"
        >
          <X aria-hidden className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
