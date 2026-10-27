"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { STUDIO_COPY } from "@/content/studio";

/** The Create project button. Projects are not in Studio yet, so it says so. */
export function CreateProjectButton({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const [note, setNote] = useState(false);
  return (
    <>
      <Button type="button" size={size} onClick={() => setNote(true)}>
        <Plus aria-hidden className="h-4 w-4" />
        {STUDIO_COPY.createProject}
      </Button>
      {note ? <Toast onDismiss={() => setNote(false)}>{STUDIO_COPY.createSoon}</Toast> : null}
    </>
  );
}
