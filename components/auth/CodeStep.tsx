"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { AUTH_COPY } from "@/content/auth";

const RESEND_COOLDOWN_S = 30;

/** The verification code form, with a resend cooldown and a way back to the email. */
export function CodeStep({
  email,
  onVerify,
  onResend,
  onChangeEmail,
  error,
  busy,
}: {
  email: string;
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  onChangeEmail: () => void;
  error: string | null;
  busy: boolean;
}) {
  const C = AUTH_COPY.code;
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy && code.trim()) void onVerify(code.trim());
      }}
      noValidate
    >
      <div className="space-y-1">
        <h2 className="font-display text-xl font-semibold tracking-tight text-ink-50">{C.title}</h2>
        <p className="text-sm text-ink-300">{C.lead(email)}</p>
      </div>
      <Field label={C.label} required error={error ?? undefined}>
        <Input
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={8}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))}
          placeholder="424242"
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy || !code.trim()}>
          {C.verify}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy || cooldown > 0}
          onClick={() => {
            setCooldown(RESEND_COOLDOWN_S);
            void onResend();
          }}
        >
          {cooldown > 0 ? C.resendIn(cooldown) : C.resend}
        </Button>
      </div>
      <button
        type="button"
        onClick={onChangeEmail}
        className="text-xs text-ink-400 underline-offset-2 transition-colors hover:text-ink-100 hover:underline"
      >
        {C.changeEmail}
      </button>
    </form>
  );
}
