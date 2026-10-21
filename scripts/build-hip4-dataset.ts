// Builds public/data/hip4-settlements.json, the dataset behind the Settlement explorer lab.
//
// Input: hyperkeeper's hip4-shadow logs (hip4-shadow-*.jsonl[.gz]) and the raw samples it saves
// (hip4-samples-*.jsonl[.gz]), from https://github.com/vignesh-chaturvedi/hyperkeeper. Candle
// closes for candle-based markets are fetched from the API, which keeps only recent candles.
//
// Usage: node scripts/build-hip4-dataset.ts <directory with hyperkeeper's hip4 logs>

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { gunzipSync } from "node:zlib";

type Row = Record<string, any>;
const dir = process.argv[2];
if (!dir) throw new Error("usage: node scripts/build-hip4-dataset.ts <log directory>");

async function readRows(prefix: string): Promise<Row[]> {
  const rows: Row[] = [];
  for (const name of (await readdir(dir)).filter((n) => n.startsWith(prefix)).sort()) {
    const raw = await readFile(`${dir}/${name}`);
    const text = name.endsWith(".gz") ? gunzipSync(raw).toString("utf8") : raw.toString("utf8");
    for (const line of text.split("\n")) if (line.trim()) rows.push(JSON.parse(line));
  }
  return rows;
}

const shadow = await readRows("hip4-shadow-");
const samples = await readRows("hip4-samples-");
const predicted = new Map(shadow.filter((r) => r.event === "predicted").map((r) => [r.outcome, r]));
const settled = new Map(shadow.filter((r) => r.event === "settled" && r.predicted_yes !== null).map((r) => [r.outcome, r]));
const sampled = new Map(samples.map((r) => [r.outcome, r]));
const ms = (iso: string) => Date.parse(iso);
const seconds: Record<string, number> = { out: 60, skew: 90, txyz: 300 };

type Pick = { outcome: number; group: string };
const picks: Pick[] = [];
const take = (ids: number[], group: string, limit = ids.length) =>
  ids.filter((id) => !picks.some((p) => p.outcome === id)).slice(0, limit).forEach((outcome) => picks.push({ outcome, group }));
const withSamples = [...settled.values()].filter((s) => sampled.has(s.outcome) && predicted.has(s.outcome));
const margin = (s: Row) => Math.abs(predicted.get(s.outcome)!.margin_bps ?? 99);
const byMargin = (rows: Row[]) => [...rows].sort((a, b) => margin(a) - margin(b));

// Skew: every market where the averages disagree on the side, then close calls, then ordinary ones.
const skew = withSamples.filter((s) => s.venue === "skew");
const sideOf = (s: Row, key: string) => Number(predicted.get(s.outcome)![key] ?? NaN) > Number(s.threshold);
take(skew.filter((s) => predicted.get(s.outcome)!.vwap_price && sideOf(s, "price") !== sideOf(s, "vwap_price")).map((s) => s.outcome), "Averages disagree");
take(byMargin(skew.filter((s) => margin(s) < 3)).map((s) => s.outcome), "Close calls", 6);
// Outcome: its misses, all within a fraction of a basis point, then close calls that matched.
const out = withSamples.filter((s) => s.venue === "out" && s.rule !== "touch");
take(out.filter((s) => s.predicted_yes !== s.actual_yes).map((s) => s.outcome), "Ties");
take(byMargin(out.filter((s) => s.predicted_yes === s.actual_yes && margin(s) < 1)).map((s) => s.outcome), "Close calls", 4);
// Touch markets with their touching window.
take(withSamples.filter((s) => s.rule === "touch").map((s) => s.outcome), "Touch");
// A few ordinary markets for contrast.
take(byMargin(skew).reverse().map((s) => s.outcome), "Ordinary", 2);
take(byMargin(out).reverse().map((s) => s.outcome), "Ordinary", 2);

const markets: Row[] = [];
for (const { outcome, group } of picks) {
  const s = settled.get(outcome)!;
  const p = predicted.get(outcome)!;
  const raw = sampled.get(outcome)!;
  const start = raw.window_start_ms;
  const end = raw.window_end_ms ?? raw.expiry_ms;
  markets.push({
    outcome, group, venue: s.venue, coin: s.coin, kind: s.kind, rule: s.rule ?? "above",
    threshold: s.threshold, expiry: s.expiry, windowStartMs: start, windowEndMs: end,
    actualYes: s.actual_yes, settleLagS: s.settle_lag_s,
    touchedAt: s.touched_at ?? null,
    samples: raw.samples.map(([t, px, sz]: [number, string, string | null]) => (sz === null ? [t - start, Number(px)] : [t - start, Number(px), Number(sz)])),
  });
}

// Candle markets: recent trade[XYZ] Events, with the 1-minute closes the template averages.
const recentCandle = [...settled.values()]
  .filter((s) => s.venue === "txyz" && ms(s.expiry) > Date.now() - 3 * 86_400_000)
  .sort((a, b) => ms(b.expiry) - ms(a.expiry))
  .slice(0, 4);
for (const s of recentCandle) {
  const end = ms(s.expiry);
  const start = end - seconds.txyz * 1000;
  const res = await fetch("https://api.hyperliquid.xyz/info", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "candleSnapshot", req: { coin: s.coin, interval: "1m", startTime: start, endTime: end - 1 } }),
  });
  const candles = (await res.json()) as { t: number; c: string }[];
  const closes = candles.filter((c) => c.t >= start && c.t < end).map((c) => [c.t - start, Number(c.c)]);
  if (closes.length !== 5) continue;
  markets.push({
    outcome: s.outcome, group: "Candles", venue: s.venue, coin: s.coin, kind: "Candle1m", rule: "above",
    threshold: s.threshold, expiry: s.expiry, windowStartMs: start, windowEndMs: end,
    actualYes: s.actual_yes, settleLagS: s.settle_lag_s, touchedAt: null, samples: closes,
  });
}

await mkdir("public/data", { recursive: true });
const dataset = {
  description: "Real Hyperliquid HIP-4 settlements with the prices hyperkeeper recorded for each window. Samples are [ms from window start, price, size for trades].",
  source: "https://github.com/vignesh-chaturvedi/hyperkeeper",
  license: "CC BY 4.0",
  generated: new Date().toISOString(),
  markets,
};
await writeFile("public/data/hip4-settlements.json", JSON.stringify(dataset));
console.log(`${markets.length} markets:`, Object.entries(markets.reduce<Record<string, number>>((a, m) => ((a[m.group] = (a[m.group] ?? 0) + 1), a), {})));
