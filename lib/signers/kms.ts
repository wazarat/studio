import "server-only";

import {
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
 * and address are stored or logged. Testnet-only in this step; destroying a
 * key disables it at once and schedules deletion a week out.
 */

const TESTNET_ONLY = "Live mode is testnet-only in this step";

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

/** Creates a fresh signing key and returns its id and Ethereum address. */
export async function createSessionKey(label: string): Promise<{ keyId: string; address: Hex }> {
  requireConfigured();
  const created = await kms().send(
    new CreateKeyCommand({
      KeySpec: "ECC_SECG_P256K1",
      KeyUsage: "SIGN_VERIFY",
      Description: "CanHav Studio session key",
      Tags: [
        { TagKey: "app", TagValue: "studio-session" },
        { TagKey: "label", TagValue: label },
      ],
    }),
  );
  const keyId = created.KeyMetadata?.KeyId;
  if (!keyId) throw new Error("KMS returned no key id");
  const pub = await kms().send(new GetPublicKeyCommand({ KeyId: keyId }));
  if (!pub.PublicKey) throw new Error(`KMS returned no public key for ${keyId}`);
  const address = spkiToAddress(pub.PublicKey);
  console.log(`[kms] created session key ${keyId}`);
  return { keyId, address };
}

async function signDigest(keyId: string, address: Hex, digest: Hex): Promise<Hex> {
  const out = await kms().send(
    new SignCommand({ KeyId: keyId, Message: hexToBytes(digest), MessageType: "DIGEST", SigningAlgorithm: "ECDSA_SHA_256" }),
  );
  if (!out.Signature) throw new Error(`KMS returned no signature for ${keyId}`);
  return signatureFor(digest, out.Signature, address);
}

/** A viem local account whose private key lives in KMS. */
export function kmsAccount(keyId: string, address: Hex): LocalAccount {
  return toAccount({
    address,
    async signMessage({ message }) {
      return signDigest(keyId, address, hashMessage(message));
    },
    async signTransaction(transaction, options) {
      // The wallet client prepares EIP-1559 transactions; any serializable
      // type works the same way: hash the unsigned form, sign, re-serialize.
      const serializer = options?.serializer ?? serializeTransaction;
      const digest = keccak256(await serializer(transaction));
      const signature = await signDigest(keyId, address, digest);
      return serializer(transaction, parseSignature(signature));
    },
    async signTypedData(typedData) {
      return signDigest(keyId, address, hashTypedData(typedData));
    },
  });
}

/** The session signer: same contract and guards as the dev signer. */
export function kmsSigner(keyId: string, address: Hex): Signer {
  const wallet = createWalletClient({
    account: kmsAccount(keyId, address),
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

function isInvalidState(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { name?: unknown }).name === "KMSInvalidStateException";
}

/** Disables the key now and schedules deletion; safe to call twice. */
export async function destroySessionKey(keyId: string): Promise<void> {
  try {
    await kms().send(new DisableKeyCommand({ KeyId: keyId }));
  } catch (err) {
    if (!isInvalidState(err)) throw err;
  }
  try {
    await kms().send(new ScheduleKeyDeletionCommand({ KeyId: keyId, PendingWindowInDays: 7 }));
  } catch (err) {
    if (!isInvalidState(err)) throw err;
  }
  console.log(`[kms] destroyed session key ${keyId}`);
}
