import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createWalletClient, http, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";

import type { Signer } from "@/lib/signers/types";
import { ARBITRUM_SEPOLIA_CHAIN_ID, isTestnet } from "@/lib/venues/ostium";

/**
 * A testnet-only session signer for development (step 7), behind the same
 * `Signer` interface as the KMS signer. The key is generated here, encrypted
 * with AES-256-GCM under `SESSION_KEY_SECRET` from .env.local, and kept as
 * one file per session in a gitignored folder; it is decrypted only in
 * memory to sign and never logged or returned. It refuses to run unless
 * `OSTIUM_TESTNET` is true. KMS stays the default for anything else.
 */

const TESTNET_ONLY = "The local session signer is testnet-only; set OSTIUM_TESTNET=true or use KMS";
export const LOCAL_KEY_PREFIX = "local:";

function requireTestnet(): void {
  if (!isTestnet()) throw new Error(TESTNET_ONLY);
}

export function isLocalSignerEnabled(): boolean {
  return process.env.SESSION_SIGNER?.trim().toLowerCase() === "local" && Boolean(process.env.SESSION_KEY_SECRET?.trim());
}

export function isLocalKeyId(keyId: string): boolean {
  return keyId.startsWith(LOCAL_KEY_PREFIX);
}

function keyDir(): string {
  return path.resolve(process.cwd(), process.env.SESSION_KEY_DIR?.trim() || ".session-keys");
}

function fileFor(keyId: string): string {
  const id = keyId.slice(LOCAL_KEY_PREFIX.length);
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error("Bad local session key id");
  return path.join(keyDir(), `${id}.json`);
}

function masterKey(): Buffer {
  const raw = process.env.SESSION_KEY_SECRET?.trim();
  if (!raw) throw new Error("SESSION_KEY_SECRET is not set");
  const buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "utf8");
  if (buf.length < 32) throw new Error("SESSION_KEY_SECRET must be at least 32 bytes (64 hex characters)");
  return buf.subarray(0, 32);
}

interface StoredKey {
  sessionId: string;
  address: Hex;
  iv: string;
  tag: string;
  ciphertext: string;
  createdAt: number;
}

function encrypt(privateKey: Hex): Pick<StoredKey, "iv" | "tag" | "ciphertext"> {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(privateKey.slice(2), "hex")), cipher.final()]);
  return { iv: iv.toString("hex"), tag: cipher.getAuthTag().toString("hex"), ciphertext: ciphertext.toString("hex") };
}

function decrypt(s: StoredKey): Hex {
  const decipher = createDecipheriv("aes-256-gcm", masterKey(), Buffer.from(s.iv, "hex"));
  decipher.setAuthTag(Buffer.from(s.tag, "hex"));
  const plain = Buffer.concat([decipher.update(Buffer.from(s.ciphertext, "hex")), decipher.final()]);
  return `0x${plain.toString("hex")}` as Hex;
}

async function load(keyId: string): Promise<StoredKey> {
  const raw = await readFile(fileFor(keyId), "utf8").catch(() => null);
  if (!raw) throw new Error(`No local session key for ${keyId}`);
  return JSON.parse(raw) as StoredKey;
}

/** Generates and stores an encrypted session key; returns its id and address, never the key. */
export async function createLocalSessionKey(sessionId: string): Promise<{ keyId: string; address: Hex; createdAt: number }> {
  requireTestnet();
  masterKey();
  const keyId = `${LOCAL_KEY_PREFIX}${sessionId}`;
  const privateKey = generatePrivateKey();
  const address = privateKeyToAccount(privateKey).address;
  const createdAt = Date.now();
  const stored: StoredKey = { sessionId, address, ...encrypt(privateKey), createdAt };
  await mkdir(keyDir(), { recursive: true });
  await writeFile(fileFor(keyId), JSON.stringify(stored), { mode: 0o600 });
  console.log(`[local-signer] created session key ${keyId} at ${address}`);
  return { keyId, address, createdAt };
}

/** The session signer over the stored key: same guards as the dev and KMS signers. */
export function localSessionSigner(keyId: string, address: Hex): Signer {
  return {
    address,
    async send(tx) {
      requireTestnet();
      if (tx.chainId !== ARBITRUM_SEPOLIA_CHAIN_ID) {
        throw new Error(`The session signer only signs for Arbitrum Sepolia, got chain ${tx.chainId}`);
      }
      if (tx.from.toLowerCase() !== address.toLowerCase()) {
        throw new Error("The transaction was built for a different sender");
      }
      const stored = await load(keyId);
      if (stored.address.toLowerCase() !== address.toLowerCase()) throw new Error("The stored key does not match the session address");
      const account = privateKeyToAccount(decrypt(stored));
      const wallet = createWalletClient({ account, chain: arbitrumSepolia, transport: http(process.env.OSTIUM_RPC_URL?.trim() || undefined) });
      const hash = await wallet.sendTransaction({ to: tx.to, data: tx.data, value: BigInt(tx.value) });
      return { hash };
    },
  };
}

/** Deletes the key file; safe to call twice. */
export async function destroyLocalSessionKey(keyId: string): Promise<void> {
  const file = fileFor(keyId);
  // Overwrite before unlinking so the ciphertext does not linger in the file.
  await writeFile(file, "", { flag: "w" }).catch(() => undefined);
  await rm(file, { force: true });
  console.log(`[local-signer] destroyed session key ${keyId}`);
}
