import type { Hex, UnsignedTx } from "@/lib/venues/types";

/**
 * What every Studio signer looks like (step 7): an address and `send`, which
 * signs exactly the unsigned transaction the venue layer built and returns
 * its hash. The testnet dev signer (step 3) and the KMS session signer
 * (step 7) both implement it, so live trading does not care which one holds
 * the key.
 */
export interface Signer {
  address: Hex;
  send(tx: UnsignedTx): Promise<{ hash: Hex }>;
}
