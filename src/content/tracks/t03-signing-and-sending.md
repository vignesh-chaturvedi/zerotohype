---
order: 3
stage: Foundations
code: T3
title: Signing and sending
summary: Where most bots break. Two signing schemes, and a handful of encoding traps that make the exchange recover the wrong address.
depth: lesson
verified: 2026-10-22
docs:
  - { title: Signing, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/signing" }
  - { title: Exchange endpoint, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint" }
  - { title: Error responses, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/error-responses" }
  - { title: Activation gas fee, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/activation-gas-fee" }
  - { title: Priority fees, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/priority-fees" }
  - { title: Optimizing latency, url: "https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/optimizing-latency" }
outside:
  - { title: Agent wallets and the nonce state machine, url: "https://chainstack.com/hyperliquid-agent-wallets-nonce-state-machine/", by: Chainstack, note: "The two signing schemes, msgpack and the nonce window, with code that signs and recovers both kinds of action." }
build:
  - { label: Sign without money, kind: lab, status: live, href: "/labs/sign-without-money/" }
  - { label: Signed action from scratch, kind: project }
---

## Two signing schemes

Every `POST /exchange` carries an `action`, a `nonce` and a `signature`. How you sign depends on the action.

- **L1 actions** cover trading and most other actions: orders, cancels, leverage, and the deployer actions in T7 and T8. The action is encoded with msgpack and hashed together with the nonce, plus the vault address and `expiresAfter` when present. You then sign a small EIP-712 message that carries that hash. The SDKs call this `sign_l1_action`.
- **User-signed actions** move funds or grant permissions: withdrawals, transfers, approving an API wallet, approving a builder fee. These are ordinary EIP-712 typed data that a wallet like MetaMask can show, with `hyperliquidChain` and `signatureChainId` fields. They must be signed by the account's own key.

The request itself looks like this:

```json
{
  "action": { "type": "order", "orders": [ ... ], "grouping": "na" },
  "nonce": 1792600000000,
  "signature": { "r": "0x...", "s": "0x...", "v": 27 },
  "vaultAddress": null,
  "expiresAfter": null
}
```

- **Sub-accounts and vaults** have no keys. Sign with the master account (or its API wallet) and set `vaultAddress` to the sub-account or vault.
- **`expiresAfter`** is an optional timestamp in milliseconds after which an L1 action is rejected. User-signed actions don't support it.

## A wrong signature doesn't say what's wrong

The exchange recovers a signer from your signature and payload. If anything differs from what it hashes, it recovers some other address and answers with an error such as:

```text
User or API Wallet 0x7e3a… does not exist.
Must deposit before performing actions. User: 0x7e3a…
```

The address in the message isn't yours, and it changes every time you change the input. Nothing tells you which byte was wrong. These are the causes we've seen most, from the docs and from fixing them in [hypersdk](https://github.com/infinitefield/hypersdk):

| Mistake | Why it breaks the hash |
|---|---|
| Using the wrong scheme | An L1 action signed as user-signed data, or the reverse |
| Fields in a different order | msgpack keeps field order, so `{a, b}` and `{b, a}` hash differently |
| `null` instead of leaving a field out | A `null` is encoded; a missing field isn't |
| Trailing zeros, such as `"1.50"` | Send `"1.5"`; the SDKs strip trailing zeros before signing |
| Upper-case addresses | Lower-case every address before signing |
| Addresses as 20 raw bytes | The exchange hashes them as lower-case hex strings |
| HIP-3 or HIP-4 lists not sorted | Deployer actions expect lists sorted by their first element, before signing |
| Trusting a local recover | Recovering your own address locally proves nothing, because you rebuilt the payload yourself |

## Use the error as a test

That unhelpful error is also the best test you have. Generate a brand-new key, sign an action with it, and send it to testnet. The new key has no account, so the action is always rejected, but the error names the address the exchange recovered:

- **It names your new key's address:** your encoding and signing match the exchange's, byte for byte.
- **It names any other address:** something in the payload differs. Change one thing at a time until it matches.

No funds are involved and nothing can take effect. [hyperkeeper](https://github.com/vignesh-chaturvedi/hyperkeeper) runs this check every time it starts, and the [Sign without money](/labs/sign-without-money/) lab lets you try it in the browser.

## Errors that aren't about signing

When the signature is fine, an order can still be rejected. Batched orders and cancels return one status per item. These are the errors you'll meet first:

| Error | Meaning |
|---|---|
| `Tick` | The price has too much precision (see [T2](/tracks/t02-reading-the-exchange/)) |
| `MinTradeNtl` | Order value under $10 |
| `PerpMargin` | Not enough margin to open it |
| `BadAloPx` | A post-only order would have matched immediately |
| `IocCancel` | An immediate-or-cancel order found nothing to match |
| `Oracle` | Price too far from the oracle |
| `MissingOrder` | Cancelling an order that was never placed, already filled or already cancelled |

Some errors depend only on the payload, such as an empty batch. Those come back once for the whole batch, so a batch of 20 orders can return a single error.

## New accounts pay to activate

The first transfer into a brand-new HyperCore account costs 1 unit of the quote token (1 USDC, for example), whatever asset is sent. An account that has never been activated can't send CoreWriter actions from the HyperEVM, which catches contract developers out.

## Order types, briefly

Limit orders take a time-in-force:
- **GTC** (good till cancelled) rests on the book.
- **IOC** (immediate or cancel) fills what it can and cancels the rest.
- **ALO** (add liquidity only, or post-only) is cancelled rather than matching immediately.

A client order ID (`cloid`) is an optional 128-bit hex string you choose, so you can cancel or look up an order without waiting for its `oid`. [T4](/tracks/t04-trading-mechanics/) covers triggers, TWAPs and the rest.
