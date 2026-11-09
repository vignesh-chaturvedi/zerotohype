---
order: 5
stage: Trading
code: T5
title: Building on order flow
summary: How a third-party app earns from and manages trading. Builder codes, referrals, sub-accounts, vaults and multi-sig.
depth: lesson
verified: 2026-11-09
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
## What a builder code is

An app that sends orders for its users can charge a fee on their fills, on top of the exchange's. That's a **builder code**: "builder" means the app's developer, not a block builder. The fee is set order by order and settled on-chain with the rest of the fees.

- **The user approves it first.** Each user approves a maximum fee for your app's address, and can revoke it at any time. A user can have 10 approvals active at once.
- **Each order names you.** The order carries your address and the fee for that order, up to what the user approved.
- **It has caps.** At most 0.1% on perps and 1% on spot. It only applies where the exchange takes its fee in the quote or collateral asset: both sides of a perp trade, but only the selling side of a spot trade.

## Step 1: the user approves a maximum fee

`approveBuilderFee` is a user-signed action ([T3](/tracks/t03-signing-and-sending/#two-signing-schemes)), so the user signs it with their own key; an API wallet can't. The maximum is a percentage string:

```json
{
  "type": "approveBuilderFee",
  "hyperliquidChain": "Testnet",
  "signatureChainId": "0x66eee",
  "maxFeeRate": "0.01%",
  "builder": "0x…",
  "nonce": 1794230000000
}
```

The typed data is `HyperliquidTransaction:ApproveBuilderFee`, with `hyperliquidChain`, `maxFeeRate`, `builder` and `nonce`, and the action's `nonce` must match the request's. Dwellir's guide revokes an approval by signing the same action with a maximum of `0%`.

## Step 2: each order names the builder and its fee

The order action takes a `builder` beside `orders` and `grouping`:

```json
{
  "type": "order",
  "orders": [ ... ],
  "grouping": "na",
  "builder": { "b": "0x…", "f": 10 }
}
```

- **`f` is in tenths of a basis point.** 10 is 1 bp, or 0.01%. The caps are 100 on perps and 1,000 on spot.
- **The builder is signed with the order.** If you build the action yourself, write the address in lower case: a checksummed one makes the exchange recover another address ([API errors](/errors/#encoding)). The SDKs below handle it for you.

## Step 3: check the approval before you send

An order can't charge more than the user approved, so ask first. `maxBuilderFee` returns the approved maximum for your address in tenths of a basis point: 10 for `0.01%`, and 0 if the user hasn't approved you.

```json
{ "type": "maxBuilderFee", "user": "0x…", "builder": "0x…" }
```

All three steps, in each SDK:

```python
from eth_account import Account
from hyperliquid.exchange import Exchange
from hyperliquid.utils import constants

BUILDER = "0x..."  # your app's builder address
user = Account.from_key("0x...")  # the user's own key, not an API wallet; testnet only
ex = Exchange(user, constants.TESTNET_API_URL)

# 1. The user approves a fee of up to 0.01% (1 basis point) for your app.
ex.approve_builder_fee(BUILDER, "0.01%")

# 2. Before each order, check the approval. It's in tenths of a basis point: 10 is 1 bp.
approved = ex.info.post("/info", {"type": "maxBuilderFee", "user": user.address, "builder": BUILDER})

# 3. The order names your app and its fee, here the full 1 bp.
if approved >= 10:
    ex.order("ETH", True, 0.02, 1000, {"limit": {"tif": "Gtc"}}, builder={"b": BUILDER, "f": 10})
```

```ts
import { ExchangeClient, HttpTransport, InfoClient } from "@nktkas/hyperliquid";
import { privateKeyToAccount } from "viem/accounts";

const BUILDER = "0x..."; // your app's builder address
const user = privateKeyToAccount("0x..."); // the user's own key, not an API wallet; testnet only
const transport = new HttpTransport({ isTestnet: true });
const exchange = new ExchangeClient({ transport, wallet: user });
const info = new InfoClient({ transport });

// 1. The user approves a fee of up to 0.01% (1 basis point) for your app.
await exchange.approveBuilderFee({ builder: BUILDER, maxFeeRate: "0.01%" });

// 2. Before each order, check the approval. It's in tenths of a basis point: 10 is 1 bp.
const approved = await info.maxBuilderFee({ user: user.address, builder: BUILDER });

// 3. The order names your app and its fee, here the full 1 bp.
if (approved >= 10) {
  const eth = (await info.meta()).universe.findIndex((asset) => asset.name === "ETH");
  await exchange.order({
    orders: [{ a: eth, b: true, p: "1000", s: "0.02", r: false, t: { limit: { tif: "Gtc" } } }],
    grouping: "na",
    builder: { b: BUILDER, f: 10 },
  });
}
```

```rust
use hypersdk::Address;
use hypersdk::hypercore::{
    self, Builder, Cloid, NonceHandler, PrivateKeySigner,
    types::{BatchOrder, OrderGrouping, OrderRequest, OrderTypePlacement, TimeInForce},
};
use rust_decimal::dec;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let builder: Address = "0x...".parse()?; // your app's builder address
    let user: PrivateKeySigner = "0x...".parse()?; // the user's own key, not an API wallet; testnet only
    let client = hypercore::testnet();
    let nonce = NonceHandler::default();

    // 1. The user approves a fee of up to 0.01% (1 basis point) for your app.
    client.approve_builder_fee(&user, builder, "0.01%".into(), nonce.next()).await?;

    // 2. Before each order, check the approval. It's in tenths of a basis point: 10 is 1 bp.
    let approved = client.max_builder_fee(user.address(), builder).await?;

    // 3. The order names your app and its fee, here the full 1 bp.
    if approved >= 10 {
        let eth = client.perps().await?.into_iter().find(|p| p.name == "ETH").expect("ETH is listed");
        let order = OrderRequest {
            asset: eth.index,
            is_buy: true,
            limit_px: dec!(1000),
            sz: dec!(0.02),
            reduce_only: false,
            order_type: OrderTypePlacement::Limit { tif: TimeInForce::Gtc },
            cloid: Cloid::random(),
        };
        let builder = Some(Builder { builder_address: builder, fee: 10 });
        let batch = BatchOrder { orders: vec![order], grouping: OrderGrouping::Na, builder };
        client.place(&user, batch, nonce.next(), None, None).await?;
    }
    Ok(())
}
```

We ran all three on testnet on Nov 9, 2026, with the same SDK versions as [T1](/tracks/t01-orientation/#your-first-order) and a brand-new key as the user. The approval and the order were both turned down, because the key had no account, but the exchange named that key each time: each SDK signs both actions correctly, even with a checksummed builder address.

## What your app needs

- **An account that qualifies.** The builder address needs at least 100 USDC of perps account value, and the standard [account abstraction mode](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/account-abstraction-modes).
- **To claim what it earns.** Builder fees build up as rewards, the way referral rewards do. `{"type": "referral", "user": "0x…"}` shows them as `builderRewards`, beside `unclaimedRewards` and `claimedRewards`, and the `claimRewards` action claims them into your spot balance.
- **Its fills, from a public file.** Each day's fills with your code are published as LZ4-compressed CSV at `https://stats-data.hyperliquid.xyz/Mainnet/builder_fills/{builder}/{YYYYMMDD}.csv.lz4`, one row per fill, from `time`, `user` and `coin` to `closed_pnl` and `builder_fee`. The address must be in lower case: on Nov 9, 2026 a checksummed one got HTTP 403. One busy app's file for Nov 8 held 233,311 fills.

## Referral codes

The other way to earn from the traders you bring:

- **Get a code** after $10,000 of your own volume, and share it as `app.hyperliquid.xyz/join/YOURCODE`.
- **You earn** 10% of each referred user's fees, less their discount, on their first $1B of volume.
- **They get** 4% off their fees on their first $25M. The discount doesn't apply to their vaults or sub-accounts, which count as separate accounts.
- **Rewards** build up in every quote asset and can be claimed once they pass $1. Like builder fees, they land in your spot balance.

Sub-accounts, vaults and multi-sig, the rest of this track, are in its reading list for now.
