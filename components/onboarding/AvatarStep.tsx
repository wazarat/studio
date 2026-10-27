"use client";

import { useEffect, useRef, useState } from "react";
import type { ClerkUser } from "@/lib/clerk-types";

import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { AUTH_COPY } from "@/content/auth";
import { errorSentence } from "@/lib/clerk-errors";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

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

  async function upload() {
    if (!file) return;
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
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            {file || user.hasImage ? A.change : A.pick}
          </Button>
          {file ? <p className="text-xs text-ink-500">{file.name}</p> : null}
        </div>
      </div>
      {error ? (
        <StatusChip tone="error" variant="block" role="alert">
          {error}
        </StatusChip>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={!file || saving} onClick={() => void upload()}>
          {saving ? AUTH_COPY.welcome.saving : A.upload}
        </Button>
        <Button type="button" variant="secondary" disabled={saving} onClick={onDone}>
          {A.skip}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={onBack}>
          {A.back}
        </Button>
      </div>
    </div>
  );
}
