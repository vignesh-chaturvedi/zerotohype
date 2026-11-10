---
order: 1
stage: Foundations
code: T1
title: Orientation
summary: What Hyperliquid is to a developer. Two execution layers share one state, the testnet has a faucet, and API keys can trade but never withdraw.
depth: lesson
verified: 2026-10-22
docs:
  - { title: HyperCore overview, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/hypercore/overview" }
  - { title: Testnet faucet, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/onboarding/testnet-faucet" }
  - { title: Nonces and API wallets, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/nonces-and-api-wallets" }
  - { title: How to use the HyperEVM, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/onboarding/how-to-use-the-hyperevm" }
outside:
  - { title: The Hyperliquid developer stack, url: "https://www.quicknode.com/blog/hyperliquid-developer-stack", by: QuickNode, note: "An overview of the stack, from HyperBFT to HyperCore and HyperEVM, and the ways to connect to each." }
  - { title: Agent wallets and the nonce state machine, url: "https://chainstack.com/hyperliquid-agent-wallets-nonce-state-machine/", by: Chainstack, note: "How an API wallet signs for its account and how its nonces work, with complete examples." }
  - { title: Developer guide to Hyperliquid and HyperEVM (video), url: "https://www.youtube.com/watch?v=ZESEkAKiJrg", by: Alchemy, note: "A video tour of HyperCore and HyperEVM for developers getting started." }
build:
  - { label: Get testnet funds and place one order, kind: guide }
---

## Two halves, one chain

Hyperliquid is one blockchain with two execution environments that share a single state.

- **HyperCore** is the exchange: order books, margin, matching, funding and liquidations, all on-chain. Every order goes through consensus, yet a client near the API servers sees a median of 0.2 s from sending an order to a committed result, and 0.9 s at the 99th percentile. Mainnet handles about 200,000 orders a second.
- **HyperEVM** is an ordinary EVM (the Cancun hard fork, without blobs) whose blocks are built inside the same execution, with HYPE as gas. Contracts read HyperCore state through precompiles and send it actions through a system contract called CoreWriter. That's [T9](/tracks/t09-hyperevm/).

Most of this roadmap is about HyperCore, because that's where the trading primitives live, and you talk to it with plain HTTP and WebSocket rather than smart contracts.

## The addresses you'll use

| Service | Mainnet | Testnet |
|---|---|---|
| HTTP API | `https://api.hyperliquid.xyz` | `https://api.hyperliquid-testnet.xyz` |
| WebSocket | `wss://api.hyperliquid.xyz/ws` | `wss://api.hyperliquid-testnet.xyz/ws` |
| HyperEVM JSON-RPC | `https://rpc.hyperliquid.xyz/evm` | `https://rpc.hyperliquid-testnet.xyz/evm` |
| HyperEVM chain ID | 999 | 998 |
| Web app | `app.hyperliquid.xyz` | `app.hyperliquid-testnet.xyz` |

The HTTP API has two endpoints. `/info` reads data and needs no signature; `/exchange` takes signed actions. Both take a `POST` with a JSON body. Your first call can be this:

```bash
curl -s https://api.hyperliquid-testnet.xyz/info \
  -H 'Content-Type: application/json' -d '{"type":"meta"}'
```

## Getting testnet funds

The testnet faucet only serves addresses that have deposited on mainnet. Once yours has, the faucet at `app.hyperliquid-testnet.xyz/drip` gives 1,000 mock USDC.

- If you sign in to the app with email, Privy creates a different address on each network. Export the mainnet wallet and import it into a wallet extension to use the same address on testnet.
- Testnet HYPE is harder to get. The faucet gives USDC only, and the third-party HYPE faucets we tried in October 2026 required a balance on mainnet.

## Your account and its API wallets

Your account is the address that holds the funds. Don't put that key in a bot. Instead, approve an **API wallet** (the docs also call it an agent wallet): a separate key that signs actions for your account or its sub-accounts.

- **It can trade, not withdraw.** Withdrawals are signed with the account's own key. The one transfer an API wallet may sign, `agentSendAsset`, has to send to the same address it comes from.
- **It only signs.** To read an account's balances, orders or fills, ask about the account's address. Asking about the API wallet's address returns nothing, a classic first-day bug.
- **Don't reuse one.** When an API wallet is replaced (approving a new unnamed one replaces the old unnamed one), expires, or its account runs out of funds, its nonce history can be pruned. Its old signed actions could then be replayed. Generate a fresh key each time.

## Nonces work differently

Ethereum makes every transaction use exactly the next nonce. That would break a market maker sending thousands of orders a second, so Hyperliquid does this instead:

- It keeps the 100 highest nonces each signer has used. A new action needs a nonce higher than the smallest of those, and never used before.
- The nonce must fall within two days before and one day after the block's timestamp, in milliseconds. In practice: use the current time in milliseconds.
- Nonces are tracked per signer. Two sub-accounts traded by one API wallet share its nonces, so give each trading process its own API wallet.

The docs suggest batching orders and cancels every 0.1 s, with one atomic counter per signer. Batches that contain only post-only (ALO) orders get priority from validators, so keep them separate from IOC and GTC orders.

## Your first order

With testnet USDC and an API wallet, place and cancel one order with an SDK before writing your own signing code. Here it is with the official Python SDK, [@nktkas/hyperliquid](https://github.com/nktkas/hyperliquid) for TypeScript, and [hypersdk](https://github.com/infinitefield/hypersdk) for Rust:

```python
from eth_account import Account
from hyperliquid.exchange import Exchange
from hyperliquid.utils import constants

agent = Account.from_key("0x...")  # an API wallet key, testnet only
ex = Exchange(agent, constants.TESTNET_API_URL, account_address="0xYourAccount")
res = ex.order("ETH", True, 0.02, 1000, {"limit": {"tif": "Gtc"}})  # $20, far below market
oid = res["response"]["data"]["statuses"][0]["resting"]["oid"]
ex.cancel("ETH", oid)
```

```ts
import { ExchangeClient, HttpTransport, InfoClient } from "@nktkas/hyperliquid";
import { privateKeyToAccount } from "viem/accounts";

const transport = new HttpTransport({ isTestnet: true });
const wallet = privateKeyToAccount("0x..."); // an API wallet key, testnet only
const exchange = new ExchangeClient({ transport, wallet });

const { universe } = await new InfoClient({ transport }).meta();
const eth = universe.findIndex((asset) => asset.name === "ETH");
const res = await exchange.order({
  orders: [{ a: eth, b: true, p: "1000", s: "0.02", r: false, t: { limit: { tif: "Gtc" } } }], // $20, far below market
  grouping: "na",
});
const status = res.response.data.statuses[0];
if (typeof status === "object" && "resting" in status) {
  await exchange.cancel({ cancels: [{ a: eth, o: status.resting.oid }] });
}
```

```rust
use hypersdk::hypercore::{
    self, BatchCancel, Cancel, Cloid, NonceHandler, OrderResponseStatus, PrivateKeySigner,
    types::{BatchOrder, OrderGrouping, OrderRequest, OrderTypePlacement, TimeInForce},
};
use rust_decimal::dec;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let agent: PrivateKeySigner = "0x...".parse()?; // an API wallet key, testnet only
    let client = hypercore::testnet();
    let eth = client.perps().await?.into_iter().find(|p| p.name == "ETH").expect("ETH is listed");
    let nonce = NonceHandler::default();

    let order = OrderRequest {
        asset: eth.index,
        is_buy: true,
        limit_px: dec!(1000), // $20, far below market
        sz: dec!(0.02),
        reduce_only: false,
        order_type: OrderTypePlacement::Limit { tif: TimeInForce::Gtc },
        cloid: Cloid::random(),
    };
    let batch = BatchOrder { orders: vec![order], grouping: OrderGrouping::Na, builder: None };
    let statuses = client.place(&agent, batch, nonce.next(), None, None).await?;
    if let OrderResponseStatus::Resting { oid, .. } = &statuses[0] {
        let cancel = BatchCancel { cancels: vec![Cancel { asset: eth.index, oid: *oid }], fast: false };
        client.cancel(&agent, cancel, nonce.next(), None, None).await?;
    }
    Ok(())
}
```

We ran all three on testnet on Nov 9, 2026, with hyperliquid-python-sdk 0.24.0, @nktkas/hyperliquid 0.33.3 and hypersdk 0.3.0, each signing with a brand-new key. The exchange recovered that key every time, so each one encodes and signs the order correctly.

When that works, [T2](/tracks/t02-reading-the-exchange/) covers reading data properly and [T3](/tracks/t03-signing-and-sending/) covers what the SDK just did for you.
