"use client";

import { useUser } from "@clerk/nextjs";
import { useCallback, useState } from "react";

import { STUDIO_META_KEY } from "@/lib/onboarding";
import type { MarketNames } from "@/lib/venues/names";

/**
 * The market-naming choice, saved on the Clerk user beside the sign-up
 * answers (step 5b). Everyone starts on simple names; a flip is kept for
 * the account on every device.
 */
export function useMarketNames(initial: MarketNames) {
  const { user } = useUser();
  const [mode, setMode] = useState<MarketNames>(initial);
  const set = useCallback(
    (next: MarketNames) => {
      setMode(next);
      if (!user) return;
      const studio = ((user.unsafeMetadata as Record<string, unknown> | undefined)?.[STUDIO_META_KEY] as Record<string, unknown> | undefined) ?? {};
      void user.update({ unsafeMetadata: { ...user.unsafeMetadata, [STUDIO_META_KEY]: { ...studio, marketNames: next } } }).catch(() => {
        // The page keeps the choice for this visit; it is saved next time.
      });
    },
    [user],
  );
  return [mode, set] as const;
}
