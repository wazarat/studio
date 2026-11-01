import "server-only";

import { createPublicClient, http, type Hex } from "viem";
import { arbitrum } from "viem/chains";

import { isFresh, type ChainlinkReading } from "@/lib/chainlink/compare";
import { ARBITRUM_ONE_FEEDS, feedFor } from "@/lib/chainlink/feeds";

/**
 * Reads Chainlink aggregators on Arbitrum One, whatever OSTIUM_TESTNET says:
 * the reference is always the mainnet feed. One multicall per batch; bigints
 * are turned into numbers before anything leaves this module.
 */

const DEFAULT_ARBITRUM_ONE_RPC = "https://arb1.arbitrum.io/rpc";

const AGGREGATOR_ABI = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "description", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  {
    type: "function",
    name: "latestRoundData",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
] as const;

let client: ReturnType<typeof createPublicClient> | null = null;

function publicClient() {
  client ??= createPublicClient({
    chain: arbitrum,
    transport: http(process.env.ARBITRUM_ONE_RPC_URL?.trim() || DEFAULT_ARBITRUM_ONE_RPC),
  });
  return client;
}

/** decimals and description never change for a proxy, so they are read once. */
const meta = new Map<Hex, { decimals: number; description: string }>();

export class ChainlinkError extends Error {
  readonly code: "feed-mismatch" | "rpc";
  constructor(code: "feed-mismatch" | "rpc", message: string) {
    super(message);
    this.name = "ChainlinkError";
    this.code = code;
  }
}

export function toleranceBps(): number {
  const raw = Number(process.env.CHAINLINK_TOLERANCE_BPS);
  return Number.isFinite(raw) && raw > 0 ? raw : 50;
}

/** Symbols that have a feed, in the order given. */
export function symbolsWithFeeds(symbols: string[]): string[] {
  return symbols.filter((s) => s in ARBITRUM_ONE_FEEDS);
}

/**
 * One reading per symbol that has a feed; symbols without one are simply
 * absent from the result. Throws on RPC failure or a description mismatch.
 */
export async function readReferences(symbols: string[], nowMs = Date.now()): Promise<Map<string, ChainlinkReading>> {
  const wanted = symbolsWithFeeds(Array.from(new Set(symbols)));
  const out = new Map<string, ChainlinkReading>();
  if (wanted.length === 0) return out;

  const pc = publicClient();
  const needMeta = wanted.filter((s) => !meta.has(feedFor(s)!.address));
  if (needMeta.length > 0) {
    const results = await pc.multicall({
      contracts: needMeta.flatMap((s) => {
        const address = feedFor(s)!.address;
        return [
          { address, abi: AGGREGATOR_ABI, functionName: "decimals" as const },
          { address, abi: AGGREGATOR_ABI, functionName: "description" as const },
        ];
      }),
      allowFailure: false,
    });
    needMeta.forEach((s, i) => {
      const entry = feedFor(s)!;
      const decimals = Number(results[i * 2]);
      const description = String(results[i * 2 + 1]);
      if (description !== entry.description) {
        throw new ChainlinkError(
          "feed-mismatch",
          `Feed ${entry.address} for ${s} describes itself as "${description}", expected "${entry.description}"`,
        );
      }
      meta.set(entry.address, { decimals, description });
    });
  }

  const rounds = await pc.multicall({
    contracts: wanted.map((s) => ({
      address: feedFor(s)!.address,
      abi: AGGREGATOR_ABI,
      functionName: "latestRoundData" as const,
    })),
    allowFailure: false,
  });

  wanted.forEach((symbol, i) => {
    const entry = feedFor(symbol)!;
    const { decimals } = meta.get(entry.address)!;
    const [, answer, , updatedAtRaw] = rounds[i];
    const raw = Number(answer) / 10 ** decimals;
    const price = entry.invert && raw > 0 ? 1 / raw : raw;
    const updatedAt = Number(updatedAtRaw);
    const ageSeconds = Math.floor(nowMs / 1000) - updatedAt;
    out.set(symbol, {
      symbol,
      feed: entry.address,
      price,
      updatedAt,
      ageSeconds,
      heartbeatSeconds: entry.heartbeatSeconds,
      fresh: isFresh(ageSeconds, entry.heartbeatSeconds),
    });
  });
  return out;
}

export async function readReference(symbol: string): Promise<ChainlinkReading | null> {
  const all = await readReferences([symbol]);
  return all.get(symbol) ?? null;
}
