"use client";

import { useEffect } from "react";

import { applyTheme, readTheme, storedTheme } from "@/lib/theme";

/** On a client-side arrival in the app shell, restore the stored choice (the ThemeScript covers full loads). */
export function AppTheme() {
  useEffect(() => {
    const wanted = storedTheme() ?? "dark";
    if (readTheme() !== wanted) applyTheme(wanted, { remember: false });
  }, []);
  return null;
}
