---
order: 6
stage: Deploying markets
code: T6
title: Launching assets
summary: Native spot tokens (HIP-1), the Hyperliquidity strategy that gives them a market (HIP-2), and spot quote assets.
depth: links
docs:
  - { title: "HIP-1: Native token standard", url: "https://hyperliquid.gitbook.io/hyperliquid-docs/hyperliquid-improvement-proposals-hips/hip-1-native-token-standard", note: "The native token standard: a capped supply, what the deployer sets at genesis, the deploy gas auction, and spot trading and fees." }
  - { title: "HIP-2: Hyperliquidity", url: "https://hyperliquid.gitbook.io/hyperliquid-docs/hyperliquid-improvement-proposals-hips/hip-2-hyperliquidity", note: "Hyperliquidity, a strategy inspired by Uniswap but quoting on the order book, which gives a new token liquidity while its price is found." }
  - { title: Deploying HIP-1 and HIP-2 assets, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/deploying-hip-1-and-hip-2-assets", note: "The deployment API: the spotDeploy actions to send, in order, from registering the token to genesis and the spot pair." }
  - { title: Permissionless spot quote assets, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/hypercore/permissionless-spot-quote-assets", note: "What a token needs to become a spot quote asset: a peg to 1 USD, 200k HYPE staked and open to slashing, set decimals, and liquidity on the book." }
  - { title: Aligned quote assets, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/hypercore/aligned-quote-assets", note: "Aligned stablecoins: an opt-in setting in which a stablecoin issuer shares its upside with the protocol in return for its reach." }
build:
  - { label: Hyperliquidity price ladder, kind: workbench }
---

This track covers launching a token on HyperCore. HIP-1 defines the token and its deploy auction; HIP-2 gives it an automatic market from day one. No good outside tutorial exists yet, so this is one of the gaps a full lesson here will fill; until then, start with the official docs.
