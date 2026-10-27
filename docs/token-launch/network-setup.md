# Network setup

**Available now.**

Token Launch runs on two testnets. A token lives on the chain it was launched on, and a launch started from a studio project goes on that project's chain.

## Chain parameters

| Parameter | Robinhood Chain Testnet | Arbitrum Sepolia |
|-----------|-------------------------|------------------|
| Chain ID | `46630` | `421614` |
| RPC | `https://rpc.testnet.chain.robinhood.com` | `https://sepolia-rollup.arbitrum.io/rpc` |
| Explorer | [explorer.testnet.chain.robinhood.com](https://explorer.testnet.chain.robinhood.com) | [arbitrum-sepolia.blockscout.com](https://arbitrum-sepolia.blockscout.com) |
| Gas token | Testnet ETH | Testnet ETH |
| Faucet | [faucet.testnet.chain.robinhood.com](https://faucet.testnet.chain.robinhood.com) (0.01 ETH + stock tokens / 24h) | Any public Arbitrum Sepolia faucet. CanHav does not run one. |

Both are testnets. The ETH on them has no value.

## Wallet requirements

You need a browser wallet that can **add a custom EVM chain**. Most extension wallets that support EIP-6963 and custom networks work.

You do not have to add either network by hand. When you launch or trade, the site asks your wallet to switch to the token's chain, and to add the network first if the wallet does not have it. The site never signs on any chain but the one the token is on.

### Unsupported in the CanHav picker

These wallets appear via EIP-6963 but cannot add custom EVM testnets. The UI shows them disabled with a reason:

| Wallet | Reason |
|--------|--------|
| Keplr | Cannot add custom EVM testnets |
| HashPack | Hedera-only |

## How much testnet ETH you need

A launch costs the launch fee (0.0002 ETH on both chains at the time of writing), plus your developer buy if you make one (up to 0.005 ETH), plus gas. The form checks your balance before anything is uploaded or signed.

## Checklist

1. Install a supported wallet.
2. Get testnet ETH on the chain you want to launch on.
3. Open `/launch`, pick the chain, and connect. Approve the network switch when the wallet asks.

## Next

[Quickstart](quickstart.md) · [The launch form](launch-form.md)
