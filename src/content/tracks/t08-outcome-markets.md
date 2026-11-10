---
order: 8
stage: Deploying markets
code: T8
title: Outcome markets
seoTitle: "Hyperliquid HIP-4 outcome markets: how settlement works"
summary: HIP-4 templates, how markets settle, and what "TWAP" means at each venue. No tutorial covers settlement yet.
depth: lesson
verified: 2026-10-22
docs:
  - { title: "HIP-4: Outcome markets", url: "https://hyperliquid.gitbook.io/hyperliquid-docs/hyperliquid-improvement-proposals-hips/hip-4-outcome-markets" }
  - { title: HIP-4 deployer actions, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/hip-4-deployer-actions" }
outside:
  - { title: Trade HIP-4 prediction markets, url: "https://www.quicknode.com/guides/hyperliquid/trade-hip-4-prediction-markets-on-hyperliquid", by: QuickNode, note: "What outcome markets are, their data model, and how to read prices as implied probabilities." }
  - { title: "HIP-4 settlement checks, Oct 8–13", url: "https://github.com/vignesh-chaturvedi/hyperkeeper/blob/main/reports/2026-10-13-hip4.md", by: hyperkeeper, note: "The checks behind this lesson: HIP-4 settlements from 8 to 13 Oct, recomputed from recorded prices, and the three that didn't match." }
build:
  - { label: Settlement explorer, kind: lab, status: live, href: "/labs/settlement/" }
  - { label: Settlement checker, kind: project }
---

## What an outcome is

An outcome is a fully collateralised contract that settles somewhere in a fixed range. There's no leverage and no liquidation.

- **Two sides, two tokens.** Usually Yes and No. At settlement each Yes token becomes `settleFraction` of the quote token, and each No token becomes `1 − settleFraction`. A binary market settles to 1 or 0; a scalar one can settle anywhere in between.
- **One merged book.** Buying Yes at `p` is the same order as selling No at `1 − p`, so both sides share liquidity.
- **Questions.** A question groups outcomes where exactly one will settle Yes, such as "who wins". An extra "other" outcome is created automatically as the fallback.
- **Addressing.** Outcome side tokens are named `#` plus `10 × outcome + side` (see [T2](/tracks/t02-reading-the-exchange/)). `outcomeMeta` lists every outcome and question.

On mainnet on Oct 21, 2026, three venues were deploying markets: `out` (Outcome, 159 live outcomes), `txyz` (trade[XYZ] Events, 64) and `skew` (Skew, 61). There was also Hyperliquid's own recurring daily BTC market, which has no venue.

## Every market comes from a template

Validators vote on templates, and deployers instantiate them. A template fixes the display text, the side names and a set of typed keywords, plus a `semanticRestriction` that says what markets made from it may mean. A market that contradicts its restriction can get its deployer slashed.

- `{"type":"outcomeTemplates"}` returns them all: 28 on mainnet and 68 on testnet on Oct 21, 2026. Testnet's extras are numbered drafts such as `binaryPrice6`.
- The mainnet templates cover prices, sports, central-bank rate decisions, awards, IPOs and AI model match-ups.
- An instantiated market is named `template:<id>`. Its description is the keyword values, sorted and joined:

```text
name:        template:binaryPrice
description: perp:BTC|priceDescription:BTC-USDC perp mark|seconds:60|threshold:85734|time:20261005-0600
```

The four price templates on mainnet:

| Template | Resolves |
|---|---|
| `binaryPrice` | Yes if the `{seconds}`-second TWAP of `{priceDescription}` ending at `{time}` is above `{threshold}`. Strictly above: equal settles No. |
| `priceTouch` | Yes as soon as that TWAP, taken over a rolling window, equals or crosses `{target}`, at any time before `{time}`. It can settle the moment it touches. |
| `scalarPrice` | The Long side pays `(price − low) / (high − low)`, clamped to between 0 and 1 |
| `binaryPriceExternal` | Like `binaryPrice`, priced from an outside feed. Settles at 0.5 if no settlement price can be verified within 24 hours. |

## How a market settles

The venue settles each outcome with an `outcomeDeploy` action (an L1 action, [T3](/tracks/t03-signing-and-sending/)):

```json
{
  "type": "outcomeDeploy",
  "venue": "ab",
  "operation": {
    "settleOutcome": {
      "outcome": 7,
      "settleFraction": "1",
      "details": "",
      "nameAndDescription": ["template:abc", "expiry:20260801-0600|target:100|underlying:ABC"],
      "sideNames": ["template:Over", "template:Under"]
    }
  }
}
```

- `nameAndDescription` and `sideNames` must match the outcome exactly, and `details` must be empty.
- Outcomes in a question settle to exactly 0 or 1. `settleQuestion2` settles every remaining one at once.

To read a result, call `{"type":"settledOutcome","outcome":7}`. It returns `null` until the outcome settles, then its `settleFraction` and the original spec.

## What "TWAP" means depends on the venue

The template says "TWAP of {priceDescription}" and stops there. It doesn't say where the samples come from or how they're weighted. [hyperkeeper](https://github.com/vignesh-chaturvedi/hyperkeeper) has recomputed every mainnet price market since Oct 8, 2026 and compared its answer with each venue's settlement.

| Venue | Settles on | Window | Venue settled after (median) | Match, Oct 8 to Nov 6 |
|---|---|---|---|---|
| `out` | Mark price, sampled live | 60 s | 31 s | 8,585 of 8,600 |
| `skew` | BTC trades, sampled live | 90 s | 44 s | 1,360 of 1,368 |
| `txyz` | 1-minute candle closes | 300 s | 24 min | 598 of 601 |

What that taught us:

- **Mark and trade prices have no public history.** To recompute those markets you have to record the WebSocket feed from before each window opens. Candles are public, but only the most recent 5,000.
- **Skew's trade average is volume-weighted.** From Oct 13 to Nov 6, a time-weighted average of BTC trades missed 5 of Skew's 1,121 markets. A volume-weighted one matched all of them.
- **Drop replayed trades.** After a reconnect, the trades feed resends its last 30 or so trades. That happened in 13 of those 1,121 windows. Drop the repeats (each trade has a unique `tid`) and sort by time before you weight anything.
- **Some misses can't be helped.** All 15 of `out`'s misses were within 0.25 bp of the threshold. Sampling the mark about once a second can't separate cases that close.
- **Candle markets can miss too.** Three `txyz` markets missed by about 3 bp, each at the US stock open or close. Their candles had dropped out of the API before we checked, so the cause is still open.
- **Settling fast is a real job.** `txyz` usually took 12 to 85 minutes, but whole batches have waited 3 to 4 hours, and two markets waited 17. One of Outcome's `priceTouch` markets, oil reaching 100, touched at 00:16 UTC on Oct 17 and settled at 06:42 UTC. Both results were knowable within seconds.

## Running a venue

- **Activate.** Send `activateOutcomeDeployer` with a venue name of 2–4 lower-case letters. The name must be unique, even against HIP-3 DEX names, and it stays reserved forever.
- **Stake.** Keep the staking requirement for as long as the venue is active. Stake used for HIP-3 doesn't count twice. The account must use Standard account abstraction.
- **Deploy.** There's no gas cost. Instead, a venue may hold at most `N` active outcomes and deploy `M` a day; the docs give 10 and 50 for testnet.
- **Fees.** Each market carries a `deployerFeeScale` from 0 to 10. Traders pay the base rate times `scale + max(scale, 1)`; the deployer gets the `scale` part.
- **Delegate.** `setSubDeployers` lets another key register markets or settle them for you, only for your venue. A settlement bot should hold just the `settleOutcome` grant.
- **Leave.** Deactivating takes at least 183 days and no active outcomes, and it's permanent.

The deployer-actions page in the docs is still marked testnet-only, though the three venues above deploy and settle on mainnet.
