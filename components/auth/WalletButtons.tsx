"use client";

import { Button } from "@/components/ui/Button";
import { AUTH_COPY } from "@/content/auth";

export type WalletProvider = "metamask" | "coinbase_wallet";

export const WALLET_STRATEGY = {
  metamask: "web3_metamask_signature",
  coinbase_wallet: "web3_coinbase_wallet_signature",
} as const;

/** The two wallet buttons under the email form. Clerk asks the wallet for one signature. */
export function WalletButtons({
  onPick,
  disabled,
}: {
  onPick: (provider: WalletProvider) => void;
  disabled?: boolean;
}) {
  const C = AUTH_COPY.card;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 text-xs text-ink-500">
        <span className="h-px flex-1 bg-ink-700/60" />
        {C.or}
        <span className="h-px flex-1 bg-ink-700/60" />
      </div>
      <Button type="button" variant="outline" className="w-full" disabled={disabled} onClick={() => onPick("metamask")}>
        {C.walletMetamask}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={disabled}
        onClick={() => onPick("coinbase_wallet")}
      >
        {C.walletCoinbase}
      </Button>
    </div>
  );
}
