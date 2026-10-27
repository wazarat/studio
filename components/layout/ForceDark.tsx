"use client";

import { useEffect } from "react";

import { applyTheme, readTheme } from "@/lib/theme";

/** Marketing pages are dark only; a light choice made in the app does not follow here. */
export function ForceDark() {
  useEffect(() => {
    if (readTheme() !== "dark") applyTheme("dark", { remember: false });
  }, []);
  return null;
}
