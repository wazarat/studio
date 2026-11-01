/**
 * Chainlink Data Feeds on Arbitrum One, keyed by Ostium symbol. Generated
 * from Chainlink's reference-data directory for Arbitrum (the canonical
 * proxy for each pair; the SVR and backup variants are left out). The
 * reader checks each proxy's description() against `description` so a wrong
 * address fails loudly instead of comparing against the wrong asset.
 *
 * `invert` marks the USD-base forex pairs where Chainlink quotes the other
 * way round (Ostium USD/JPY, Chainlink JPY / USD): the reference is 1 / price.
 * CVX is left out on purpose: Chainlink's CVX feed is the Convex token, not
 * Chevron. Ostium's indices, ETFs and most single stocks have no on-chain aggregator
 * here, so they show "No feed" and the check is skipped.
 */

export interface FeedEntry {
  address: `0x${string}`;
  /** What the aggregator's description() returns. */
  description: string;
  heartbeatSeconds: number;
  invert: boolean;
}

export const ARBITRUM_ONE_FEEDS: Readonly<Record<string, FeedEntry>> = {
  "AAPL/USD": { address: "0x8d0CC5f38f9E802475f2CFf4F9fc7000C2E1557c", description: "AAPL / USD", heartbeatSeconds: 86400, invert: false },
  "ADA/USD": { address: "0xD9f615A9b820225edbA2d821c4A696a0924051c6", description: "ADA / USD", heartbeatSeconds: 86400, invert: false },
  "AMZN/USD": { address: "0xd6a77691f071E98Df7217BED98f38ae6d2313EBA", description: "AMZN / USD", heartbeatSeconds: 86400, invert: false },
  "AUD/USD": { address: "0x9854e9a850e7C354c1de177eA953a6b1fba8Fc22", description: "AUD / USD", heartbeatSeconds: 86400, invert: false },
  "BNB/USD": { address: "0x6970460aabF80C5BE983C6b74e5D06dEDCA95D4A", description: "BNB / USD", heartbeatSeconds: 86400, invert: false },
  "BTC/USD": { address: "0x6ce185860a4963106506C203335A2910413708e9", description: "BTC / USD", heartbeatSeconds: 1755, invert: false },
  "COIN/USD": { address: "0x950DC95D4E537A14283059bADC2734977C454498", description: "COIN / USD", heartbeatSeconds: 86400, invert: false },
  "ETH/USD": { address: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612", description: "ETH / USD", heartbeatSeconds: 1755, invert: false },
  "EUR/USD": { address: "0xA14d53bC1F1c0F31B4aA3BD109344E5009051a84", description: "EUR / USD", heartbeatSeconds: 3600, invert: false },
  "GBP/USD": { address: "0x9C4424Fd84C6661F97D8d6b3fc3C1aAc2BeDd137", description: "GBP / USD", heartbeatSeconds: 86400, invert: false },
  "HYPE/USD": { address: "0xf9ce4fE2F0EcE0362cb416844AE179a49591D567", description: "HYPE / USD", heartbeatSeconds: 86400, invert: false },
  "LINK/USD": { address: "0x86E53CF1B870786351Da77A57575e79CB55812CB", description: "LINK / USD", heartbeatSeconds: 1755, invert: false },
  "META/USD": { address: "0xcd1bd86fDc33080DCF1b5715B6FCe04eC6F85845", description: "META / USD", heartbeatSeconds: 86400, invert: false },
  "MSFT/USD": { address: "0xDde33fb9F21739602806580bdd73BAd831DcA867", description: "MSFT / USD", heartbeatSeconds: 86400, invert: false },
  "NVDA/USD": { address: "0x4881A4418b5F2460B21d6F08CD5aA0678a7f262F", description: "NVDA / USD", heartbeatSeconds: 86400, invert: false },
  "SOL/USD": { address: "0x24ceA4b8ce57cdA5058b924B9B9987992450590c", description: "SOL / USD", heartbeatSeconds: 86400, invert: false },
  "TSLA/USD": { address: "0x3609baAa0a9b1f0FE4d6CC01884585d0e191C3E3", description: "TSLA / USD", heartbeatSeconds: 86400, invert: false },
  "USD/CAD": { address: "0xf6DA27749484843c4F02f5Ad1378ceE723dD61d4", description: "CAD / USD", heartbeatSeconds: 86400, invert: true },
  "USD/CHF": { address: "0xe32AccC8c4eC03F6E75bd3621BfC9Fbb234E1FC3", description: "CHF / USD", heartbeatSeconds: 86400, invert: true },
  "USD/JPY": { address: "0x3dD6e51CB9caE717d5a8778CF79A04029f9cFDF8", description: "JPY / USD", heartbeatSeconds: 86400, invert: true },
  "USD/KRW": { address: "0x85bb02E0Ae286600d1c68Bb6Ce22Cc998d411916", description: "KRW / USD", heartbeatSeconds: 86400, invert: true },
  "WTI/USD": { address: "0x594b919AD828e693B935705c3F816221729E7AE8", description: "WTI / USD", heartbeatSeconds: 86400, invert: false },
  "XAG/USD": { address: "0xC56765f04B248394CF1619D20dB8082Edbfa75b1", description: "XAG / USD", heartbeatSeconds: 86400, invert: false },
  "XAU/USD": { address: "0x1F954Dc24a49708C26E0C1777f16750B5C6d5a2c", description: "XAU / USD", heartbeatSeconds: 86400, invert: false },
  "XRP/USD": { address: "0xB4AD57B52aB9141de9926a3e0C8dc6264c2ef205", description: "XRP / USD", heartbeatSeconds: 86400, invert: false },
};

export function feedFor(symbol: string): FeedEntry | undefined {
  return ARBITRUM_ONE_FEEDS[symbol];
}
