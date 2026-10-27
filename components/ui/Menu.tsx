"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Dropdown menu (M74): a trigger and a flat panel under it, closed by an
 * outside click, Escape, or picking an item. Extracted from the wallet
 * connect button so every dropdown opens the same way.
 */
const MenuContext = React.createContext<{ close: () => void } | null>(null);

export function Menu({
  trigger,
  children,
  align = "right",
  width = "w-64",
  className,
}: {
  trigger: (state: { open: boolean; toggle: () => void }) => React.ReactNode;
  children: React.ReactNode;
  align?: "left" | "right";
  width?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const close = React.useCallback(() => setOpen(false), []);

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
    <div ref={ref} className={cn("relative", className)}>
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      {open ? (
        <MenuContext.Provider value={{ close }}>
          <div
            role="menu"
            className={cn(
              "absolute top-full z-20 mt-1.5 overflow-hidden rounded-lg border border-ink-700/60 bg-ink-900 py-1 shadow-lg",
              align === "right" ? "right-0" : "left-0",
              width,
            )}
          >
            {children}
          </div>
        </MenuContext.Provider>
      ) : null}
    </div>
  );
}

export function MenuItem({
  onSelect,
  disabled,
  className,
  children,
}: {
  onSelect?: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = React.useContext(MenuContext);
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={() => {
        ctx?.close();
        onSelect?.();
      }}
      className={cn(
        "flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-ink-100 transition-colors hover:bg-ink-800/60",
        "disabled:cursor-not-allowed disabled:hover:bg-transparent",
        className,
      )}
    >
      {children}
    </button>
  );
}
