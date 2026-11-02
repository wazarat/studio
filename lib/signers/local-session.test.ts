import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { recoverTransactionAddress, type Hex } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The local testnet signer: keys are encrypted at rest, sign for their own
 * address only, refuse mainnet, and leave nothing behind when destroyed.
 */
const SESSION = "11111111-2222-4333-8444-555555555555";
let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "studio-keys-"));
  vi.stubEnv("OSTIUM_TESTNET", "true");
  vi.stubEnv("SESSION_SIGNER", "local");
  vi.stubEnv("SESSION_KEY_SECRET", "a".repeat(64));
  vi.stubEnv("SESSION_KEY_DIR", dir);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.resetModules();
  await rm(dir, { recursive: true, force: true });
});

describe("local session signer", () => {
  it("stores the key encrypted and signs a Sepolia transaction for its own address", async () => {
    const mod = await import("@/lib/signers/local-session");
    const key = await mod.createLocalSessionKey(SESSION);
    expect(key.keyId).toBe(`local:${SESSION}`);
    const files = await readdir(dir);
    expect(files).toEqual([`${SESSION}.json`]);
    const raw = await readFile(path.join(dir, files[0]), "utf8");
    expect(raw).not.toMatch(/"privateKey"/);
    expect(JSON.parse(raw)).toMatchObject({ sessionId: SESSION, address: key.address });

    // Sign through viem's wallet client with the RPC stubbed: the raw transaction must recover to the session address.
    let signed: Hex | null = null;
    vi.stubGlobal("fetch", async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { id: number; method: string; params: unknown[] };
      const reply = (result: unknown) => new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result }), { headers: { "content-type": "application/json" } });
      switch (body.method) {
        case "eth_chainId":
          return reply("0x66eee");
        case "eth_getTransactionCount":
          return reply("0x0");
        case "eth_estimateGas":
          return reply("0x5208");
        case "eth_getBlockByNumber":
          return reply({ baseFeePerGas: "0x1", number: "0x1", gasLimit: "0x1000000", timestamp: "0x1" });
        case "eth_maxPriorityFeePerGas":
          return reply("0x1");
        case "eth_sendRawTransaction":
          signed = body.params[0] as Hex;
          return reply("0x" + "ab".repeat(32));
        default:
          return reply(null);
      }
    });
    const signer = mod.localSessionSigner(key.keyId, key.address);
    const { hash } = await signer.send({ chainId: 421614, to: "0x000000000000000000000000000000000000dEaD", data: "0x", value: "0", from: key.address });
    expect(hash).toBe("0x" + "ab".repeat(32));
    expect(signed).not.toBeNull();
    expect((await recoverTransactionAddress({ serializedTransaction: signed! as `0x02${string}` })).toLowerCase()).toBe(key.address.toLowerCase());

    await mod.destroyLocalSessionKey(key.keyId);
    expect(await readdir(dir)).toEqual([]);
    await expect(signer.send({ chainId: 421614, to: "0x000000000000000000000000000000000000dEaD", data: "0x", value: "0", from: key.address })).rejects.toThrow(/No local session key/);
  });

  it("refuses mainnet, the wrong chain and a different sender", async () => {
    const mod = await import("@/lib/signers/local-session");
    const key = await mod.createLocalSessionKey(SESSION);
    const signer = mod.localSessionSigner(key.keyId, key.address);
    await expect(signer.send({ chainId: 42161, to: "0x000000000000000000000000000000000000dEaD", data: "0x", value: "0", from: key.address })).rejects.toThrow(/Arbitrum Sepolia/);
    await expect(signer.send({ chainId: 421614, to: "0x000000000000000000000000000000000000dEaD", data: "0x", value: "0", from: "0x000000000000000000000000000000000000dEaD" })).rejects.toThrow(/different sender/);
    vi.stubEnv("OSTIUM_TESTNET", "false");
    await expect(signer.send({ chainId: 421614, to: "0x000000000000000000000000000000000000dEaD", data: "0x", value: "0", from: key.address })).rejects.toThrow(/testnet-only/);
    await expect(mod.createLocalSessionKey(SESSION)).rejects.toThrow(/testnet-only/);
  });

  it("is only picked when SESSION_SIGNER=local and a secret is set; KMS stays the default", async () => {
    const sel = await import("@/lib/signers/session");
    expect(sel.sessionKeyService()).toBe("local");
    vi.stubEnv("SESSION_SIGNER", "");
    expect(sel.sessionKeyService()).toBe("kms");
    vi.stubEnv("SESSION_SIGNER", "local");
    vi.stubEnv("SESSION_KEY_SECRET", "");
    expect(sel.sessionKeyService()).toBe("kms");
  });
});
