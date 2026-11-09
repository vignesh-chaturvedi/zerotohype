---
order: 9
stage: Contracts and infra
code: T9
title: HyperEVM
summary: Smart contracts that read HyperCore through precompiles and act on it through CoreWriter, and the timing rules between the two layers.
depth: links
docs:
  - { title: Dual-block architecture, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/hyperevm/dual-block-architecture" }
  - { title: Interacting with HyperCore, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/hyperevm/interacting-with-hypercore" }
  - { title: Interaction timings, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/hyperevm/interaction-timings" }
  - { title: HyperCore and HyperEVM transfers, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/hyperevm/hypercore-less-than-greater-than-hyperevm-transfers" }
  - { title: JSON-RPC, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/hyperevm/json-rpc" }
  - { title: Wrapped HYPE, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/hyperevm/wrapped-hype" }
outside:
  - { title: Precompiles, CoreWriter and the bridge, url: "https://chainstack.com/hyperliquid-hyperevm-precompiles-corewriter-bridge/", by: Chainstack }
  - { title: CoreWriter reference, url: "https://docs.chainstack.com/docs/hyperliquid-corewriter", by: Chainstack }
  - { title: Read HyperCore oracle prices in a contract, url: "https://www.quicknode.com/guides/hyperliquid/read-hypercore-oracle-prices-in-hyperevm", by: QuickNode }
  - { title: /evm versus /nanoreth, url: "https://chainstack.com/hyperevm-evm-vs-nanoreth/", by: Chainstack }
build:
  - { label: CoreWriter encoder, kind: lab }
  - { label: CoreWriter vault with Foundry, kind: project }
---

This track is for Solidity developers. HyperEVM contracts read HyperCore state through precompiles and act on it through the CoreWriter system contract, with timing rules that differ from a normal EVM chain. Until its full lesson is written, this track is a reading list.
