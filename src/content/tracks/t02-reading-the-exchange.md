---
order: 2
stage: Foundations
code: T2
title: Reading the exchange
seoTitle: "Reading Hyperliquid market data: info API and WebSocket"
summary: Every number a bot or dashboard needs, from the info endpoint and WebSocket feeds, with the rules for asset IDs, decimals and rate limits.
depth: lesson
verified: 2026-10-22
docs:
  - { title: Info endpoint, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint" }
  - { title: Info endpoint for perpetuals, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/perpetuals" }
  - { title: Info endpoint for spot, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/spot" }
  - { title: Asset IDs, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/asset-ids" }
  - { title: Tick and lot size, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/tick-and-lot-size" }
  - { title: WebSocket subscriptions, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/websocket/subscriptions" }
  - { title: Rate limits and user limits, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/rate-limits-and-user-limits" }
  - { title: Historical data, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/historical-data" }
outside:
  - { title: Build a real-time portfolio tracker, url: "https://www.quicknode.com/guides/hyperliquid/build-portfolio-tracker-using-hypercore-data", by: QuickNode, note: "A live portfolio tracker built on HyperCore data, from its architecture to running it." }
  - { title: Order book levels L1 to L4, url: "https://www.quicknode.com/guides/hyperliquid/hyperliquid-order-book-depth-l1-l2-l3-l4", by: QuickNode, note: "The four resolutions of the order book, which stream gives each, and how to read them in JavaScript." }
  - { title: Query balances for many wallets, url: "https://www.quicknode.com/guides/hyperliquid/query-balances-for-multiple-wallets", by: QuickNode, note: "Balances for many wallets at once with batched requests, and which method suits which job." }
build:
  - { label: Live order book in the browser, kind: lab }
  - { label: Tick and lot rounding, kind: workbench }
---

## Ask with one request type

Everything public goes through `POST /info` with a JSON body naming a `type`. No key or signature is needed, and browsers may call it directly from any site. These are the requests most projects start with, all checked against mainnet on Oct 22, 2026:

| Request | Returns | Weight |
|---|---|---|
| `allMids` | Mid price of every coin | 2 |
| `l2Book` (`coin`) | Order book levels for one coin | 2 |
| `clearinghouseState` (`user`) | An account's margin, positions and withdrawable balance | 2 |
| `meta` | Perp universe: names, `szDecimals`, max leverage | 20 |
| `metaAndAssetCtxs` | `meta` plus live oracle, mark, mid, funding and open interest per perp | 20 |
| `openOrders` (`user`) | Resting orders | 20 |
| `userFills` (`user`) | Up to 2,000 most recent fills | 20, plus more per 20 fills |
| `candleSnapshot` | Candles for a coin and interval | 20, plus more per 60 candles |
| `fundingHistory` | Funding rates over time | 20, plus more per 20 items |
| `spotMeta`, `spotMetaAndAssetCtxs` | Spot tokens and pairs, with live prices | 20 |
| `perpDexs` | Every HIP-3 DEX, its deployer and settings | 20 |
| `outcomeMeta` | Every HIP-4 outcome and question | 20 |

Requests about a HIP-3 DEX take a `dex` field. `{"type":"meta","dex":"xyz"}` returns trade[XYZ]'s perps, named `xyz:XYZ100` and so on.

## Every market type names its assets differently

Orders refer to assets by number, and each market type numbers them its own way.

| Market | Asset ID | Coin name |
|---|---|---|
| Perp on the main DEX | Index in `meta.universe` (BTC is 0 on mainnet) | `BTC` |
| Perp on a HIP-3 DEX | `100000 + dex index × 10000 + index in that DEX's meta` | `xyz:XYZ100` |
| Spot pair | `10000 + index` of the pair in `spotMeta.universe` | `PURR/USDC`, or `@107` |
| Outcome side | `100000000 + 10 × outcome + side` | `#10` for outcome 1, side 0 |

Spot pair IDs are not token IDs. On mainnet HYPE is token 150 but spot pair 107, and testnet uses different numbers for both.

> **Watch out.** In `spotMetaAndAssetCtxs`, the list of price contexts is longer than the list of pairs and does not stay in the same order. On Oct 22, 2026 the two stopped lining up at position 71 on mainnet and at position 4 on testnet. Match each context to its pair by `coin`, never by position.

## Prices and sizes have strict precision

The exchange rejects an order whose numbers have too much precision.

- **Price:** at most 5 significant figures, and at most `6 − szDecimals` decimal places for perps (`8 − szDecimals` for spot). Whole-number prices are always allowed.
- **Size:** rounded to `szDecimals`, which comes from `meta` or `spotMeta`.
- **Value:** an order must be worth at least $10, or 10 of the quote token on spot.

For example, `1234.5` is a valid price but `1234.56` isn't, because it has six significant figures.

## Stream instead of polling

Use the WebSocket for anything live. Subscribe with one message per feed:

```json
{ "method": "subscribe", "subscription": { "type": "trades", "coin": "BTC" } }
```

The server answers each subscription with a `subscriptionResponse`. A subscription the server doesn't recognise gets an `error` message instead and then stays silent, so check for both. These subscriptions answered on mainnet on Oct 22, 2026: `allMids`, `l2Book`, `trades`, `bbo`, `candle`, `activeAssetCtx` and `userFills`.

Servers disconnect clients now and then without warning. Reconnect automatically; the first message after you resubscribe is a snapshot covering what you missed.

## Stay inside the limits

Per IP address:
- **HTTP:** 1,200 weight a minute. Most info requests weigh 20; the cheap ones are in the table above.
- **WebSocket:** 10 connections, 30 new connections a minute, 1,000 subscriptions, 10 different users across user feeds, and 2,000 messages a minute.
- **HyperEVM RPC:** 100 requests a minute on the public endpoint.

Per address, every account starts with 10,000 requests and earns one more for each 1 USDC it trades. Accounts may hold up to 1,000 open orders by default.

## History is short

The API keeps only recent history:
- **Candles:** the most recent 5,000 per interval. For 1-minute candles that's about three and a half days.
- **Fills:** at most 2,000 per response, and only the 10,000 most recent fills at all.

For anything older, use the [historical data](https://hyperliquid.gitbook.io/hyperliquid-docs/historical-data) archives, a node ([T10](/tracks/t10-infra-and-data/)), or record it yourself as you go.
