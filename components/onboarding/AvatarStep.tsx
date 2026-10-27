"use client";

import { useEffect, useRef, useState } from "react";

import { StepFooter } from "@/components/onboarding/StepFooter";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { AUTH_COPY } from "@/content/auth";
import { errorSentence } from "@/lib/clerk-errors";
import type { ClerkUser } from "@/lib/clerk-types";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/**
 * The avatar step. An account made with Google already carries its Google
 * picture, which shows here and can be removed. Next uploads a picked file
 * if there is one and otherwise just moves on.
 */
export function AvatarStep({ user, onDone, onBack }: { user: ClerkUser; onDone: () => void; onBack: () => void }) {
  const A = AUTH_COPY.welcome.avatar;
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pick(f: File | null) {
    setError(null);
    if (!f) return;
    if (!TYPES.includes(f.type)) {
      setError(A.badType);
      return;
    }
    if (f.size > MAX_BYTES) {
      setError(A.tooLarge);
      return;
    }
    setFile(f);
  }

  async function next() {
    if (!file) {
      onDone();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await user.setProfileImage({ file });
      onDone();
    } catch (err) {
      setError(errorSentence(err, AUTH_COPY.welcome.failed));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setError(null);
    if (file) {
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setSaving(true);
    try {
      await user.setProfileImage({ file: null });
    } catch (err) {
      setError(errorSentence(err, AUTH_COPY.welcome.failed));
    } finally {
      setSaving(false);
    }
  }

  const shown = preview ?? (user.hasImage ? user.imageUrl : null);

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-ink-300">{A.lead}</p>
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-ink-700/60 bg-ink-950/50">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="font-display text-2xl font-semibold text-ink-500">
              {(user.firstName?.[0] ?? "").toUpperCase()}
            </span>
          )}
        </div>
        <div className="space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept={TYPES.join(",")}
            className="sr-only"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => inputRef.current?.click()}>
              {shown ? A.change : A.pick}
            </Button>
            {shown ? (
              <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => void remove()}>
                {A.remove}
              </Button>
            ) : null}
          </div>
          {file ? <p className="text-xs text-ink-500">{file.name}</p> : null}
        </div>
      </div>
      {error ? (
        <StatusChip tone="error" variant="block" role="alert">
          {error}
        </StatusChip>
      ) : null}
      <StepFooter
        primary={saving ? AUTH_COPY.welcome.saving : A.next}
        onPrimary={() => void next()}
        onBack={onBack}
        onSkip={onDone}
        busy={saving}
      />
    </div>
  );
}
