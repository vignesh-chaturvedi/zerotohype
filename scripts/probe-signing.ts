// Checks the L1 signing recipe used by the Sign without money lab, against testnet.
import { encode } from "@msgpack/msgpack";
import { concat, keccak256, numberToHex, toHex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const action = { type: "cancel", cancels: [{ a: 0, o: 1 }] };
const nonce = Date.now();

function actionHash(a: unknown, nonceMs: number) {
  const packed = encode(a);
  // msgpack bytes, then the nonce as 8 big-endian bytes, then 0x00 for "no vault address".
  return keccak256(concat([toHex(packed), numberToHex(BigInt(nonceMs), { size: 8 }), "0x00"]));
}

const account = privateKeyToAccount(generatePrivateKey());
const signature = await account.signTypedData({
  domain: { name: "Exchange", version: "1", chainId: 1337, verifyingContract: "0x0000000000000000000000000000000000000000" },
  types: { Agent: [{ name: "source", type: "string" }, { name: "connectionId", type: "bytes32" }] },
  primaryType: "Agent",
  message: { source: "b", connectionId: actionHash(action, nonce) },
});
const r = signature.slice(0, 66), s = "0x" + signature.slice(66, 130), v = parseInt(signature.slice(130, 132), 16);
const res = await fetch("https://api.hyperliquid-testnet.xyz/exchange", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ action, nonce, signature: { r, s, v }, vaultAddress: null }),
});
const body = await res.text();
const recovered = body.match(/0x[0-9a-fA-F]{40}/)?.[0];
console.log("throwaway key:", account.address);
console.log("exchange said:", res.status, body);
console.log("match:", recovered?.toLowerCase() === account.address.toLowerCase());
