// Checks what /errors/ says about the API's error replies, against testnet: node scripts/probe-errors.ts
// Every request comes from a brand-new key with no account, so none of them can take effect.
import { encode } from "@msgpack/msgpack";
import { concat, keccak256, numberToHex, toHex, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const API = "https://api.hyperliquid-testnet.xyz";
const ZERO = "0x0000000000000000000000000000000000000000";

type Reply = { status: number; text: string; signer?: string };
type Expect = { http?: number; text?: string | RegExp; names?: "signer" | "other" };
const checks: { name: string; expect: Expect; run: () => Promise<Reply> }[] = [];
const check = (name: string, expect: Expect, run: () => Promise<Reply>) => checks.push({ name, expect, run });

const newKey = () => privateKeyToAccount(generatePrivateKey());
const someAddress = () => newKey().address.toLowerCase();
const split = (raw: Hex) => ({ r: raw.slice(0, 66), s: `0x${raw.slice(66, 130)}`, v: parseInt(raw.slice(130, 132), 16) });

async function post(path: string, body: string, headers: Record<string, string> = { "content-type": "application/json" }, signer?: string): Promise<Reply> {
  const res = await fetch(`${API}${path}`, { method: "POST", headers, body });
  return { status: res.status, text: await res.text(), signer };
}

/** Signs an L1 action with a new key, for testnet unless `source` says otherwise. `tamper` changes the request after it's signed. */
async function l1(action: object, tamper?: (req: any) => void, source = "b"): Promise<Reply> {
  const key = newKey();
  const nonce = Date.now();
  const raw = await key.signTypedData({
    domain: { name: "Exchange", version: "1", chainId: 1337, verifyingContract: ZERO },
    types: { Agent: [{ name: "source", type: "string" }, { name: "connectionId", type: "bytes32" }] },
    primaryType: "Agent",
    message: { source, connectionId: keccak256(concat([toHex(encode(action)), numberToHex(BigInt(nonce), { size: 8 }), "0x00"])) },
  });
  const req: any = { action, nonce, signature: split(raw), vaultAddress: null };
  tamper?.(req);
  return post("/exchange", JSON.stringify(req), undefined, key.address);
}

/** Signs a usdSend, a user-signed action, with a new key. */
async function usdSend(o: { chain?: string; destination?: string; amount?: string; nonceOffset?: number; tamper?: (req: any) => void } = {}): Promise<Reply> {
  const key = newKey();
  const time = Date.now();
  const fields = { hyperliquidChain: o.chain ?? "Testnet", destination: o.destination ?? someAddress(), amount: o.amount ?? "1", time };
  const raw = await key.signTypedData({
    domain: { name: "HyperliquidSignTransaction", version: "1", chainId: 421614, verifyingContract: ZERO },
    types: {
      "HyperliquidTransaction:UsdSend": [
        { name: "hyperliquidChain", type: "string" }, { name: "destination", type: "string" },
        { name: "amount", type: "string" }, { name: "time", type: "uint64" },
      ],
    },
    primaryType: "HyperliquidTransaction:UsdSend",
    message: { ...fields, time: BigInt(time) },
  });
  const action = { type: "usdSend", signatureChainId: "0x66eee", ...fields };
  const req: any = { action, nonce: time + (o.nonceOffset ?? 0), signature: split(raw) };
  o.tamper?.(req);
  return post("/exchange", JSON.stringify(req), undefined, key.address);
}

const meta = JSON.parse((await post("/info", JSON.stringify({ type: "meta" }))).text);
const mids = JSON.parse((await post("/info", JSON.stringify({ type: "allMids" }))).text);
const BTC = meta.universe.findIndex((u: { name: string }) => u.name === "BTC");
const px = Math.round(Number(mids.BTC) * 0.9);
const order = (o: object = {}) => ({ type: "order", orders: [{ a: BTC, b: true, p: String(px), s: "0.001", r: false, t: { limit: { tif: "Gtc" } }, ...o }], grouping: "na" });
const cancel = { type: "cancel", cancels: [{ a: BTC, o: 1 }] };

const NOT_EXIST = /^\{"status":"err","response":"User or API Wallet 0x[0-9a-f]{40} does not exist\."\}$/;
const MUST_DEPOSIT = /^\{"status":"err","response":"Must deposit before performing actions\. User: 0x[0-9a-f]{40}"\}$/;
const DESERIALIZE = "Failed to deserialize the JSON body into the target type";
const err = (s: string) => JSON.stringify({ status: "err", response: s });

// Before the exchange reads the request
check("body that isn't JSON", { http: 400, text: "Failed to parse the request body as JSON" }, () => post("/info", "{not json"));
check("no Content-Type header", { http: 415, text: "Expected request with `Content-Type: application/json`" }, () => post("/info", JSON.stringify({ type: "allMids" }), {}));
check("unknown info type", { http: 422, text: DESERIALIZE }, () => post("/info", JSON.stringify({ type: "notAType" })));
check("address that isn't 42 characters", { http: 422, text: DESERIALIZE }, () => post("/info", JSON.stringify({ type: "clearinghouseState", user: "0x1234" })));
check("unknown action type", { http: 422, text: DESERIALIZE }, () => l1({ type: "notAnAction" }));
check("no nonce", { http: 422, text: DESERIALIZE }, () => l1(cancel, (r) => delete r.nonce));
check("nonce as a string", { http: 422, text: DESERIALIZE }, () => l1(cancel, (r) => (r.nonce = String(r.nonce))));
check("price as a number", { http: 422, text: DESERIALIZE }, () => l1(order({ p: px })));

// The whole action
check("v of 29", { http: 200, text: err("Unable to recover signer.") }, () => l1(cancel, (r) => (r.signature.v = 29)));
check("v of 29, user-signed", { http: 200, text: err("Unable to recover signer.") }, () => usdSend({ tamper: (r) => (r.signature.v = 29) }));
check("v as 0 or 1", { text: NOT_EXIST, names: "signer" }, () => l1(cancel, (r) => (r.signature.v -= 27)));
check("v as 0 or 1, user-signed", { text: MUST_DEPOSIT, names: "signer" }, () => usdSend({ tamper: (r) => (r.signature.v -= 27) }));
check("r and s without 0x", { text: NOT_EXIST, names: "signer" }, () => l1(cancel, (r) => { r.signature.r = r.signature.r.slice(2); r.signature.s = r.signature.s.slice(2); }));
check("L1 action from a key with no account", { text: NOT_EXIST, names: "signer" }, () => l1(cancel));
check("user-signed action from a key with no account", { text: MUST_DEPOSIT, names: "signer" }, () => usdSend());
check("user-signed action for the other network", { text: err("Mainnet and testnet require different signature.") }, () => usdSend({ chain: "Mainnet" }));
check("user-signed action whose time isn't the nonce", { text: err("Nonce mismatch.") }, () => usdSend({ nonceOffset: 1 }));

// The account check comes before any order in the action is looked at
check("empty batch", { text: NOT_EXIST, names: "signer" }, () => l1({ type: "order", orders: [], grouping: "na" }));
check("TP/SL that isn't reduce-only", { text: NOT_EXIST, names: "signer" }, () => l1(order({ t: { trigger: { isMarket: true, triggerPx: String(px * 2), tpsl: "tp" } } })));
check("price five times the market", { text: NOT_EXIST, names: "signer" }, () => l1(order({ p: String(px * 5) })));
check("asset that doesn't exist", { text: NOT_EXIST, names: "signer" }, () => l1(order({ a: 99_999 })));

// Which differences in the payload change the address the exchange recovers
check("L1: a price with one decimal", { names: "signer" }, () => l1(order({ p: `${px}.5` })));
check("L1: the same price with a trailing zero", { names: "other" }, () => l1(order({ p: `${px}.50` })));
check("L1: a size with a trailing zero", { names: "other" }, () => l1(order({ s: "0.0010" })));
check("L1: a lower-case address", { names: "signer" }, () => l1({ type: "vaultTransfer", vaultAddress: someAddress(), isDeposit: true, usd: 1_000_000 }));
check("L1: a checksummed address", { names: "other" }, () => l1({ type: "vaultTransfer", vaultAddress: newKey().address, isDeposit: true, usd: 1_000_000 }));
check("L1: f: false on a cancel", { names: "other" }, () => l1({ ...cancel, f: false }));
check("L1: a lower-case builder address", { names: "signer" }, () => l1({ ...order(), builder: { b: someAddress(), f: 10 } }));
check("L1: a checksummed builder address", { names: "other" }, () => l1({ ...order(), builder: { b: newKey().address, f: 10 } }));
check("L1: signed for mainnet", { text: NOT_EXIST, names: "other" }, () => l1(cancel, undefined, "a"));
check("user-signed: a checksummed destination", { names: "signer" }, () => usdSend({ destination: newKey().address }));
check("user-signed: an amount of 1.0", { names: "signer" }, () => usdSend({ amount: "1.0" }));

// Info
check("orderStatus for an order that doesn't exist", { text: '{"status":"unknownOid"}' }, () => post("/info", JSON.stringify({ type: "orderStatus", user: someAddress(), oid: 1 })));

let failed = 0;
for (const c of checks) {
  const r = await c.run();
  const named = r.text.match(/0x[0-9a-fA-F]{40}/)?.[0].toLowerCase();
  const signer = r.signer?.toLowerCase();
  const wrong = [
    c.expect.http !== undefined && r.status !== c.expect.http && `HTTP ${r.status}`,
    c.expect.text !== undefined && !(typeof c.expect.text === "string" ? r.text === c.expect.text : c.expect.text.test(r.text)) && "different text",
    c.expect.names === "signer" && named !== signer && "doesn't name the signer",
    c.expect.names === "other" && (!named || named === signer) && "doesn't name another address",
  ].filter(Boolean);
  if (wrong.length) failed++;
  console.log(wrong.length ? `FAIL ${c.name}: ${wrong.join(", ")}\n     HTTP ${r.status} ${r.text.slice(0, 200)}` : `ok   ${c.name}`);
  await new Promise((done) => setTimeout(done, 300));
}
console.log(`\n${checks.length - failed} of ${checks.length} match what /errors/ says.`);
process.exit(failed ? 1 : 0);
