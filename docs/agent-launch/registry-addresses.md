# Registry addresses

**Not started.** The Agent / ERC-8004 product track is not started. These pages are retained for reference only. Do not treat register/browse copy below as a shipped CanHav product commitment.

Base Sepolia (chain ID `84532`). CanHav does not own these contracts. Confirm on [Blockscout](https://base-sepolia.blockscout.com).

## Configured testnet registries

| Registry | Address |
|----------|---------|
| Identity Registry | [`0x8004A818BFB912233c491871b3d84c89A494BD9e`](https://base-sepolia.blockscout.com/address/0x8004A818BFB912233c491871b3d84c89A494BD9e) |
| Reputation Registry | [`0x8004B663056A597Dffe9eCcC1965A193B7388713`](https://base-sepolia.blockscout.com/address/0x8004B663056A597Dffe9eCcC1965A193B7388713) |

Identity Registry deploy block (indexer start): `36304145`.

## Safety: vanity prefix

| Network | Identity prefix |
|---------|-----------------|
| Base Sepolia | `0x8004A818` |
| Mainnet | `0x8004A169` |

Every CanHav layer (site banner, verify script, agents indexer startup) **refuses** an Identity Registry address that does not start with `0x8004A818`. If you see a configuration error about the prefix, you almost certainly pointed at mainnet by mistake.

## Related

- [What is ERC-8004](what-is-erc-8004.md)
- [Network setup](network-setup.md)
- [FAQ](faq.md)
