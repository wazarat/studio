import "server-only";

import type { SessionDeps } from "@/lib/live/executor";
import type { WalletSession } from "@/lib/live/store";
import { destroySessionKeyFor, sessionSignerFor } from "@/lib/signers/session";
import { delegatedVenue, findOrdersByTxHash, getDelegationStatus, getFillsSince, orderIdFromReceipt, ostium } from "@/lib/venues/ostium";

/**
 * The real venue and signer for one wallet session (step 7): Ostium's
 * delegated builders for the trader through the session account, the KMS
 * signer for that account (KMS, or the local testnet signer), and the
 * trader's chain reads. This module only ever holds the key id.
 */
export function sessionDepsFor(w: WalletSession): SessionDeps {
  return {
    venue: delegatedVenue(w.trader, w.sessionAddress),
    signer: sessionSignerFor(w.kmsKeyId, w.sessionAddress, w.createdAt),
    positions: () => ostium.positions(w.trader),
    fillsSince: (fromMs) => getFillsSince(w.trader, fromMs),
    delegation: (requiredUsd) => getDelegationStatus(w.trader, w.sessionAddress, requiredUsd),
    orderId: (hash, action) => orderIdFromReceipt(hash, w.trader, action),
    orderStatus: (hash) => findOrdersByTxHash(hash),
    destroyKey: () => destroySessionKeyFor(w.kmsKeyId, w.createdAt),
  };
}
