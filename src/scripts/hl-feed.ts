// One WebSocket to Hyperliquid's public feed, shared by everything on the page that wants live data.
// It opens on the first subscription, closes while the tab is hidden, and reconnects with a backoff.

export type Level = { px: string; sz: string; n: number };
export type Book = { coin: string; time: number; levels: [Level[], Level[]] };
type Sub = { type: "l2Book"; coin: string; nSigFigs?: number } | { type: "allMids" };
type Entry = { sub: Sub; handlers: Set<(data: any) => void> };

const URL = "wss://api.hyperliquid.xyz/ws";
const entries = new Map<string, Entry>();
const watchers = new Set<(up: boolean) => void>();
let ws: WebSocket | null = null;
let backoff = 1000;
let ping = 0;
let retry = 0;

const keyOf = (s: Sub) => (s.type === "l2Book" ? `l2Book:${s.coin}` : s.type);

function send(msg: object) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function setUp(up: boolean) {
  for (const w of watchers) w(up);
}

function open() {
  if (ws || entries.size === 0 || document.hidden) return;
  try {
    ws = new WebSocket(URL);
  } catch {
    setUp(false);
    return;
  }
  ws.addEventListener("open", () => {
    backoff = 1000;
    for (const { sub } of entries.values()) send({ method: "subscribe", subscription: sub });
    ping = window.setInterval(() => send({ method: "ping" }), 45_000);
    setUp(true);
  });
  ws.addEventListener("message", (e) => {
    let msg: { channel?: string; data?: any };
    try { msg = JSON.parse(e.data); } catch { return; }
    const key = msg.channel === "l2Book" ? `l2Book:${msg.data?.coin}` : msg.channel;
    const entry = key ? entries.get(key) : undefined;
    if (entry) for (const h of entry.handlers) h(msg.data);
  });
  ws.addEventListener("close", () => {
    clearInterval(ping);
    ws = null;
    setUp(false);
    if (entries.size && !document.hidden) {
      retry = window.setTimeout(open, backoff);
      backoff = Math.min(backoff * 2, 30_000);
    }
  });
  ws.addEventListener("error", () => ws?.close());
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    clearTimeout(retry);
    ws?.close();
  } else open();
});

/** Calls `handler` with each message for `sub`. Returns a function that stops it. */
export function subscribe(sub: Sub, handler: (data: any) => void): () => void {
  const key = keyOf(sub);
  let entry = entries.get(key);
  if (!entry) {
    entry = { sub, handlers: new Set() };
    entries.set(key, entry);
    send({ method: "subscribe", subscription: sub });
  }
  entry.handlers.add(handler);
  open();
  return () => {
    const e = entries.get(key);
    if (!e) return;
    e.handlers.delete(handler);
    if (e.handlers.size === 0) {
      entries.delete(key);
      send({ method: "unsubscribe", subscription: e.sub });
      if (entries.size === 0) ws?.close();
    }
  };
}

/** Tells `fn` whenever the connection comes up or goes down. */
export function onConnection(fn: (up: boolean) => void) {
  watchers.add(fn);
}
