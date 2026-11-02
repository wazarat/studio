import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { UnsignedTx } from "@/lib/venues/types";

/**
 * The KMS session signer's guards, with the AWS client mocked so any call
 * that reaches it fails the test: mainnet is refused before a key is
 * created, a wrong chain is refused before a signature is requested, and
 * configuration is all three AWS variables or nothing.
 */

vi.mock("@aws-sdk/client-kms", () => {
  class Command {
    constructor(public readonly input: unknown) {}
  }
  return {
    KMSClient: class {
      send(): never {
        throw new Error("AWS was reached");
      }
    },
    CreateKeyCommand: Command,
    GetPublicKeyCommand: Command,
    SignCommand: Command,
    DisableKeyCommand: Command,
    ScheduleKeyDeletionCommand: Command,
  };
});

const address = "0x000000000000000000000000000000000000dEaD";

beforeEach(() => {
  vi.stubEnv("AWS_REGION", "us-east-1");
  vi.stubEnv("AWS_ACCESS_KEY_ID", "test");
  vi.stubEnv("AWS_SECRET_ACCESS_KEY", "test");
  vi.stubEnv("OSTIUM_TESTNET", "true");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createSessionKey", () => {
  it("refuses mainnet before any AWS call", async () => {
    vi.stubEnv("OSTIUM_TESTNET", "false");
    const { createSessionKey } = await import("@/lib/signers/kms");
    await expect(createSessionKey("test")).rejects.toThrow("Live mode is testnet-only in this step");
  });

  it("refuses when AWS is not configured", async () => {
    vi.stubEnv("AWS_SECRET_ACCESS_KEY", "");
    const { createSessionKey } = await import("@/lib/signers/kms");
    await expect(createSessionKey("test")).rejects.toThrow("AWS KMS is not configured");
  });
});

describe("kmsSigner", () => {
  it("refuses a transaction for another chain", async () => {
    const { kmsSigner } = await import("@/lib/signers/kms");
    const tx: UnsignedTx = { chainId: 42161, to: address, data: "0x", value: "0", from: address };
    await expect(kmsSigner("key-id", address).send(tx)).rejects.toThrow("The session signer only signs for Arbitrum Sepolia, got chain 42161");
  });

  it("refuses a transaction built for another sender", async () => {
    const { kmsSigner } = await import("@/lib/signers/kms");
    const tx: UnsignedTx = { chainId: 421614, to: address, data: "0x", value: "0", from: "0x0000000000000000000000000000000000000001" };
    await expect(kmsSigner("key-id", address).send(tx)).rejects.toThrow("The transaction was built for a different sender");
  });

  it("refuses mainnet mode before signing", async () => {
    vi.stubEnv("OSTIUM_TESTNET", "false");
    const { kmsSigner } = await import("@/lib/signers/kms");
    const tx: UnsignedTx = { chainId: 421614, to: address, data: "0x", value: "0", from: address };
    await expect(kmsSigner("key-id", address).send(tx)).rejects.toThrow("Live mode is testnet-only in this step");
  });
});

describe("isKmsConfigured", () => {
  it("needs all three variables", async () => {
    const { isKmsConfigured } = await import("@/lib/signers/kms");
    expect(isKmsConfigured()).toBe(true);
    vi.stubEnv("AWS_REGION", "");
    expect(isKmsConfigured()).toBe(false);
    vi.stubEnv("AWS_REGION", "  ");
    expect(isKmsConfigured()).toBe(false);
  });
});
