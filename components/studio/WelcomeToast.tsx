"use client";

import { useEffect, useState } from "react";

import { Toast } from "@/components/ui/Toast";
import { AUTH_COPY } from "@/content/auth";
import { STUDIO_PATH } from "@/lib/auth-paths";

/**
 * The small popup after the last sign-up step. Shown once: the `?welcome=1`
 * that asked for it is stripped from the address on mount, so a reload or a
 * shared link does not show it again.
 */
export function WelcomeToast({ show }: { show: boolean }) {
  const [open, setOpen] = useState(show);
  useEffect(() => {
    if (show) window.history.replaceState(null, "", STUDIO_PATH);
  }, [show]);
  if (!open) return null;
  return <Toast onDismiss={() => setOpen(false)}>{AUTH_COPY.welcomeToast}</Toast>;
}
