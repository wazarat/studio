"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

import { AvatarStep } from "@/components/onboarding/AvatarStep";
import { BuildStep } from "@/components/onboarding/BuildStep";
import { NameStep } from "@/components/onboarding/NameStep";
import { Card, CardSection } from "@/components/ui/Card";
import { StepNav } from "@/components/ui/StepNav";
import { AUTH_COPY } from "@/content/auth";
import { STUDIO_PATH } from "@/lib/auth-paths";

const STEPS = ["name", "avatar", "build"] as const;

/**
 * Steps 2 to 4 of signing up, run once the session exists: name and handle
 * (required), avatar (optional), how you build (optional). Every step is
 * saved on the Clerk user as it is finished, so a closed tab resumes where
 * it stopped. The last step stamps `onboardedAt`, which lets /studio open.
 */
export function Onboarding() {
  const W = AUTH_COPY.welcome;
  const router = useRouter();
  const { isLoaded, user } = useUser();
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);

  if (!isLoaded || !user) {
    return (
      <Card className="max-w-xl">
        <CardSection>
          <div className="h-4 w-40 animate-pulse rounded bg-ink-800" />
        </CardSection>
      </Card>
    );
  }

  const nameDone = Boolean(user.firstName && user.lastName && user.username);
  const go = (i: number) => {
    setStep(i);
    setReached((r) => Math.max(r, i));
  };

  return (
    <div className="space-y-6">
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
      <Card className="max-w-xl">
        <CardSection>
          {STEPS[step] === "name" ? (
            <NameStep user={user} onDone={() => go(1)} />
          ) : STEPS[step] === "avatar" ? (
            <AvatarStep user={user} onDone={() => go(2)} onBack={() => setStep(0)} />
          ) : (
            <BuildStep
              user={user}
              onBack={() => setStep(1)}
              onDone={() => router.push(`${STUDIO_PATH}?welcome=1`)}
            />
          )}
        </CardSection>
      </Card>
    </div>
  );
}
