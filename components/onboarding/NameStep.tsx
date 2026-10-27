"use client";

import { useState } from "react";
import type { ClerkUser } from "@/lib/clerk-types";

import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { StatusChip } from "@/components/ui/StatusChip";
import { AUTH_COPY } from "@/content/auth";
import { apiErrorInfo, errorSentence } from "@/lib/clerk-errors";
import {
  HANDLE_MAX,
  NAME_MAX,
  STUDIO_META_KEY,
  normalizeHandle,
  readStudioMeta,
  validateHandle,
  validateName,
} from "@/lib/onboarding";

export function NameStep({ user, onDone }: { user: ClerkUser; onDone: () => void }) {
  const N = AUTH_COPY.welcome.name;
  const [first, setFirst] = useState(user.firstName ?? "");
  const [last, setLast] = useState(user.lastName ?? "");
  const [handle, setHandle] = useState(user.username ?? "");
  const [productUpdates, setProductUpdates] = useState(readStudioMeta(user.unsafeMetadata).productUpdates ?? false);
  const [errors, setErrors] = useState<{ first?: string; last?: string; handle?: string; global?: string }>({});
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = {
      first: validateName(first, "First name") ?? undefined,
      last: validateName(last, "Last name") ?? undefined,
      handle: validateHandle(handle) ?? undefined,
    };
    setErrors(next);
    if (next.first || next.last || next.handle) return;
    setSaving(true);
    try {
      await user.update({ firstName: first.trim(), lastName: last.trim(), username: normalizeHandle(handle) });
      await user.updateMetadata({ unsafeMetadata: { [STUDIO_META_KEY]: { productUpdates } } });
      onDone();
    } catch (err) {
      const info = apiErrorInfo(err);
      if (info?.param === "username" || info?.code.startsWith("form_username")) {
        setErrors({ handle: info.code === "form_identifier_exists" ? N.handleTaken : info.message });
      } else if (info?.param === "first_name") {
        setErrors({ first: info.message });
      } else if (info?.param === "last_name") {
        setErrors({ last: info.message });
      } else {
        setErrors({ global: errorSentence(err, AUTH_COPY.welcome.failed) });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit} noValidate>
      <p className="text-sm leading-relaxed text-ink-300">{N.lead}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={N.first} required error={errors.first}>
          <Input autoComplete="given-name" autoFocus maxLength={NAME_MAX} value={first} onChange={(e) => setFirst(e.target.value)} />
        </Field>
        <Field label={N.last} required error={errors.last}>
          <Input autoComplete="family-name" maxLength={NAME_MAX} value={last} onChange={(e) => setLast(e.target.value)} />
        </Field>
      </div>
      <Field label={N.handle} required error={errors.handle} hint={N.handleHint}>
        <Input
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={HANDLE_MAX}
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="ada_lovelace"
        />
      </Field>
      <label className="flex items-center gap-2 text-sm text-ink-200">
        <input
          type="checkbox"
          checked={productUpdates}
          onChange={(e) => setProductUpdates(e.target.checked)}
          className="h-4 w-4 rounded border-ink-600 bg-ink-950 accent-electric-500"
        />
        {N.productUpdates}
      </label>
      {errors.global ? (
        <StatusChip tone="error" variant="block" role="alert">
          {errors.global}
        </StatusChip>
      ) : null}
      <Button type="submit" disabled={saving}>
        {saving ? AUTH_COPY.welcome.saving : N.continue}
      </Button>
    </form>
  );
}
