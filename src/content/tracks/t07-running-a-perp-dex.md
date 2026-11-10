---
order: 7
stage: Deploying markets
code: T7
title: Running a perp DEX
seoTitle: "Run a HIP-3 perp DEX on Hyperliquid"
summary: What a HIP-3 deployer must do around the clock, how sub-deployer keys work, and how real DEXs price assets when markets are closed.
depth: lesson
verified: 2026-10-22
docs:
  - { title: "HIP-3: Builder-deployed perpetuals", url: "https://hyperliquid.gitbook.io/hyperliquid-docs/hyperliquid-improvement-proposals-hips/hip-3-builder-deployed-perpetuals" }
  - { title: HIP-3 deployer actions, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/hip-3-deployer-actions" }
  - { title: Oracle, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/hypercore/oracle" }
outside:
  - { title: HIP-3 and the trust boundary, url: "https://chainstack.com/hyperliquid-hip3-builder-deployed-perpetuals-trust-boundary/", by: Chainstack, note: "What HIP-3 hands the builder and what HyperCore keeps, step by step through deployment and the perpDeploy action, with a testnet lab." }
  - { title: "How trade[XYZ] builds its oracle price", url: "https://docs.trade.xyz/perpetuals/mechanics/oracle-price", by: "trade[XYZ]", note: "How one live HIP-3 DEX builds its oracle price, from external and internal sources." }
  - { title: hyperkeeper, an open-source oracle keeper, url: "https://github.com/vignesh-chaturvedi/hyperkeeper", by: Vignesh Chaturvedi, note: "Open-source operations for HIP-3 and HIP-4 deployers: oracle updates with failover, and HIP-4 settlement." }
  - { title: "HIP-3 from the builder's side", url: "https://blocksec.com/blog/deep-dive-into-hip-3-a-builder-centric-perspective", by: BlockSec, note: "The launch flow, pricing and solvency, slashing, and the risks of misset parameters and outside oracles, with controls for each." }
  - { title: "What is HIP-3?", url: "https://www.dwellir.com/blog/hyperliquid-hip-3-explained", by: Dwellir, note: "The life of a HIP-3 market, from staking and the deploy auction to running the oracle, and what the deployer controls." }
build:
  - { label: Oracle duty simulator, kind: workbench }
  - { label: Oracle keeper in shadow mode, kind: project }
---

## What a deployer signs up for

HIP-3 lets anyone list perps on HyperCore, with its order books and margining, by running their own **perp DEX**. The deployer defines each market (what the oracle tracks, the contract terms) and then operates it: setting oracle prices, leverage limits, and settling the market when needed.

- **Stake:** 500k HYPE on mainnet, kept for at least 183 days after the DEX is deployed. One DEX per deployer.
- **Collateral:** any quote asset.
- **Listings:** the first 3 assets are free. More go through a Dutch auction shared by all DEXs, priced like HIP-1 token auctions.
- **Fees:** the deployer sets a fee share from 0 to 300% (0 to 100% in growth mode).
- **Slashing:** validators can vote to slash the stake for irregular inputs. That means up to 100% for invalid state transitions or long outages, and up to 50% for brief downtime. It doesn't matter whether the cause was malice, a bad spec or a stolen key, and stake stays slashable during the 7-day unstaking queue.

## Who runs a DEX today

Mainnet had 10 HIP-3 DEXs on Oct 21, 2026. Almost all the volume trades stocks, indices, commodities and pre-IPO valuations rather than crypto.

| DEX | Run by | Assets listed | 24h volume |
|---|---|---|---|
| `xyz` | trade[XYZ] | 135 | $4,615M |
| `io` | EntropyIO | 13 | $114M |
| `para` | Paragon | 38 | $9.3M |
| `mkts` | Markets by Kinetiq | 24 | $5.5M |
| `flx`, `vntl`, `hyna`, `km`, `abcd`, `cash` | Felix, Ventuals, HyENA, Kinetiq, ABCDEx, dreamcash | 1–25 each | about $0 |

`perpDexs` lists every DEX with its deployer, oracle updater, fee recipient, sub-deployer grants and per-asset settings.

## The deployer's actions

Every action is an L1 action of type `perpDeploy` ([T3](/tracks/t03-signing-and-sending/)). **Every list of pairs must be sorted by its first element before signing.**

| Action | What it does |
|---|---|
| `registerAsset2` | Creates the DEX (name: 2–4 lower-case letters) and its first asset. The `schema` sets the full name, collateral token and an optional oracle updater. |
| `registerAsset` | Adds another asset |
| `setOracle` | Pushes prices, the job that never stops (below) |
| `setFundingMultipliers`, `setFundingInterestRates`, `setFundingClamps` | Tune funding per asset: multipliers 0 to 10, clamps 0 to 1% |
| `insertMarginTable`, `setMarginTableIds`, `setMarginModes` | Leverage tiers, and isolated-only or cross margin per asset |
| `setOpenInterestCaps` | Cap open interest per asset |
| `haltTrading` | Settle an asset at the mark price, or resume it |
| `setSubDeployers` | Let another key send specific actions |
| `setFeeRecipient`, `setDeployerFees`, `setPerpAnnotation`, `disableDex` | Fees, display metadata, shutting the DEX down |

## The oracle duty

A HIP-3 DEX doesn't get oracle prices from validators the way the main perps do. The deployer has to push them, with `setOracle`:

```json
{
  "type": "perpDeploy",
  "setOracle": {
    "dex": "abc",
    "oraclePxs": [["abc:BTC", "84712.9"], ["abc:ETH", "2515.3"]],
    "markPxs": [[["abc:BTC", "84674"], ["abc:ETH", "2514.9"]]],
    "externalPerpPxs": [["abc:BTC", "84680"], ["abc:ETH", "2515"]]
  }
}
```

The rules:
- **Send every 3 seconds, even when nothing changed.** Calls must be at least 2.5 seconds apart.
- **After 10 seconds without an update**, marks fall back to the local mark: the median of best bid, best ask and last trade. The docs are explicit that you shouldn't rely on this.
- **`externalPerpPxs` must include every asset.** It stops the mark from jumping suddenly. Ideally it comes from outside sources; an average of recent marks is the fallback.
- **`markPxs` holds zero, one or two lists.** Their median, together with the local mark, becomes the new mark price.
- **Clamps limit the damage.** Every price is clamped to 10× the day's starting value, and each mark move to 1% from the previous mark.

## Keep the deployer key cold

The deployer key controls the stake, so it shouldn't sit on a server signing every 3 seconds. Hand the work to other keys instead:

- **An oracle updater:** set in the DEX's schema when it's created.
- **Sub-deployers:** `setSubDeployers` grants one key one action. For example, `{ "variant": "setOracle", "user": "0x…", "allowed": true }`.

trade[XYZ] works this way. On Oct 22, 2026 its `xyz` DEX had 11 sub-deployer grants, and `setOracle` was granted to a single dedicated key.

**HIP-3\* venues** are permissioned DEXs (testnet only) with an allowlist of users. They push only spot oracle prices, through a `star` operation; the external and mark prices are derived on-chain. Their grants are separate: `{ "hip3Star": "setOracle" }`. The ordinary `setOracle` grant, even the oracle updater's, doesn't cover it.

## Pricing when the market is closed

A stock perp trades around the clock, but the stock doesn't. trade[XYZ]'s [oracle method](https://docs.trade.xyz/perpetuals/mechanics/oracle-price) handles the gaps in two modes:

- **While the underlying trades:** an external fair price from several venues and data providers. US stocks count as open 24 hours on weekdays, including pre-market, after-hours and an overnight session on Blue Ocean ATS. Commodities run 23 hours on weekdays, FX 24.
- **When it doesn't:** the oracle follows trade[XYZ]'s own order book, through a moving average with a 30-minute time constant driven by the gap between the oracle and the book's impact prices. The external price stays frozen at the last close until the market reopens.

## What it looks like in practice

[hyperkeeper](https://github.com/vignesh-chaturvedi/hyperkeeper) watches DEX oracles from the outside:
- **Mainnet, Oct 9, 2026:** `xyz`, `para` and `io` pushed `setOracle` every 3.0 seconds, as the rules ask. `mkts` pushed about every 3.9 seconds, and the dormant DEXs not at all.
- **Testnet `ignp` (HIP-3\*):** its key sent an update about every 12 seconds. Over 24.7 hours, a standby key set to take over after 15 seconds of silence would have stepped in 34 times; the longest gap was 96 seconds.

The fix is a second key with the same grant, running somewhere else, that sends only while the first is silent.

## Ending a market

`haltTrading` cancels every order and settles every position at the current mark price. The same action resumes the asset, which lets you list dated contracts, one after another, without a new auction each time. Once every asset is settled, the stake can be unstaked.

## Cross margin and the backstop

Enabling cross margin on an asset is **irreversible**, and validators only allow it for assets with enough liquidity, a reliable external oracle, and resistance to manipulation. Each DEX also has an on-chain backstop liquidator at `0x400…00 + dex index`. It only takes over positions in cross-margin assets.
