"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useUser } from "@clerk/nextjs";

import { AvatarStep } from "@/components/onboarding/AvatarStep";
import { BuildStep } from "@/components/onboarding/BuildStep";
import { NameStep } from "@/components/onboarding/NameStep";
import { useModalBehavior } from "@/components/ui/useModalBehavior";
import { AUTH_COPY } from "@/content/auth";
import { STUDIO_META_KEY } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

const STEPS = ["name", "avatar", "build"] as const;

/**
 * Steps 2 to 4 of signing up, as a pop-up over the studio once the session
 * exists: name and username (required), a picture (optional), how you
 * build (optional). A three-segment hairline along the top edge is the
 * only progress indicator; each step's question is the heading. Every step
 * is saved on the Clerk user as it is finished, so a closed tab resumes
 * where it stopped. The last step, skipping it, or closing the pop-up once
 * the name is saved, stamps `onboardedAt`, which lets the studio open
 * without it.
 */
export function OnboardingModal({ onDone }: { onDone: () => void }) {
  const W = AUTH_COPY.welcome;
  const { isLoaded, user } = useUser();
  const [step, setStep] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const nameDone = Boolean(user?.firstName && user?.lastName && user?.username);

  async function stampAndClose() {
    if (!user) return;
    try {
      await user.updateMetadata({ unsafeMetadata: { [STUDIO_META_KEY]: { onboardedAt: new Date().toISOString() } } });
    } catch {
      // The next visit asks again; nothing else to do here.
    }
    onDone();
  }

  useModalBehavior({ onClose: () => void (nameDone && stampAndClose()), containerRef, active: true });

  const key = STEPS[step];
  const heading = key === "name" ? W.steps.name : key === "avatar" ? W.steps.avatar : W.steps.build;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={heading} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/80" onClick={() => void (nameDone && stampAndClose())} />
      <div
        ref={containerRef}
        tabIndex={-1}
        className="relative z-10 max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-xl border border-ink-700/60 bg-ink-900 animate-fade-in-up"
      >
        <div className="flex gap-1 px-1 pt-1" aria-hidden>
          {STEPS.map((s, i) => (
            <span key={s} className={cn("h-px flex-1 rounded-full", i <= step ? "bg-ink-50" : "bg-ink-700")} />
          ))}
        </div>
        <div className="p-6 md:p-7">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-ink-50">{heading}</h2>
          <div className="mt-4">
            {!isLoaded || !user ? (
              <div className="h-4 w-40 animate-pulse rounded bg-ink-800" />
            ) : key === "name" ? (
              <NameStep user={user} onDone={() => setStep(1)} />
            ) : key === "avatar" ? (
              <AvatarStep user={user} onDone={() => setStep(2)} onBack={() => setStep(0)} />
            ) : (
              <BuildStep user={user} onBack={() => setStep(1)} onDone={onDone} onSkip={() => void stampAndClose()} />
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
