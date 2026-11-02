import "server-only";

import { parseEther, type Hex } from "viem";

import { getDevSigner } from "@/lib/signers/dev";
import { ARBITRUM_SEPOLIA_CHAIN_ID } from "@/lib/venues/ostium";
import type { UnsignedTx } from "@/lib/venues/types";

/**
 * Gas for a session key (step 7). A fresh KMS key holds nothing, so the
 * testnet dev signer sends it a little Sepolia ETH to pay for its own
 * transactions. Testnet only: the dev signer refuses to load on mainnet.
 */

const DEFAULT_TOPUP_ETH = "0.002";

/** Sends LIVE_GAS_TOPUP_ETH (default 0.002) to `address`; null without a dev signer. */
export async function topUpSession(address: Hex): Promise<{ hash: Hex } | null> {
  const signer = getDevSigner();
  if (!signer) return null;
  const wei = parseEther(process.env.LIVE_GAS_TOPUP_ETH?.trim() || DEFAULT_TOPUP_ETH);
  const tx: UnsignedTx = {
    chainId: ARBITRUM_SEPOLIA_CHAIN_ID,
    to: address,
    data: "0x",
    value: wei.toString(),
    from: signer.address,
  };
  return signer.send(tx);
}
