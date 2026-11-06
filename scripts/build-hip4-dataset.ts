// Builds public/data/hip4-settlements.json, the dataset behind the Settlement explorer lab.
//
// Input: hyperkeeper's hip4-shadow logs (hip4-shadow-*.jsonl[.gz]) and the raw samples it saves
// (hip4-samples-*.jsonl[.gz]), from https://github.com/vignesh-chaturvedi/hyperkeeper. Candle
// closes for candle-based markets are fetched from the API, which keeps only recent candles.
//
// Usage: node scripts/build-hip4-dataset.ts <directory with hyperkeeper's hip4 logs>

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { timeWeighted, volumeWeighted, type Sample } from "../src/lib/twap.ts";

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

// After a reconnect, the trades feed resends its last ~30 trades, so time jumps back. Drop each
// resent trade that repeats one already kept; anything new is kept and sorted into place below.
type RawSample = [number, string, string | null];
function dropReplays(raw: RawSample[]): RawSample[] {
  const kept: RawSample[] = [];
  const seen = new Set<string>();
  let latest = -Infinity;
  let replaying = false;
  for (const s of raw) {
    if (s[0] < latest) replaying = true;
    const k = s.join("|");
    if (replaying && s[0] <= latest && seen.has(k)) continue;
    replaying = false;
    kept.push(s);
    seen.add(k);
    latest = Math.max(latest, s[0]);
  }
  return kept;
}

// The window's samples in time order, relative to its start.
function windowOf(outcome: number) {
  const raw = sampled.get(outcome)!;
  const start: number = raw.window_start_ms;
  const end: number = raw.window_end_ms ?? raw.expiry_ms;
  const samples: Sample[] = dropReplays(raw.samples)
    .map(([t, px, sz]) => (sz === null ? [t - start, Number(px)] : [t - start, Number(px), Number(sz)]) as Sample)
    .sort((a, b) => a[0] - b[0]);
  return { start, end, samples };
}
// Margins come from these samples, not from hyperkeeper's logged price, so they match what the lab shows.
const twapOf = (s: Row) => { const w = windowOf(s.outcome); return timeWeighted(w.samples, w.end - w.start); };
const margin = (s: Row) => { const v = twapOf(s); return v === null ? 99 : Math.abs(((v - Number(s.threshold)) / Number(s.threshold)) * 1e4); };
const byMargin = (rows: Row[]) => [...rows].sort((a, b) => margin(a) - margin(b));

// Skew: every market where the averages disagree on the side, then close calls, then ordinary ones.
const skew = withSamples.filter((s) => s.venue === "skew");
const disagree = (s: Row) => {
  const w = windowOf(s.outcome);
  const [twap, vwap] = [timeWeighted(w.samples, w.end - w.start), volumeWeighted(w.samples, w.end - w.start)];
  return twap !== null && vwap !== null && twap > Number(s.threshold) !== vwap > Number(s.threshold);
};
take(skew.filter(disagree).map((s) => s.outcome), "Averages disagree");
take(byMargin(skew.filter((s) => margin(s) < 3)).map((s) => s.outcome), "Close calls", 6);
// Outcome: its misses, all within a fraction of a basis point, then close calls that matched.
const out = withSamples.filter((s) => s.venue === "out" && s.rule !== "touch");
take(out.filter((s) => s.predicted_yes !== s.actual_yes).map((s) => s.outcome), "Ties");
take(byMargin(out.filter((s) => s.predicted_yes === s.actual_yes && margin(s) < 1)).map((s) => s.outcome), "Close calls", 4);
// Touch markets that touched, with their touching window. Untouched ones only show the last
// window before expiry, which explains nothing.
take(withSamples.filter((s) => s.rule === "touch" && s.actual_yes && s.touched_at).map((s) => s.outcome), "Touch");
// A few ordinary markets for contrast, each from a different window and small enough to load fast.
const oneWindowEach = (rows: Row[]) =>
  rows.filter((r, i) => rows.findIndex((x) => x.expiry === r.expiry && x.coin === r.coin) === i && windowOf(r.outcome).samples.length <= 1000);
take(oneWindowEach(byMargin(skew).reverse()).map((s) => s.outcome), "Ordinary", 2);
take(oneWindowEach(byMargin(out).reverse()).map((s) => s.outcome), "Ordinary", 2);

const markets: Row[] = [];
for (const { outcome, group } of picks) {
  const s = settled.get(outcome)!;
  const { start, end, samples } = windowOf(outcome);
  markets.push({
    outcome, group, venue: s.venue, coin: s.coin, kind: s.kind, rule: s.rule ?? "above",
    threshold: s.threshold, expiry: s.expiry, windowStartMs: start, windowEndMs: end,
    actualYes: s.actual_yes, settleLagS: s.settle_lag_s,
    touchedAt: s.touched_at ?? null,
    // A touch counts from the side the price started on: the earliest recorded sample, well before the touch.
    touchFrom: s.rule === "touch" ? (samples[0][1] < Number(s.threshold) ? "below" : "above") : null,
    samples,
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

// The API keeps only the last ~3.5 days of 1-minute candles, so keep earlier candle markets
// from the current dataset when there aren't four recent ones to fetch.
try {
  const previous = JSON.parse(await readFile("public/data/hip4-settlements.json", "utf8")) as { markets: Row[] };
  const have = new Set(markets.map((m) => m.outcome));
  const old = previous.markets.filter((m) => m.group === "Candles" && !have.has(m.outcome));
  markets.push(...old.slice(0, Math.max(0, 4 - markets.filter((m) => m.group === "Candles").length)));
} catch {
  // No earlier dataset.
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
