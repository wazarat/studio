"use client";

import { useSyncExternalStore } from "react";

import { THEME_COLOR, THEME_STORAGE_KEY, type Theme } from "@/lib/theme-constants";

/**
 * Theme runtime for the signed-in app shell. The server renders dark on
 * every route; the inline ThemeScript in the app layout applies a stored
 * choice before first paint, and this store keeps React in step with the
 * html class afterwards. Marketing pages stay dark whatever is stored.
 */

const listeners = new Set<() => void>();

function isTheme(value: unknown): value is Theme {
  return value === "dark" || value === "light";
}

/** The theme on the document, dark when nothing has been applied yet. */
export function readTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

/** The stored preference, or null when the person never chose. */
export function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(value) ? value : null;
  } catch {
    return null;
  }
}

function setMetaThemeColor(theme: Theme) {
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    meta.setAttribute("content", THEME_COLOR[theme]);
  });
}

/** Switch the document, remember the choice when asked, notify subscribers. */
export function applyTheme(theme: Theme, { remember = true }: { remember?: boolean } = {}) {
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  root.classList.add(theme);
  root.style.colorScheme = theme;
  setMetaThemeColor(theme);
  if (remember) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Private mode or blocked storage; the choice lasts for this page.
    }
  }
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** The current theme; "dark" on the server and during hydration. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, readTheme, () => "dark");
}
