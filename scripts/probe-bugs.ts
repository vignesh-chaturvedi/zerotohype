import { encode } from "@msgpack/msgpack";
import { concat, keccak256, numberToHex, toHex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const action = { type: "cancel", cancels: [{ a: 0, o: 1 }] };
const bugs: Record<string, { hashed: unknown; source: string; withNonce: boolean }> = {
  none: { hashed: action, source: "b", withNonce: true },
  fieldOrder: { hashed: { cancels: [{ o: 1, a: 0 }], type: "cancel" }, source: "b", withNonce: true },
  mainnetSource: { hashed: action, source: "a", withNonce: true },
  noNonce: { hashed: action, source: "b", withNonce: false },
  nullField: { hashed: { ...action, expiresAfter: null }, source: "b", withNonce: true },
};
for (const [name, bug] of Object.entries(bugs)) {
  const nonce = Date.now();
  const account = privateKeyToAccount(generatePrivateKey());
  const parts: `0x${string}`[] = [toHex(encode(bug.hashed))];
  if (bug.withNonce) parts.push(numberToHex(BigInt(nonce), { size: 8 }));
  parts.push("0x00");
  const signature = await account.signTypedData({
    domain: { name: "Exchange", version: "1", chainId: 1337, verifyingContract: "0x0000000000000000000000000000000000000000" },
    types: { Agent: [{ name: "source", type: "string" }, { name: "connectionId", type: "bytes32" }] },
    primaryType: "Agent",
    message: { source: bug.source, connectionId: keccak256(concat(parts)) },
  });
  const sig = { r: signature.slice(0, 66), s: "0x" + signature.slice(66, 130), v: parseInt(signature.slice(130, 132), 16) };
  const res = await fetch("https://api.hyperliquid-testnet.xyz/exchange", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, nonce, signature: sig, vaultAddress: null }),
  });
  const body = await res.text();
  const recovered = body.match(/0x[0-9a-fA-F]{40}/)?.[0]?.toLowerCase();
  console.log(name.padEnd(14), res.status, recovered === account.address.toLowerCase() ? "MATCH" : "mismatch", body.slice(0, 90));
  await new Promise((r) => setTimeout(r, 300));
}
