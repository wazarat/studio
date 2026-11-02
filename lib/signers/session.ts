import "server-only";

import type { Hex } from "viem";

import { createSessionKey, destroySessionKey, isKmsConfigured, kmsSigner } from "@/lib/signers/kms";
import { createLocalSessionKey, destroyLocalSessionKey, isLocalKeyId, isLocalSignerEnabled, localSessionSigner } from "@/lib/signers/local-session";
import type { Signer } from "@/lib/signers/types";

/**
 * Which session key service to use (step 7). KMS is the default; the local
 * encrypted signer is for testnet development and is only picked when
 * `SESSION_SIGNER=local`. A stored key id says which service holds it
 * (`local:` prefix), so existing sessions keep working whatever the env.
 */
export type SessionKeyService = "kms" | "local";

export function sessionKeyService(): SessionKeyService {
  return isLocalSignerEnabled() ? "local" : "kms";
}

export function sessionSignerConfigured(): boolean {
  return sessionKeyService() === "local" || isKmsConfigured();
}

export function createSessionKeyFor(sessionId: string): Promise<{ keyId: string; address: Hex; createdAt: number }> {
  return sessionKeyService() === "local" ? createLocalSessionKey(sessionId) : createSessionKey(sessionId);
}

export function sessionSignerFor(keyId: string, address: Hex, createdAtMs: number): Signer {
  return isLocalKeyId(keyId) ? localSessionSigner(keyId, address) : kmsSigner(keyId, address, createdAtMs);
}

export function destroySessionKeyFor(keyId: string, createdAtMs: number): Promise<void> {
  return isLocalKeyId(keyId) ? destroyLocalSessionKey(keyId) : destroySessionKey(keyId, createdAtMs);
}
