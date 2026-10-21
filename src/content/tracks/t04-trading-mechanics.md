---
order: 4
stage: Trading
code: T4
title: Trading mechanics
summary: How the clearinghouse prices, margins, funds and liquidates positions. Most of it is formulas, so most of it becomes workbenches.
depth: lesson
verified: 2026-10-22
docs:
  - { title: Order types, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/trading/order-types" }
  - { title: Take profit and stop loss, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/trading/take-profit-and-stop-loss-orders-tp-sl" }
  - { title: Margining, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/trading/margining" }
  - { title: Portfolio margin, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/trading/portfolio-margin" }
  - { title: Margin tiers, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/trading/margin-tiers" }
  - { title: Liquidations, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/trading/liquidations" }
  - { title: Auto-deleveraging, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/trading/auto-deleveraging" }
  - { title: Funding, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/trading/funding" }
  - { title: Robust price indices, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/trading/robust-price-indices" }
  - { title: Fees, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/trading/fees" }
  - { title: Self-trade prevention, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/trading/self-trade-prevention" }
  - { title: Entry price and pnl, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/trading/entry-price-and-pnl" }
outside:
  - { title: Monitor TP/SL trigger orders, url: "https://www.quicknode.com/guides/hyperliquid/monitor-tpsl-trigger-orders-stream-hyperliquid", by: QuickNode }
build:
  - { label: Funding and mark price, kind: lab, status: live, href: "/labs/funding/" }
  - { label: Margin and liquidation price, kind: workbench }
  - { label: Fee tier, kind: workbench }
  - { label: Funding-rate scanner, kind: project }
---

## Three prices, three jobs

Every perp has three prices, and each one drives something different.

- **Oracle price** drives funding. Validators publish it about every 3 seconds. Each validator takes a weighted median of spot prices from Binance (weight 3), OKX (2), Bybit (2), Kraken, KuCoin, Gate, MEXC and Hyperliquid (1 each). The final price is the median across validators, weighted by stake. It never reads Hyperliquid's own perp book, which is what makes it hard to manipulate.
- **Mark price** drives margin, liquidations, TP/SL triggers and unrealized pnl. It is the median of three estimates: the oracle plus a 150-second moving average of (Hyperliquid mid − oracle); the median of Hyperliquid's best bid, best ask and last trade; and a weighted median of perp mids on Binance (3), OKX (2), Bybit (2), Gate and MEXC (1 each). It updates whenever the oracle does.
- **Mid price** is the middle of Hyperliquid's own book.

`metaAndAssetCtxs` returns all of them. For BTC on Oct 22, 2026:

| Field | Value |
|---|---|
| `oraclePx` | 84,712.9 |
| `markPx` | 84,674.0 |
| `midPx` | 84,674.5 |
| `impactPxs` (bid, ask) | 84,674.0, 84,675.0 |
| `premium` | −0.0447% |
| `funding` (predicted, per hour) | 0.00054% |

## Funding, worked through

Funding is paid every hour, at one eighth of an 8-hour rate:

```text
F = average premium + clamp(interest − average premium, −0.05%, +0.05%)
interest = 0.01% per 8 hours
hourly payment = position size × oracle price × F / 8
```

- **The premium** compares Hyperliquid's book with the oracle, using impact prices: the average fill price for a set notional size on each side.

  ```text
  premium = (max(impact bid − oracle, 0) − max(oracle − impact ask, 0)) / oracle
  ```

  It's sampled every 5 seconds and averaged over the hour.
- **The payment** uses the oracle price, not the mark price.
- **The cap** is 4% an hour.

Check it with the BTC numbers above. The impact ask (84,675.0) is below the oracle (84,712.9), so the premium is (0 − 37.9) / 84,712.9 = **−0.0447%**, exactly the `premium` field.

The clamp explains the funding fields:
- **ETH:** its funding was 0.00125% an hour, the interest rate alone. Whenever the average premium sits within 0.05% of the interest rate, the clamp cancels it out.
- **BTC:** the hour's average premium had drifted below −0.04%, past the clamp. Its funding fell to 0.00054%.

HIP-3 DEXs use a more responsive premium, the middle of the two impact prices against the oracle, so deployers can tune funding with their own multipliers ([T7](/tracks/t07-running-a-perp-dex/)):

```text
premium (HIP-3) = (impact bid + impact ask) / 2 / oracle − 1
```

## Margin

- **Leverage** is any whole number from 1 to the asset's maximum. On Oct 22, 2026 that was 40× for BTC, 25× for ETH and 10× for HYPE.
- **Initial margin** to open a position is `size × mark price / leverage`. Leverage is only checked when you open; after that, watching it is your job.
- **Maintenance margin** is half the initial margin at maximum leverage: 1.25% of notional for BTC at 40×. Margin tiers raise it for large positions.
- **Cross margin**, the default, shares collateral across all cross positions. **Isolated** gives a position its own margin, which you can add to or remove after opening.
- **Unrealized pnl** can be withdrawn only if what's left still covers the initial margin, and is at least 10% of your total open notional.

## Liquidations

A cross account becomes liquidatable when its value falls below the maintenance margin of its open positions. An isolated position is judged on its own margin.

1. **On the book first.** Liquidations are sent as market orders, so anyone can take the flow and the trader keeps whatever margin remains. Positions over 100k USDC (10k on testnet) are liquidated 20% at a time.
2. **Backstop.** Below two-thirds of maintenance margin, the liquidator vault, part of HLP, takes over the position. The maintenance margin is not returned.
3. **Auto-deleveraging.** If an account's value still goes negative, positions on the other side are closed in order of unrealized pnl and leverage, keeping the exchange solvent.

The liquidation price for a position:

```text
liq price = price − side × margin available / size / (1 − l × side)
side = 1 for a long, −1 for a short;  l = 1 / maintenance leverage
margin available (cross) = account value − maintenance margin required
```

For a cross position, leverage doesn't change the liquidation price; lower leverage only locks more collateral. For isolated positions it does, because the margin set aside depends on it.

## Order types

| Type | What it does |
|---|---|
| Limit: GTC, IOC, ALO | Rest on the book, fill-or-cancel the rest, or post-only (see [T3](/tracks/t03-signing-and-sending/)) |
| Market | Executes now, at the best prices available |
| Stop and take (market or limit) | Activate at a trigger price. A stop to buy triggers above the mid; a take-profit to buy triggers below it. |
| TP/SL | Attached to a position; market orders unless you set a limit price |
| Trailing stop | Triggers when the mark price pulls back a set distance or percentage from its best level |
| TWAP | Splits a large order into suborders at least 30 seconds apart, each with at most 3% slippage |
| Scale, chase | Several limits across a range; a post-only order that follows the best bid or ask |

Any order can be **reduce-only**, so it can shrink a position but never open or flip one.

## Fees

Fee tiers depend on 14-day weighted volume, where spot volume counts double: `perps volume + 2 × spot volume`. Makers pay less than takers, and apps can add a builder fee on top of the exchange's ([T5](/tracks/t05-building-on-order-flow/)). The full tables and the fee function for developers are on the [fees page](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/fees).
