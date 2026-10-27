"use client";

import { useState } from "react";

import { StepFooter } from "@/components/onboarding/StepFooter";
import { ChipRadioGroup } from "@/components/ui/ChipGroup";
import { Field, Input } from "@/components/ui/Input";
import { StatusChip } from "@/components/ui/StatusChip";
import { AUTH_COPY } from "@/content/auth";
import { errorSentence } from "@/lib/clerk-errors";
import type { ClerkUser } from "@/lib/clerk-types";
import {
  EXPERIENCE_OPTIONS,
  IDE_OPTIONS,
  ROLE_OPTIONS,
  ROLE_OTHER_MAX,
  STUDIO_META_KEY,
  readStudioMeta,
  type Experience,
  type Ide,
  type Role,
} from "@/lib/onboarding";

export function BuildStep({
  user,
  onDone,
  onBack,
  onSkip,
}: {
  user: ClerkUser;
  onDone: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const B = AUTH_COPY.welcome.build;
  const saved = readStudioMeta(user.unsafeMetadata);
  const [role, setRole] = useState<Role | "">(saved.role ?? "");
  const [roleOther, setRoleOther] = useState(saved.roleOther ?? "");
  const [experience, setExperience] = useState<Experience | "">(saved.experience ?? "");
  const [ide, setIde] = useState<Ide | "">(saved.ide ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function finish() {
    setSaving(true);
    setError(null);
    try {
      await user.updateMetadata({
        unsafeMetadata: {
          [STUDIO_META_KEY]: {
            role: role || null,
            roleOther: role === "other" && roleOther.trim() ? roleOther.trim().slice(0, ROLE_OTHER_MAX) : null,
            experience: experience || null,
            ide: ide || null,
            onboardedAt: new Date().toISOString(),
          },
        },
      });
      onDone();
    } catch (err) {
      setError(errorSentence(err, AUTH_COPY.welcome.failed));
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-ink-300">{B.lead}</p>
      <ChipRadioGroup label={B.role} value={role} onChange={setRole} options={ROLE_OPTIONS} />
      {role === "other" ? (
        <Field label={B.roleOther}>
          <Input
            maxLength={ROLE_OTHER_MAX}
            value={roleOther}
            onChange={(e) => setRoleOther(e.target.value)}
            placeholder={B.roleOtherPlaceholder}
          />
        </Field>
      ) : null}
      <ChipRadioGroup label={B.experience} value={experience} onChange={setExperience} options={EXPERIENCE_OPTIONS} />
      <ChipRadioGroup label={B.ide} hint={B.ideHint} value={ide} onChange={setIde} options={IDE_OPTIONS} />
      {error ? (
        <StatusChip tone="error" variant="block" role="alert">
          {error}
        </StatusChip>
      ) : null}
      <StepFooter
        primary={saving ? AUTH_COPY.welcome.saving : B.finish}
        onPrimary={() => void finish()}
        onBack={onBack}
        onSkip={onSkip}
        busy={saving}
      />
    </div>
  );
}
