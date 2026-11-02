import "server-only";

import {
  CreateAliasCommand,
  CreateKeyCommand,
  DisableKeyCommand,
  GetPublicKeyCommand,
  KMSClient,
  ScheduleKeyDeletionCommand,
  SignCommand,
} from "@aws-sdk/client-kms";
import { createWalletClient, hashMessage, hashTypedData, hexToBytes, http, keccak256, parseSignature, serializeTransaction, type Hex, type LocalAccount } from "viem";
import { toAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";

import { signatureFor, spkiToAddress } from "@/lib/signers/kms-sig";
import type { Signer } from "@/lib/signers/types";
import { ARBITRUM_SEPOLIA_CHAIN_ID, isTestnet } from "@/lib/venues/ostium";

/**
 * Session keys in AWS KMS (step 7). A live session gets its own
 * ECC_SECG_P256K1 key that never leaves KMS: Studio hashes locally, asks KMS
 * to sign the digest and assembles the Ethereum signature. Only the key id
 * and address are stored or logged. Testnet-only in this step.
 *
 * The IAM policy is alias-scoped, no tags: CreateKey (secp256k1,
 * SIGN_VERIFY), then CreateAlias as `alias/canhav-delegate/<session id>`,
 * then GetPublicKey. Sign, DisableKey and ScheduleKeyDeletion are only
 * allowed once the alias exists, and AWS can take up to about five minutes
 * to see a new alias, so those calls back off and retry on access denied
 * within five minutes of the key's creation. If CreateAlias fails the key
 * id is logged and Go live stops: the policy cannot disable an unnamed
 * key, so it is deleted by hand.
 */

const TESTNET_ONLY = "Live mode is testnet-only in this step";
export const ALIAS_PREFIX_DEFAULT = "alias/canhav-delegate";
/** How long after creation an access-denied answer is treated as alias propagation. */
export const ALIAS_GRACE_MS = 5 * 60 * 1000;

let client: KMSClient | undefined;

function kms(): KMSClient {
  if (!client) client = new KMSClient({ region: process.env.AWS_REGION });
  return client;
}

export function isKmsConfigured(): boolean {
  return ["AWS_REGION", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"].every((name) => Boolean(process.env[name]?.trim()));
}

function requireConfigured(): void {
  if (!isTestnet()) throw new Error(TESTNET_ONLY);
  if (!isKmsConfigured()) throw new Error("AWS KMS is not configured");
}

export function aliasFor(sessionId: string): string {
  const prefix = (process.env.KMS_KEY_ALIAS_PREFIX?.trim() || ALIAS_PREFIX_DEFAULT).replace(/\/+$/, "");
  return `${prefix.startsWith("alias/") ? prefix : `alias/${prefix}`}/${sessionId}`;
}

function errName(err: unknown): string {
  return typeof err === "object" && err !== null ? String((err as { name?: unknown }).name ?? "") : "";
}

const isAccessDenied = (err: unknown) => /AccessDenied|NotAuthorized/i.test(errName(err));
const isInvalidState = (err: unknown) => errName(err) === "KMSInvalidStateException";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Runs a key operation, retrying access-denied answers with backoff (2 s
 * doubling to 30 s) while the key is younger than the alias grace period.
 */
async function withAliasGrace<T>(createdAtMs: number, what: string, fn: () => Promise<T>): Promise<T> {
  let wait = 2_000;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      const deadline = createdAtMs + ALIAS_GRACE_MS;
      if (!isAccessDenied(err) || Date.now() + wait > deadline) throw err;
      console.log(`[kms] ${what} denied while the alias propagates; retrying in ${wait / 1000}s`);
      await sleep(wait);
      wait = Math.min(wait * 2, 30_000);
    }
  }
}

/**
 * Creates the session's signing key, names it with the session id, and
 * returns its id, alias and Ethereum address.
 */
export async function createSessionKey(sessionId: string): Promise<{ keyId: string; alias: string; address: Hex; createdAt: number }> {
  requireConfigured();
  const createdAt = Date.now();
  const created = await kms().send(
    new CreateKeyCommand({
      KeySpec: "ECC_SECG_P256K1",
      KeyUsage: "SIGN_VERIFY",
      Description: `CanHav Studio session key ${sessionId}`,
    }),
  );
  const keyId = created.KeyMetadata?.KeyId;
  if (!keyId) throw new Error("KMS returned no key id");
  const alias = aliasFor(sessionId);
  try {
    await kms().send(new CreateAliasCommand({ AliasName: alias, TargetKeyId: keyId }));
  } catch (err) {
    console.error(`[kms] CreateAlias ${alias} failed for key ${keyId}: ${err instanceof Error ? err.message : String(err)}`);
    throw new Error(
      `Could not name the session key: ${err instanceof Error ? err.message : String(err)}. Key ${keyId} was created without an alias and must be deleted by hand. Go live stopped.`,
    );
  }
  const pub = await withAliasGrace(createdAt, "GetPublicKey", () => kms().send(new GetPublicKeyCommand({ KeyId: keyId })));
  if (!pub.PublicKey) throw new Error(`KMS returned no public key for ${keyId}`);
  const address = spkiToAddress(pub.PublicKey);
  console.log(`[kms] created session key ${keyId} as ${alias}`);
  return { keyId, alias, address, createdAt };
}

async function signDigest(keyId: string, address: Hex, digest: Hex, createdAtMs: number): Promise<Hex> {
  const out = await withAliasGrace(createdAtMs, "Sign", () =>
    kms().send(new SignCommand({ KeyId: keyId, Message: hexToBytes(digest), MessageType: "DIGEST", SigningAlgorithm: "ECDSA_SHA_256" })),
  );
  if (!out.Signature) throw new Error(`KMS returned no signature for ${keyId}`);
  return signatureFor(digest, out.Signature, address);
}

/** A viem local account whose private key lives in KMS. */
export function kmsAccount(keyId: string, address: Hex, createdAtMs = 0): LocalAccount {
  return toAccount({
    address,
    async signMessage({ message }) {
      return signDigest(keyId, address, hashMessage(message), createdAtMs);
    },
    async signTransaction(transaction, options) {
      // The wallet client prepares EIP-1559 transactions; any serializable
      // type works the same way: hash the unsigned form, sign, re-serialize.
      const serializer = options?.serializer ?? serializeTransaction;
      const digest = keccak256(await serializer(transaction));
      const signature = await signDigest(keyId, address, digest, createdAtMs);
      return serializer(transaction, parseSignature(signature));
    },
    async signTypedData(typedData) {
      return signDigest(keyId, address, hashTypedData(typedData), createdAtMs);
    },
  });
}

/** The session signer: same contract and guards as the dev signer. */
export function kmsSigner(keyId: string, address: Hex, createdAtMs = 0): Signer {
  const wallet = createWalletClient({
    account: kmsAccount(keyId, address, createdAtMs),
    chain: arbitrumSepolia,
    transport: http(process.env.OSTIUM_RPC_URL?.trim() || undefined),
  });
  return {
    address,
    async send(tx) {
      if (tx.chainId !== ARBITRUM_SEPOLIA_CHAIN_ID) {
        throw new Error(`The session signer only signs for Arbitrum Sepolia, got chain ${tx.chainId}`);
      }
      if (tx.from.toLowerCase() !== address.toLowerCase()) {
        throw new Error("The transaction was built for a different sender");
      }
      if (!isTestnet()) throw new Error(TESTNET_ONLY);
      const hash = await wallet.sendTransaction({ to: tx.to, data: tx.data, value: BigInt(tx.value) });
      return { hash };
    },
  };
}

/** Disables the key now and schedules deletion a week out; safe to call twice. */
export async function destroySessionKey(keyId: string, createdAtMs = 0): Promise<void> {
  try {
    await withAliasGrace(createdAtMs, "DisableKey", () => kms().send(new DisableKeyCommand({ KeyId: keyId })));
  } catch (err) {
    if (!isInvalidState(err)) throw err;
  }
  try {
    await withAliasGrace(createdAtMs, "ScheduleKeyDeletion", () => kms().send(new ScheduleKeyDeletionCommand({ KeyId: keyId, PendingWindowInDays: 7 })));
  } catch (err) {
    if (!isInvalidState(err)) throw err;
  }
  console.log(`[kms] destroyed session key ${keyId}`);
}
