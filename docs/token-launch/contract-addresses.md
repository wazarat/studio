# Contract addresses

**Available now.** Robinhood Chain Testnet (chain ID `46630`) and Arbitrum Sepolia (chain ID `421614`). Always confirm on the chain's explorer.

Addresses verified against `content/launch.ts` and `contracts/README.md` in the product repository.

{% hint style="warning" %}
Read an address together with its chain. The deployer started from nonce zero on each chain, so some address strings are the same on both chains but are **different contracts**. For example, `0x10F33eE0…9Bc0` is the AllocationSale on Arbitrum Sepolia and the paused v2 factory on Robinhood Chain Testnet, and `0x97d41F63…BEFC` is JourneyUpdates on Arbitrum Sepolia and the vesting wallet implementation on Robinhood Chain Testnet.
{% endhint %}

## Robinhood Chain Testnet (46630)

| Contract | Address |
|----------|---------|
| CurveLauncher (the `/launch` path) | [`0xb2e1F2df7775d17CE70c8CE7586c7bb01bD10981`](https://explorer.testnet.chain.robinhood.com/address/0xb2e1F2df7775d17CE70c8CE7586c7bb01bD10981) |
| TokenFactory v4 (live, script launches) | [`0x30Db3A828F65B92434c6aDB27AEeD01850277b08`](https://explorer.testnet.chain.robinhood.com/address/0x30Db3A828F65B92434c6aDB27AEeD01850277b08) |
| TimelockController | [`0x080cCDC07e2a0a5D11e9dDaA873ea68F540109ae`](https://explorer.testnet.chain.robinhood.com/address/0x080cCDC07e2a0a5D11e9dDaA873ea68F540109ae) |
| MilestoneEscrow | [`0x90C71DBA8A61Da14CA699f72D311e404094Cf192`](https://explorer.testnet.chain.robinhood.com/address/0x90C71DBA8A61Da14CA699f72D311e404094Cf192) |
| JourneyUpdates | [`0x31358209375591b1285EaA437c2c9f189c48D073`](https://explorer.testnet.chain.robinhood.com/address/0x31358209375591b1285EaA437c2c9f189c48D073) |
| AllocationSale | [`0x869cE70ff8174802d98D26835ce4040754Ad284A`](https://explorer.testnet.chain.robinhood.com/address/0x869cE70ff8174802d98D26835ce4040754Ad284A) |
| LaunchAMM | [`0xDd070b1f8e000D27491A3d38543ef0D72C758Df4`](https://explorer.testnet.chain.robinhood.com/address/0xDd070b1f8e000D27491A3d38543ef0D72C758Df4) |
| FeeSplitter | [`0x9FDFae007b65d4c8F3CCA6AC242E3f141eC9DA18`](https://explorer.testnet.chain.robinhood.com/address/0x9FDFae007b65d4c8F3CCA6AC242E3f141eC9DA18) |
| LaunchToken implementation | [`0x3E8c9be8BB486abEc132B0d1C35266b2336b129B`](https://explorer.testnet.chain.robinhood.com/address/0x3E8c9be8BB486abEc132B0d1C35266b2336b129B) |
| LaunchVestingWallet implementation | [`0x97d41F630025f83AdF72f00BaD8dC9B5e01eBEFC`](https://explorer.testnet.chain.robinhood.com/address/0x97d41F630025f83AdF72f00BaD8dC9B5e01eBEFC) |

All of these are source-verified on the explorer.

### Factory version history

Older factories are **paused**. Tokens they launched remain live and indexed.

| Version | Status | Address |
|---------|--------|---------|
| TokenFactory v4 | Live | [`0x30Db3A828F65B92434c6aDB27AEeD01850277b08`](https://explorer.testnet.chain.robinhood.com/address/0x30Db3A828F65B92434c6aDB27AEeD01850277b08) |
| TokenFactory v3 | Paused | [`0xD6166E156B52eB9B301D56Bd68d5D9c551d7d4c5`](https://explorer.testnet.chain.robinhood.com/address/0xD6166E156B52eB9B301D56Bd68d5D9c551d7d4c5) |
| TokenFactory v2 | Paused | [`0x10F33eE0f6a72D7Cc1f41196B4EF80B28C909Bc0`](https://explorer.testnet.chain.robinhood.com/address/0x10F33eE0f6a72D7Cc1f41196B4EF80B28C909Bc0) |
| TokenFactory v1 | Paused | [`0x1dAaa8294806d216Df36dc07B3803ED26584c909`](https://explorer.testnet.chain.robinhood.com/address/0x1dAaa8294806d216Df36dc07B3803ED26584c909) |

## Arbitrum Sepolia (421614)

Deployed on 2026-10-02 in one broadcast. The same contracts, with the same parameters.

| Contract | Address |
|----------|---------|
| CurveLauncher (the `/launch` path) | [`0x6Dde90B06b920565ccBA93D8ad7d5AfE5846426f`](https://arbitrum-sepolia.blockscout.com/address/0x6Dde90B06b920565ccBA93D8ad7d5AfE5846426f) |
| TokenFactory (script launches) | [`0xdC3521DDEFfca6825771da6c23679A7BA1E82475`](https://arbitrum-sepolia.blockscout.com/address/0xdC3521DDEFfca6825771da6c23679A7BA1E82475) |
| TimelockController | [`0xeD66C31FFAC1C5dCf4f327536a7540B22DF2B5E1`](https://arbitrum-sepolia.blockscout.com/address/0xeD66C31FFAC1C5dCf4f327536a7540B22DF2B5E1) |
| MilestoneEscrow | [`0x3F7AcbFE98c5Ac72259F7e838886c310f3E0D8ce`](https://arbitrum-sepolia.blockscout.com/address/0x3F7AcbFE98c5Ac72259F7e838886c310f3E0D8ce) |
| JourneyUpdates | [`0x97d41F630025f83AdF72f00BaD8dC9B5e01eBEFC`](https://arbitrum-sepolia.blockscout.com/address/0x97d41F630025f83AdF72f00BaD8dC9B5e01eBEFC) |
| AllocationSale | [`0x10F33eE0f6a72D7Cc1f41196B4EF80B28C909Bc0`](https://arbitrum-sepolia.blockscout.com/address/0x10F33eE0f6a72D7Cc1f41196B4EF80B28C909Bc0) |
| LaunchAMM | [`0x4EA372acAb7be21113f474CEd2B7b317019afeD3`](https://arbitrum-sepolia.blockscout.com/address/0x4EA372acAb7be21113f474CEd2B7b317019afeD3) |
| FeeSplitter | [`0x37dC58e2098b61249E12e0674D0C137EDf5248B4`](https://arbitrum-sepolia.blockscout.com/address/0x37dC58e2098b61249E12e0674D0C137EDf5248B4) |
| LaunchToken implementation | [`0x3E8c9be8BB486abEc132B0d1C35266b2336b129B`](https://arbitrum-sepolia.blockscout.com/address/0x3E8c9be8BB486abEc132B0d1C35266b2336b129B) |
| LaunchVestingWallet implementation | [`0x1dAaa8294806d216Df36dc07B3803ED26584c909`](https://arbitrum-sepolia.blockscout.com/address/0x1dAaa8294806d216Df36dc07B3803ED26584c909) |

The CurveLauncher and the TokenFactory are source-verified on Blockscout. The others are the same code and are still waiting for verification there.

## Chains

| Item | Robinhood Chain Testnet | Arbitrum Sepolia |
|------|-------------------------|------------------|
| Chain ID | `46630` | `421614` |
| RPC | `https://rpc.testnet.chain.robinhood.com` | `https://sepolia-rollup.arbitrum.io/rpc` |
| Explorer | https://explorer.testnet.chain.robinhood.com | https://arbitrum-sepolia.blockscout.com |
| Faucet | https://faucet.testnet.chain.robinhood.com | Any public Arbitrum Sepolia faucet |

## Related

- [Contract guarantees](contract-guarantees.md)
- [Fees and economics](fees-and-economics.md)
- [Governance](governance.md)
- [Network setup](network-setup.md)
- [Reference: networks and versions](../reference/networks-and-versions.md)
