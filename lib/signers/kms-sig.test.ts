import { hexToBigInt, hexToBytes, recoverAddress, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount, sign } from "viem/accounts";
import { describe, expect, it } from "vitest";

import { derToRS, lowS, recoverV, SECP256K1_ORDER, signatureFor, spkiToAddress } from "@/lib/signers/kms-sig";

/**
 * The KMS wire formats re-encoded by hand around a throwaway key: the DER
 * walker finds r and s, s is normalised, and the assembled signature
 * recovers to the key's address even when KMS handed back a high s.
 */

const digest: Hex = "0x1111111111111111111111111111111111111111111111111111111111111111";

function derInteger(value: bigint): number[] {
  let hex = value.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  const bytes = Array.from(hexToBytes(`0x${hex}`));
  if (bytes[0] & 0x80) bytes.unshift(0);
  return [0x02, bytes.length, ...bytes];
}

function derSignature(r: bigint, s: bigint): Uint8Array {
  const body = [...derInteger(r), ...derInteger(s)];
  return new Uint8Array([0x30, body.length, ...body]);
}

// privateKeyToAccount does not expose the key, so keep it beside the account.
const privateKey = generatePrivateKey();
const keyed = privateKeyToAccount(privateKey);
const stranger = privateKeyToAccount(generatePrivateKey());

describe("derToRS", () => {
  it("round-trips r and s through DER", async () => {
    const signature = await sign({ hash: digest, privateKey });
    const r = hexToBigInt(signature.r);
    const s = hexToBigInt(signature.s);
    expect(derToRS(derSignature(r, s))).toEqual({ r, s });
  });

  it("rejects a non-sequence", () => {
    expect(() => derToRS(new Uint8Array([0x02, 0x01, 0x01]))).toThrow(/expected tag/);
  });
});

describe("lowS", () => {
  it("folds a high s and leaves a low s alone", () => {
    expect(lowS(SECP256K1_ORDER - 5n)).toBe(5n);
    expect(lowS(5n)).toBe(5n);
    expect(lowS(SECP256K1_ORDER / 2n)).toBe(SECP256K1_ORDER / 2n);
  });
});

describe("signatureFor", () => {
  it("recovers to the signer from a low-s DER signature", async () => {
    const signature = await sign({ hash: digest, privateKey });
    const der = derSignature(hexToBigInt(signature.r), hexToBigInt(signature.s));
    const out = await signatureFor(digest, der, keyed.address);
    expect(await recoverAddress({ hash: digest, signature: out })).toBe(keyed.address);
  });

  it("recovers to the signer when the DER carried a high s", async () => {
    const signature = await sign({ hash: digest, privateKey });
    const highS = SECP256K1_ORDER - hexToBigInt(signature.s);
    const der = derSignature(hexToBigInt(signature.r), highS);
    const out = await signatureFor(digest, der, keyed.address);
    expect(await recoverAddress({ hash: digest, signature: out })).toBe(keyed.address);
  });

  it("refuses a signature from another key", async () => {
    const signature = await sign({ hash: digest, privateKey });
    const der = derSignature(hexToBigInt(signature.r), hexToBigInt(signature.s));
    await expect(signatureFor(digest, der, stranger.address)).rejects.toThrow(/does not recover/);
  });
});

describe("recoverV", () => {
  it("returns 27 or 28", async () => {
    const signature = await sign({ hash: digest, privateKey });
    const v = await recoverV(digest, hexToBigInt(signature.r), hexToBigInt(signature.s), keyed.address);
    expect([27, 28]).toContain(v);
    expect(BigInt(v)).toBe(signature.v);
  });
});

describe("spkiToAddress", () => {
  it("matches the account address for a hand-built SubjectPublicKeyInfo", () => {
    const prefix = "3056301006072a8648ce3d020106052b8104000a034200";
    const xy = keyed.publicKey.slice(4);
    expect(xy).toHaveLength(128);
    const spki = hexToBytes(`0x${prefix}04${xy}`);
    expect(spkiToAddress(spki)).toBe(keyed.address);
  });

  it("rejects a compressed point", () => {
    const prefix = "3056301006072a8648ce3d020106052b8104000a034200";
    const spki = hexToBytes(`0x${prefix}02${keyed.publicKey.slice(4, 68)}`);
    expect(() => spkiToAddress(spki)).toThrow();
  });
});
