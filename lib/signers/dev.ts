import "server-only";

import { createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";

import type { Signer } from "@/lib/signers/types";
import { ARBITRUM_SEPOLIA_CHAIN_ID, isTestnet } from "@/lib/venues/ostium";

/**
 * The test-only signer (Studio step 3): a testnet key from .env.local that
 * signs exactly what the venue layer built, so the internal page proves the
 * path a real wallet will take. It refuses to load on mainnet, never logs
 * the key and exposes only its address and `send`. Nothing else in Studio
 * signs anything.
 */

export type DevSigner = Signer;

let cached: DevSigner | null | undefined;

export function getDevSigner(): DevSigner | null {
  if (cached !== undefined) return cached;
  const raw = process.env.OSTIUM_DEV_PRIVATE_KEY?.trim();
  if (!raw) {
    cached = null;
    return cached;
  }
  if (!isTestnet()) throw new Error("The dev signer is testnet-only; set OSTIUM_TESTNET=true or unset the key.");
  const key = (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
  const account = privateKeyToAccount(key);
  const wallet = createWalletClient({
    account,
    chain: arbitrumSepolia,
    transport: http(process.env.OSTIUM_RPC_URL?.trim() || undefined),
  });

  cached = {
    address: account.address,
    async send(tx) {
      if (tx.chainId !== ARBITRUM_SEPOLIA_CHAIN_ID) {
        throw new Error(`The dev signer only signs for Arbitrum Sepolia, got chain ${tx.chainId}`);
      }
      if (tx.from.toLowerCase() !== account.address.toLowerCase()) {
        throw new Error("The transaction was built for a different trader");
      }
      const hash = await wallet.sendTransaction({ to: tx.to, data: tx.data, value: BigInt(tx.value) });
      return { hash };
    },
  };
  return cached;
}
