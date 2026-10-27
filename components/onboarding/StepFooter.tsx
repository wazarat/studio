"use client";

import { Button } from "@/components/ui/Button";

const LINK = "text-sm text-ink-400 underline-offset-2 transition-colors hover:text-ink-100 hover:underline disabled:opacity-50";

/**
 * The row under every step: Back as a text link on the left, and on the
 * right the primary button with Skip as a text link beside it. A step
 * without a way back or a way past it leaves those out.
 */
export function StepFooter({
  primary,
  primaryType = "button",
  onPrimary,
  onBack,
  onSkip,
  skipLabel = "Skip",
  backLabel = "Back",
  busy = false,
}: {
  primary: string;
  primaryType?: "button" | "submit";
  onPrimary?: () => void;
  onBack?: () => void;
  onSkip?: () => void;
  skipLabel?: string;
  backLabel?: string;
  busy?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 pt-2">
      <div>
        {onBack ? (
          <button type="button" className={LINK} disabled={busy} onClick={onBack}>
            {backLabel}
          </button>
        ) : null}
      </div>
      <div className="flex items-center gap-4">
        {onSkip ? (
          <button type="button" className={LINK} disabled={busy} onClick={onSkip}>
            {skipLabel}
          </button>
        ) : null}
        <Button type={primaryType} disabled={busy} onClick={primaryType === "button" ? onPrimary : undefined}>
          {primary}
        </Button>
      </div>
    </div>
  );
}
