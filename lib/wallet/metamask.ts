"use client";

import { createPublicClient, createWalletClient, custom, http, type Hex } from "viem";
import { arbitrumSepolia } from "viem/chains";

import type { UnsignedTx } from "@/lib/venues/types";

/**
 * The user's own wallet in the browser (Studio step 7): MetaMask or any
 * injected EIP-1193 provider. Studio only ever asks it to sign the
 * transactions the venue built for the trader (USDC approval, set and
 * remove delegate). No key, no signature and no address leaves the page
 * other than through those transactions.
 */

interface Eip1193 {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  isMetaMask?: boolean;
}

export const LIVE_CHAIN = arbitrumSepolia;

export function getInjected(): Eip1193 | null {
  if (typeof window === "undefined") return null;
  const eth = (window as unknown as { ethereum?: Eip1193 }).ethereum;
  return eth ?? null;
}

export class WalletError extends Error {
  constructor(
    public code: "missing" | "rejected" | "chain" | "other",
    message: string,
  ) {
    super(message);
  }
}

function wrap(e: unknown): WalletError {
  if (e instanceof WalletError) return e;
  const code = (e as { code?: number })?.code;
  const msg = e instanceof Error ? e.message : String(e);
  if (code === 4001 || /rejected|denied/i.test(msg)) return new WalletError("rejected", "You cancelled it in your wallet.");
  return new WalletError("other", msg);
}

/** Asks the wallet for its first account. */
export async function connectWallet(): Promise<Hex> {
  const eth = getInjected();
  if (!eth) throw new WalletError("missing", "No wallet found in this browser. Install MetaMask, then reload this page.");
  try {
    const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
    const a = accounts[0];
    if (!a) throw new WalletError("other", "The wallet returned no account.");
    return a as Hex;
  } catch (e) {
    throw wrap(e);
  }
}

/** Switches the wallet to Arbitrum Sepolia, adding the network when the wallet does not know it. */
export async function ensureLiveChain(): Promise<void> {
  const eth = getInjected();
  if (!eth) throw new WalletError("missing", "No wallet found in this browser.");
  const hex = `0x${LIVE_CHAIN.id.toString(16)}`;
  const current = (await eth.request({ method: "eth_chainId" })) as string;
  if (current?.toLowerCase() === hex) return;
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
  } catch (e) {
    const code = (e as { code?: number })?.code;
    if (code !== 4902) throw wrap(e);
    try {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: hex,
            chainName: "Arbitrum Sepolia",
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            rpcUrls: ["https://sepolia-rollup.arbitrum.io/rpc"],
            blockExplorerUrls: ["https://sepolia.arbiscan.io"],
          },
        ],
      });
    } catch (e2) {
      throw wrap(e2);
    }
  }
}

/** Sends one venue-built transaction from the connected account and returns its hash. */
export async function sendFromWallet(from: Hex, tx: UnsignedTx): Promise<Hex> {
  const eth = getInjected();
  if (!eth) throw new WalletError("missing", "No wallet found in this browser.");
  if (tx.chainId !== LIVE_CHAIN.id) throw new WalletError("chain", `This transaction is for chain ${tx.chainId}, not Arbitrum Sepolia.`);
  if (tx.from.toLowerCase() !== from.toLowerCase()) throw new WalletError("other", "The transaction was built for a different wallet address.");
  await ensureLiveChain();
  const wallet = createWalletClient({ chain: LIVE_CHAIN, transport: custom(eth) });
  try {
    return await wallet.sendTransaction({ account: from, to: tx.to, data: tx.data, value: BigInt(tx.value) });
  } catch (e) {
    throw wrap(e);
  }
}

/** Waits for the receipt on the public RPC; throws when the transaction reverted. */
export async function waitForReceipt(hash: Hex): Promise<void> {
  const client = createPublicClient({ chain: LIVE_CHAIN, transport: http() });
  const receipt = await client.waitForTransactionReceipt({ hash, timeout: 120_000 });
  if (receipt.status !== "success") throw new WalletError("other", `Transaction ${hash} reverted.`);
}
