// L1 action signing, as the exchange checks it. Verified against testnet on Oct 22, 2026:
// a throwaway key's signature recovers to that key, and each "bug" below recovers elsewhere.

import { encode } from "@msgpack/msgpack";
import { concat, keccak256, numberToHex, toHex, type Hex } from "viem";
import type { PrivateKeyAccount } from "viem/accounts";

export const TESTNET_EXCHANGE = "https://api.hyperliquid-testnet.xyz/exchange";

/** Mistakes the lab can introduce on purpose, each one a real-world cause of failed signatures. */
export type Bug = "none" | "fieldOrder" | "mainnetSource" | "noNonce" | "nullField";

export interface SignedRequest {
  action: Record<string, unknown>;
  nonce: number;
  /** The exact bytes that were hashed, as hex. */
  packed: Hex;
  hash: Hex;
  signature: { r: Hex; s: Hex; v: number };
}

/** The value that actually gets hashed: the action itself, or a subtly different one for a bug. */
function hashedAction(action: Record<string, unknown>, bug: Bug): unknown {
  if (bug === "fieldOrder") return Object.fromEntries(Object.entries(action).reverse());
  if (bug === "nullField") return { ...action, expiresAfter: null };
  return action;
}

/**
 * Signs an L1 action: msgpack-encode it, append the nonce as 8 big-endian bytes and 0x00 for
 * "no vault", hash with keccak-256, then sign an EIP-712 `Agent` message carrying that hash.
 */
export async function signL1Action(
  account: PrivateKeyAccount,
  action: Record<string, unknown>,
  nonce: number,
  bug: Bug = "none",
): Promise<SignedRequest> {
  const parts: Hex[] = [toHex(encode(hashedAction(action, bug)))];
  if (bug !== "noNonce") parts.push(numberToHex(BigInt(nonce), { size: 8 }));
  parts.push("0x00");
  const packed = concat(parts);
  const hash = keccak256(packed);
  const raw = await account.signTypedData({
    domain: { name: "Exchange", version: "1", chainId: 1337, verifyingContract: "0x0000000000000000000000000000000000000000" },
    types: { Agent: [{ name: "source", type: "string" }, { name: "connectionId", type: "bytes32" }] },
    primaryType: "Agent",
    // "a" signs for mainnet, "b" for testnet.
    message: { source: bug === "mainnetSource" ? "a" : "b", connectionId: hash },
  });
  const signature = { r: raw.slice(0, 66) as Hex, s: `0x${raw.slice(66, 130)}` as Hex, v: parseInt(raw.slice(130, 132), 16) };
  return { action, nonce, packed, hash, signature };
}

/** Sends a signed request to testnet and returns the raw reply text. */
export async function sendToTestnet(req: SignedRequest): Promise<string> {
  const res = await fetch(TESTNET_EXCHANGE, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: req.action, nonce: req.nonce, signature: req.signature, vaultAddress: null }),
  });
  return res.text();
}
