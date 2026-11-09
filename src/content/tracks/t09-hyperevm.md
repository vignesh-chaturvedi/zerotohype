---
order: 9
stage: Contracts and infra
code: T9
title: HyperEVM
summary: Smart contracts that read HyperCore through precompiles and act on it through CoreWriter, and the timing rules between the two layers.
depth: links
docs:
  - { title: Dual-block architecture, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/hyperevm/dual-block-architecture", note: "Why HyperEVM splits its throughput between small, fast blocks and large, slow ones." }
  - { title: Interacting with HyperCore, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/hyperevm/interacting-with-hypercore", note: "Reading HyperCore from a contract through the precompiles, and acting on it through the CoreWriter contract." }
  - { title: Interaction timings, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/hyperevm/interaction-timings", note: "When transfers between the two layers land, and the order things happen in within a HyperEVM block." }
  - { title: HyperCore and HyperEVM transfers, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/hyperevm/hypercore-less-than-greater-than-hyperevm-transfers", note: "Moving HYPE and spot tokens between HyperCore and HyperEVM: system addresses, linking an asset on both sides, gas and the caveats." }
  - { title: JSON-RPC, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/hyperevm/json-rpc", note: "The RPC methods HyperEVM supports, and which of them only work on the latest block." }
  - { title: Wrapped HYPE, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/hyperevm/wrapped-hype", note: "WHYPE, the canonical wrapped HYPE at 0x555…5: immutable, with the same code as WETH." }
outside:
  - { title: Precompiles, CoreWriter and the bridge, url: "https://chainstack.com/hyperliquid-hyperevm-precompiles-corewriter-bridge/", by: Chainstack, note: "Reading prices, positions and balances from Solidity, writing back through CoreWriter, and the timing traps between the two." }
  - { title: CoreWriter reference, url: "https://docs.chainstack.com/docs/hyperliquid-corewriter", by: Chainstack, note: "Orders, transfers and staking sent from a contract through CoreWriter, with a complete Solidity example." }
  - { title: Read HyperCore oracle prices in a contract, url: "https://www.quicknode.com/guides/hyperliquid/read-hypercore-oracle-prices-in-hyperevm", by: QuickNode, note: "A Foundry walkthrough that reads HyperCore oracle prices from a contract and deploys it." }
  - { title: /evm versus /nanoreth, url: "https://chainstack.com/hyperevm-evm-vs-nanoreth/", by: Chainstack, note: "The two RPC paths on a node: /evm for ordinary app traffic, /nanoreth for full blocks with system transactions." }
  - { title: "hyper-evm-lib", url: "https://github.com/hyperliquid-dev/hyper-evm-lib", by: hyperliquid-dev, note: "Libraries for every CoreWriter action and read precompile, decimal conversions and bridging between the layers, and a Foundry engine that simulates HyperCore in tests." }
build:
  - { label: CoreWriter encoder, kind: lab }
  - { label: CoreWriter vault with Foundry, kind: project }
---

This track is for Solidity developers. HyperEVM contracts read HyperCore state through precompiles and act on it through the CoreWriter system contract, with timing rules that differ from a normal EVM chain. Until its full lesson is written, this track is a reading list.
