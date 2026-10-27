"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useUser } from "@clerk/nextjs";

import { AvatarStep } from "@/components/onboarding/AvatarStep";
import { BuildStep } from "@/components/onboarding/BuildStep";
import { NameStep } from "@/components/onboarding/NameStep";
import { StepNav } from "@/components/ui/StepNav";
import { useModalBehavior } from "@/components/ui/useModalBehavior";
import { AUTH_COPY } from "@/content/auth";
import { STUDIO_META_KEY } from "@/lib/onboarding";

const STEPS = ["name", "avatar", "build"] as const;

/**
 * Steps 2 to 4 of signing up, as a pop-up over the studio once the session
 * exists: name and username (required), avatar (optional), how you build
 * (optional). Every step is saved on the Clerk user as it is finished, so a
 * closed tab resumes where it stopped. The last step, or closing the
 * pop-up once the name is saved, stamps `onboardedAt`, which lets the
 * studio open without it.
 */
export function OnboardingModal({ onDone }: { onDone: () => void }) {
  const W = AUTH_COPY.welcome;
  const { isLoaded, user } = useUser();
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const nameDone = Boolean(user?.firstName && user?.lastName && user?.username);

  async function closeIfAllowed() {
    if (!user || !nameDone) return;
    try {
      await user.updateMetadata({ unsafeMetadata: { [STUDIO_META_KEY]: { onboardedAt: new Date().toISOString() } } });
    } catch {
      // The next visit asks again; nothing else to do here.
    }
    onDone();
  }

  useModalBehavior({ onClose: () => void closeIfAllowed(), containerRef, active: true });

  const go = (i: number) => {
    setStep(i);
    setReached((r) => Math.max(r, i));
  };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={W.title} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm" onClick={() => void closeIfAllowed()} />
      <div
        ref={containerRef}
        tabIndex={-1}
        className="glass relative z-10 max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-xl border border-ink-700/70 p-6 animate-fade-in-up md:p-7"
      >
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink-50">{W.title}</h2>
        <p className="mt-1 text-sm text-ink-300">{W.lead}</p>
        <div className="mt-5">
          <StepNav
            steps={[
              { key: "name", label: W.steps.name, problem: nameDone ? null : "Required" },
              { key: "avatar", label: W.steps.avatar, problem: null },
              { key: "build", label: W.steps.build, problem: null },
            ]}
            current={step}
            reachable={Math.max(reached, nameDone ? 2 : 0)}
            onSelect={go}
          />
        </div>
        <div className="mt-6">
          {!isLoaded || !user ? (
            <div className="h-4 w-40 animate-pulse rounded bg-ink-800" />
          ) : STEPS[step] === "name" ? (
            <NameStep user={user} onDone={() => go(1)} />
          ) : STEPS[step] === "avatar" ? (
            <AvatarStep user={user} onDone={() => go(2)} onBack={() => setStep(0)} />
          ) : (
            <BuildStep user={user} onBack={() => setStep(1)} onDone={onDone} />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
