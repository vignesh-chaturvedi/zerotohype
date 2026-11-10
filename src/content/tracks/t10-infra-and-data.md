---
order: 10
stage: Contracts and infra
code: T10
title: Infra and data
seoTitle: "Hyperliquid nodes, L1 data and the explorer API"
summary: Running a node, reading raw L1 data, and the explorer API that shows each address's transactions and errors.
depth: links
docs:
  - { title: Nodes, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/nodes", note: "Where to start: the hyperliquid-dex/node repository has the steps for non-validating and validating nodes." }
  - { title: L1 data schemas, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/nodes/l1-data-schemas", note: "What a node writes to ~/hl/data, about 100 GB of logs a day: transaction blocks, state snapshots and optional extra outputs." }
  - { title: Foundation non-validating node, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/nodes/foundation-non-validating-node", note: "The Foundation's non-validating node: what it's for, who's eligible and how to apply." }
  - { title: Running a validator, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/validators/running-a-validator", note: "Running a node is permissionless; the active validator set is the top 27 by stake." }
outside:
  - { title: Run a node with QuickNode peering, url: "https://www.quicknode.com/guides/hyperliquid/run-non-validating-node-with-quicknode-peering", by: QuickNode, note: "A non-validating node peered through QuickNode: sizing the host, choosing outputs, starting it and checking it's in sync." }
  - { title: Real-time whale alert bot, url: "https://www.quicknode.com/guides/hyperliquid/real-time-hyperliquid-whale-alert-bot", by: QuickNode, note: "Large trades turned into Telegram alerts with QuickNode Streams and a small webhook server." }
build:
  - { label: The explorer API, kind: guide }
---

This track is for anyone who needs data the public API doesn't serve: full history, every fill, or another address's transactions and errors. Until its full lesson is written, this track is a reading list.
