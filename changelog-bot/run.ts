// Records what changed in Hyperliquid's API since the last run.
//
// Fetches public listings from mainnet and testnet plus the docs index, reduces each to the
// fields worth tracking, compares them with the snapshots in data/snapshots, and appends a
// plain-English entry to src/data/changelog.json for every difference. The first run only
// saves snapshots. Run with `node changelog-bot/run.ts`; Node 24 runs TypeScript directly.

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

type Network = "mainnet" | "testnet";
type Area = "perps" | "HIP-3" | "HIP-4" | "templates" | "docs";

interface NetworkState {
  /** Main-DEX perps: max leverage, and whether delisted. */
  perps: Record<string, { maxLeverage: number; delisted: boolean }>;
  /** HIP-3 DEXs by name. `grants` maps each sub-deployer action to the keys allowed to send it. */
  dexs: Record<string, { fullName: string; oracleUpdater: string | null; grants: Record<string, string[]> }>;
  /** Live outcomes per HIP-4 venue; `protocol` for outcomes with no venue. */
  venues: Record<string, number>;
  /** Short hash of each outcome template's definition. */
  templates: Record<string, string>;
}

interface DocsState {
  /** Docs pages by path, with a short hash of their content. */
  pages: Record<string, { title: string; hash: string | null }>;
}

interface Entry {
  time: string;
  network: Network | "docs";
  area: Area;
  /** One line of Markdown: backticks and links only. */
  summary: string;
}

const API: Record<Network, string> = {
  mainnet: "https://api.hyperliquid.xyz/info",
  testnet: "https://api.hyperliquid-testnet.xyz/info",
};
const DOCS = "https://hyperliquid.gitbook.io/hyperliquid-docs";
const SNAPSHOTS = "data/snapshots";
const CHANGELOG = "src/data/changelog.json";
const META = "src/data/changelog-meta.json";
const MAX_ENTRIES = 3000;

const short = (address: string | null) => (address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "none");
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 12);

async function fetchWithRetry(url: string, init?: RequestInit): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
      if (response.ok) return response;
      if (attempt >= 3) throw new Error(`HTTP ${response.status} from ${url}`);
    } catch (error) {
      if (attempt >= 3) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000 * attempt));
  }
}

async function info<T>(network: Network, body: object): Promise<T> {
  const response = await fetchWithRetry(API[network], {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await response.json()) as T;
}

async function readNetwork(network: Network): Promise<NetworkState> {
  const meta = await info<{ universe: { name: string; maxLeverage: number; isDelisted?: boolean }[] }>(network, {
    type: "meta",
  });
  const perps: NetworkState["perps"] = {};
  for (const asset of meta.universe) {
    perps[asset.name] = { maxLeverage: asset.maxLeverage, delisted: asset.isDelisted === true };
  }

  type Dex = { name: string; fullName: string; oracleUpdater: string | null; subDeployers?: [unknown, string[]][] };
  const dexList = await info<(Dex | null)[]>(network, { type: "perpDexs" });
  const dexs: NetworkState["dexs"] = {};
  for (const dex of dexList) {
    if (!dex) continue; // the main DEX
    const grants: Record<string, string[]> = {};
    for (const [variant, users] of dex.subDeployers ?? []) {
      const name = typeof variant === "string" ? variant : JSON.stringify(variant);
      grants[name] = [...users].map((u) => u.toLowerCase()).sort();
    }
    dexs[dex.name] = { fullName: dex.fullName, oracleUpdater: dex.oracleUpdater?.toLowerCase() ?? null, grants };
  }

  const outcomes = await info<{ outcomes: { venue?: string | null }[] }>(network, { type: "outcomeMeta" });
  const venues: NetworkState["venues"] = {};
  for (const outcome of outcomes.outcomes) {
    const venue = outcome.venue ?? "protocol";
    venues[venue] = (venues[venue] ?? 0) + 1;
  }

  type Template = { id: string; role: unknown; name: string; description: string; keywords?: unknown };
  const templateList = await info<Template[]>(network, { type: "outcomeTemplates" });
  const templates: NetworkState["templates"] = {};
  for (const t of templateList) {
    templates[t.id] = hash({ role: t.role, name: t.name, description: t.description, keywords: t.keywords });
  }

  return { perps, dexs, venues, templates };
}

async function readDocs(): Promise<DocsState> {
  const index = await (await fetchWithRetry(`${DOCS}/llms.txt`)).text();
  const pages: DocsState["pages"] = {};
  const pattern = /\[([^\]]+)\]\(https:\/\/hyperliquid\.gitbook\.io\/hyperliquid-docs\/([^)]+)\.md\)/g;
  for (const match of index.matchAll(pattern)) {
    const [, title, path] = match;
    if (path.startsWith("support/")) continue; // FAQ pages change often and aren't about the API
    pages[path] = { title, hash: null };
  }
  // Hash each page's text, without GitBook's footer, a few requests at a time.
  const paths = Object.keys(pages);
  for (let i = 0; i < paths.length; i += 6) {
    await Promise.all(
      paths.slice(i, i + 6).map(async (path) => {
        try {
          const text = await (await fetchWithRetry(`${DOCS}/${path}.md`)).text();
          const body = text.split("\n# Agent Instructions")[0].replace(/^> For the complete documentation index.*$/m, "");
          pages[path].hash = hash(body.trim());
        } catch {
          pages[path].hash = null; // unreachable this run; not reported as an edit
        }
      }),
    );
  }
  return { pages };
}

function diffNetwork(network: Network, before: NetworkState, after: NetworkState, time: string): Entry[] {
  const entries: Entry[] = [];
  const add = (area: Area, summary: string) => entries.push({ time, network, area, summary });

  for (const [name, now] of Object.entries(after.perps)) {
    const was = before.perps[name];
    if (!was) add("perps", `New perp listed: \`${name}\`, up to ${now.maxLeverage}× leverage`);
    else if (!was.delisted && now.delisted) add("perps", `Perp delisted: \`${name}\``);
    else if (was.delisted && !now.delisted) add("perps", `Perp relisted: \`${name}\``);
    else if (was.maxLeverage !== now.maxLeverage)
      add("perps", `\`${name}\` max leverage changed from ${was.maxLeverage}× to ${now.maxLeverage}×`);
  }

  for (const [name, now] of Object.entries(after.dexs)) {
    const was = before.dexs[name];
    if (!was) {
      add("HIP-3", `New HIP-3 DEX: \`${name}\` (${now.fullName})`);
      continue;
    }
    if (was.oracleUpdater !== now.oracleUpdater)
      add("HIP-3", `\`${name}\`: oracle updater changed from ${short(was.oracleUpdater)} to ${short(now.oracleUpdater)}`);
    for (const variant of new Set([...Object.keys(was.grants), ...Object.keys(now.grants)])) {
      const old = new Set(was.grants[variant] ?? []);
      const cur = new Set(now.grants[variant] ?? []);
      for (const user of cur) if (!old.has(user)) add("HIP-3", `\`${name}\`: \`${variant}\` granted to ${short(user)}`);
      for (const user of old) if (!cur.has(user)) add("HIP-3", `\`${name}\`: \`${variant}\` revoked from ${short(user)}`);
    }
  }
  for (const name of Object.keys(before.dexs)) {
    if (!after.dexs[name]) add("HIP-3", `HIP-3 DEX no longer listed: \`${name}\``);
  }

  for (const venue of Object.keys(after.venues)) {
    if (!(venue in before.venues)) add("HIP-4", `New HIP-4 venue with live outcomes: \`${venue}\` (${after.venues[venue]})`);
  }
  for (const venue of Object.keys(before.venues)) {
    if (!(venue in after.venues)) add("HIP-4", `HIP-4 venue has no live outcomes any more: \`${venue}\``);
  }

  for (const [id, now] of Object.entries(after.templates)) {
    if (!(id in before.templates)) add("templates", `New outcome template: \`${id}\``);
    else if (before.templates[id] !== now) add("templates", `Outcome template changed: \`${id}\``);
  }
  for (const id of Object.keys(before.templates)) {
    if (!(id in after.templates)) add("templates", `Outcome template removed: \`${id}\``);
  }
  return entries;
}

function diffDocs(before: DocsState, after: DocsState, time: string): Entry[] {
  const entries: Entry[] = [];
  const add = (summary: string) => entries.push({ time, network: "docs", area: "docs", summary });
  const link = (path: string, title: string) => `[${title}](${DOCS}/${path})`;
  for (const [path, now] of Object.entries(after.pages)) {
    const was = before.pages[path];
    if (!was) add(`New docs page: ${link(path, now.title)}`);
    else if (was.hash && now.hash && was.hash !== now.hash) add(`Docs page edited: ${link(path, now.title)}`);
  }
  for (const [path, was] of Object.entries(before.pages)) {
    if (!after.pages[path]) add(`Docs page removed: ${was.title}`);
  }
  return entries;
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(path: string, value: unknown) {
  await writeFile(path, JSON.stringify(value, null, 2) + "\n");
}

async function main() {
  const time = new Date().toISOString();
  await mkdir(SNAPSHOTS, { recursive: true });
  const entries: Entry[] = [];
  const counts: Record<string, Record<string, number>> = {};

  for (const network of ["mainnet", "testnet"] as const) {
    const path = `${SNAPSHOTS}/${network}.json`;
    const before = await readJson<NetworkState | null>(path, null);
    const after = await readNetwork(network);
    if (before) entries.push(...diffNetwork(network, before, after, time));
    await writeJson(path, after);
    counts[network] = {
      perps: Object.values(after.perps).filter((p) => !p.delisted).length,
      dexs: Object.keys(after.dexs).length,
      venues: Object.keys(after.venues).filter((v) => v !== "protocol").length,
      templates: Object.keys(after.templates).length,
    };
  }

  const docsPath = `${SNAPSHOTS}/docs.json`;
  const docsBefore = await readJson<DocsState | null>(docsPath, null);
  const docsAfter = await readDocs();
  if (docsBefore) entries.push(...diffDocs(docsBefore, docsAfter, time));
  await writeJson(docsPath, docsAfter);
  counts.docs = { pages: Object.keys(docsAfter.pages).length };

  const log = await readJson<Entry[]>(CHANGELOG, []);
  await writeJson(CHANGELOG, [...entries, ...log].slice(0, MAX_ENTRIES));
  const meta = await readJson<{ trackingSince?: string }>(META, {});
  await writeJson(META, { trackingSince: meta.trackingSince ?? time, lastRun: time, counts });

  console.log(`${entries.length} change(s) recorded at ${time}`);
}

await main();
