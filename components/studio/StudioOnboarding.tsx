"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { OnboardingModal } from "@/components/onboarding/OnboardingModal";
import { Toast } from "@/components/ui/Toast";
import { AUTH_COPY } from "@/content/auth";

/**
 * Opens the sign-up pop-up over the studio for an account that has not
 * finished its steps, and shows the congratulations popup once it has.
 * The server decides `onboard` from the Clerk user; after the steps the
 * page is refreshed so it reads the stamped metadata.
 */
export function StudioOnboarding({ onboard }: { onboard: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(onboard);
  const [toast, setToast] = useState(false);

  if (open) {
    return (
      <OnboardingModal
        onDone={() => {
          setOpen(false);
          setToast(true);
          router.refresh();
        }}
      />
    );
  }
  if (toast) return <Toast onDismiss={() => setToast(false)}>{AUTH_COPY.welcomeToast}</Toast>;
  return null;
}
