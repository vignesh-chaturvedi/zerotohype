---
order: 5
stage: Trading
code: T5
title: Building on order flow
summary: How a third-party app earns from and manages trading. Builder codes, referrals, sub-accounts, vaults and multi-sig.
depth: links
docs:
  - { title: Builder codes, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/trading/builder-codes", note: "How an app earns a fee on the fills it sends for users: each user approves a maximum fee for each builder and can revoke it, and the fee is set on each order." }
  - { title: Referrals, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/referrals", note: "Codes unlock after $10,000 of volume. You earn 10% of referred users' fees, less their discount, on their first $1B, and they get a discount on their first $25M." }
  - { title: Sub-accounts, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/trading/sub-accounts", note: "Up to 10 after $100,000 of volume, one more for each further $100M (80 at most). They share the master's fee tier, and each adds 2 API wallets." }
  - { title: Vaults, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/hypercore/vaults", note: "Vaults as HyperEVM contracts: tokenized, with your own accounting (EIP-4626 style), trading on HyperCore through CoreWriter." }
  - { title: Multi-sig, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/hypercore/multi-sig", note: "Native multi-sig with no contract: ConvertToMultiSigUser names the signers and how many must sign each action." }
  - { title: Market making, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/trading/market-making", note: "Short: there is no designated market-maker program, special rebate or latency advantage. Points to the Python SDK and the #api-traders Discord channel." }
  - { title: Account abstraction modes, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/trading/account-abstraction-modes", note: "How spot and perp balances interact and what counts as collateral. In a unified account, the recommended mode, one balance per asset serves spot and every perp DEX." }
outside:
  - { title: Hyperliquid trading bots, url: "https://chainstack.com/hyperliquid-trading-bots-2026/", by: Chainstack, note: "A tour of seven bots and frameworks, from Hummingbot's market making to copy trading, and what each suits." }
  - { title: "A trading app with builder codes", url: "https://www.dwellir.com/guides/builder-codes", by: Dwellir, note: "A full integration: the approval flow, an agent key for the session, fee mechanics and revocation, with a Next.js demo to clone." }
  - { title: "Builder codes from an embedded wallet", url: "https://docs.privy.io/recipes/hyperliquid/builder-codes", by: Privy, note: "Getting a builder code, asking the user to approve a fee, adding it to orders and checking the approval, in an app on Privy wallets." }
build:
  - { label: Builder code fee calculator, kind: workbench }
  - { label: Testnet market maker, kind: project }
---

This track gathers what you need to make money from the order flow your app sends. Builder codes pay you a fee on every fill you route; sub-accounts and vaults let you run strategies on others' capital. Until its full lesson is written, this track is a reading list.
