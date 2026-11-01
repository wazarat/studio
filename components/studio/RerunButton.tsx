"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { rerunBacktestAction } from "@/app/(app)/studio/strategies/actions";

/** Runs the backtest again with today's candles and costs, then refreshes the page. */
export function RerunButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="text-xs text-ink-400">
      <button
        type="button"
        disabled={pending}
        className="text-ink-300 underline-offset-2 hover:text-ink-50 hover:underline disabled:opacity-60"
        onClick={() =>
          start(async () => {
            const res = await rerunBacktestAction(id);
            if (!res.ok) setError(res.error);
            else router.refresh();
          })
        }
      >
        {pending ? "Running…" : "Run again"}
      </button>
      {error ? <span className="ml-2 text-rose-400">{error}</span> : null}
    </span>
  );
}
