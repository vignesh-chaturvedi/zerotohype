// The markets a lab can pick from, read from the public info endpoint: the main DEX's perps and the
// busier spot pairs, each with what the labs need to know about it.

export const INFO = "https://api.hyperliquid.xyz/info";

export async function info<T>(body: object): Promise<T> {
  const res = await fetch(INFO, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`api.hyperliquid.xyz answered ${res.status}`);
  return (await res.json()) as T;
}

export type Market = {
  /** What the API calls it: "BTC" for a perp; "PURR/USDC", or "@107" for HYPE/USDC, for a spot pair. */
  coin: string;
  /** What people call it: "BTC", "HYPE/USDC". */
  name: string;
  kind: "perp" | "spot";
  /** The number an order names it by: its index for a main-DEX perp, 10000 + the pair's index for spot. */
  asset: number;
  szDecimals: number;
  mid: number | null;
  mark: number;
  /** 24-hour volume, in USDC. */
  volume: number;
  /** Perps only. */
  maxLeverage?: number;
  marginTableId?: number;
  /** Spot only: the token prices are quoted in, such as USDC. */
  quote?: string;
};

export type MarginTable = [number, { description: string; marginTiers: { lowerBound: string; maxLeverage: number }[] }];

type PerpMeta = {
  universe: { name: string; szDecimals: number; maxLeverage: number; marginTableId?: number; isDelisted?: boolean }[];
  marginTables?: MarginTable[];
};
type Ctx = { markPx: string; midPx: string | null; dayNtlVlm: string };
type SpotMeta = { tokens: { name: string; index: number; szDecimals: number }[]; universe: { name: string; tokens: [number, number]; index: number }[] };

const byVolume = (a: Market, b: Market) => b.volume - a.volume;

/** The main DEX's listed perps, busiest first, and the margin tables their tiers come from. */
export async function perps(): Promise<{ markets: Market[]; tables: MarginTable[] }> {
  const [meta, ctxs] = await info<[PerpMeta, Ctx[]]>({ type: "metaAndAssetCtxs" });
  const markets: Market[] = [];
  meta.universe.forEach((u, i) => {
    const c = ctxs[i];
    if (u.isDelisted || !c) return;
    markets.push({
      coin: u.name, name: u.name, kind: "perp", asset: i, szDecimals: u.szDecimals,
      mid: c.midPx === null ? null : Number(c.midPx), mark: Number(c.markPx), volume: Number(c.dayNtlVlm),
      maxLeverage: u.maxLeverage, marginTableId: u.marginTableId,
    });
  });
  return { markets: markets.sort(byVolume), tables: meta.marginTables ?? [] };
}

/** Spot pairs that traded at least `minVolume` USDC in the last day, busiest first. Each price context is
 *  matched to its pair by name, not by position: the two lists don't stay in the same order (T2). */
export async function spots(minVolume = 10_000): Promise<Market[]> {
  const [meta, ctxs] = await info<[SpotMeta, (Ctx & { coin: string })[]]>({ type: "spotMetaAndAssetCtxs" });
  const tokens = new Map(meta.tokens.map((t) => [t.index, t]));
  const ctxOf = new Map(ctxs.map((c) => [c.coin, c]));
  const markets: Market[] = [];
  for (const pair of meta.universe) {
    const base = tokens.get(pair.tokens[0]);
    const quote = tokens.get(pair.tokens[1]);
    const c = ctxOf.get(pair.name);
    if (!base || !quote || !c || Number(c.dayNtlVlm) < minVolume) continue;
    markets.push({
      coin: pair.name, name: `${base.name}/${quote.name}`, kind: "spot", asset: 10_000 + pair.index, szDecimals: base.szDecimals,
      mid: c.midPx === null ? null : Number(c.midPx), mark: Number(c.markPx), volume: Number(c.dayNtlVlm), quote: quote.name,
    });
  }
  return markets.sort(byVolume);
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Options for a <select>: perps, then spot pairs, each group busiest first. */
export function marketOptions(perpList: Market[], spotList: Market[], selected = "BTC") {
  const opt = (m: Market) => `<option value="${esc(m.coin)}"${m.coin === selected ? " selected" : ""}>${esc(m.name)}${m.coin !== m.name ? ` (${esc(m.coin)})` : ""}</option>`;
  return (
    `<optgroup label="Perps, busiest first">${perpList.map(opt).join("")}</optgroup>` +
    (spotList.length ? `<optgroup label="Spot, busiest first">${spotList.map(opt).join("")}</optgroup>` : "")
  );
}
