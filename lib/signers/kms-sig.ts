import { getAddress, keccak256, numberToHex, recoverAddress, serializeSignature, type Hex } from "viem";

/**
 * AWS KMS output to Ethereum signature (step 7), pure so it can be tested
 * without AWS. KMS hands back a DER SubjectPublicKeyInfo for the key and a
 * DER ECDSA-Sig-Value for each signature; Ethereum wants a 20-byte address
 * and a 65-byte r || s || v with a low s. Nothing here touches the network.
 */

/** secp256k1 group order. */
const SECP256K1_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const HALF_N = SECP256K1_N / 2n;

const TAG_INTEGER = 0x02;
const TAG_BIT_STRING = 0x03;
const TAG_SEQUENCE = 0x30;

interface Tlv {
  tag: number;
  /** Offset of the first content byte. */
  start: number;
  /** Offset one past the last content byte. */
  end: number;
}

/** Reads one DER tag-length-value at `offset`; short and long-form lengths. */
function readTlv(der: Uint8Array, offset: number, expectedTag: number): Tlv {
  if (offset + 2 > der.length) throw new Error("DER: truncated");
  const tag = der[offset];
  if (tag !== expectedTag) throw new Error(`DER: expected tag 0x${expectedTag.toString(16)}, got 0x${tag.toString(16)}`);
  let length = der[offset + 1];
  let cursor = offset + 2;
  if (length & 0x80) {
    const count = length & 0x7f;
    if (count === 0 || count > 4 || cursor + count > der.length) throw new Error("DER: bad length");
    length = 0;
    for (let i = 0; i < count; i++) length = (length << 8) | der[cursor + i];
    cursor += count;
  }
  if (cursor + length > der.length) throw new Error("DER: truncated");
  return { tag, start: cursor, end: cursor + length };
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let out = 0n;
  for (const b of bytes) out = (out << 8n) | BigInt(b);
  return out;
}

/** Address of the secp256k1 key in a KMS SubjectPublicKeyInfo. */
export function spkiToAddress(spkiDer: Uint8Array): Hex {
  const outer = readTlv(spkiDer, 0, TAG_SEQUENCE);
  const algorithm = readTlv(spkiDer, outer.start, TAG_SEQUENCE);
  const bits = readTlv(spkiDer, algorithm.end, TAG_BIT_STRING);
  const point = spkiDer.subarray(bits.start, bits.end);
  if (point.length !== 66 || point[0] !== 0x00 || point[1] !== 0x04) {
    throw new Error("SPKI: expected an uncompressed secp256k1 point");
  }
  const xy = point.subarray(2);
  const hash = keccak256(xy);
  return getAddress(`0x${hash.slice(-40)}`);
}

/** r and s from a DER ECDSA-Sig-Value. */
export function derToRS(sigDer: Uint8Array): { r: bigint; s: bigint } {
  const seq = readTlv(sigDer, 0, TAG_SEQUENCE);
  const rTlv = readTlv(sigDer, seq.start, TAG_INTEGER);
  const sTlv = readTlv(sigDer, rTlv.end, TAG_INTEGER);
  if (sTlv.end !== seq.end) throw new Error("DER: trailing bytes in signature");
  return {
    r: bytesToBigInt(sigDer.subarray(rTlv.start, rTlv.end)),
    s: bytesToBigInt(sigDer.subarray(sTlv.start, sTlv.end)),
  };
}

/** Canonical s (EIP-2): KMS may return either half, Ethereum accepts the low one. */
export function lowS(s: bigint): bigint {
  return s > HALF_N ? SECP256K1_N - s : s;
}

function serialize(r: bigint, s: bigint, v: 27 | 28): Hex {
  return serializeSignature({ r: numberToHex(r, { size: 32 }), s: numberToHex(s, { size: 32 }), v: BigInt(v) });
}

/** The recovery id that maps the signature back to `address`. */
export async function recoverV(digest: Hex, r: bigint, s: bigint, address: Hex): Promise<27 | 28> {
  const want = address.toLowerCase();
  for (const v of [27, 28] as const) {
    const recovered = await recoverAddress({ hash: digest, signature: serialize(r, s, v) });
    if (recovered.toLowerCase() === want) return v;
  }
  throw new Error("The KMS signature does not recover to the session address");
}

/** DER signature from KMS to the 65-byte signature Ethereum expects. */
export async function signatureFor(digest: Hex, sigDer: Uint8Array, address: Hex): Promise<Hex> {
  const { r, s: rawS } = derToRS(sigDer);
  const s = lowS(rawS);
  const v = await recoverV(digest, r, s, address);
  return serialize(r, s, v);
}

/** Exposed for tests that build DER by hand. */
export const SECP256K1_ORDER = SECP256K1_N;
