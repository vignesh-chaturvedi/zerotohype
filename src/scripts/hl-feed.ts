// One WebSocket to Hyperliquid's public feed, shared by everything on the page that wants live data.
// It opens on the first subscription, closes while the tab is hidden, and reconnects with a backoff.

export type Level = { px: string; sz: string; n: number };
export type Book = { coin: string; time: number; levels: [Level[], Level[]] };
/** An order book. By default the server sends 20 levels a side every few seconds; with `fast`, 5 levels
 *  about twice a second. `nSigFigs` (2 to 5) groups prices, and `mantissa` (2 or 5) goes only with
 *  nSigFigs 5. For a coin it doesn't list, or a grouping it doesn't offer, the server drops the whole
 *  connection without a message (checked on 11 Nov 2026), so only send settings from that list. */
export type BookSub = { type: "l2Book"; coin: string; nSigFigs?: number; mantissa?: number; fast?: boolean };
type Sub = BookSub | { type: "allMids" };
type Entry = { sub: Sub; handlers: Set<(data: any) => void> };

const URL = "wss://api.hyperliquid.xyz/ws";
const entries = new Map<string, Entry>();
const watchers = new Set<(up: boolean) => void>();
// A book's messages name only the coin, not the settings, so two books of one coin can't be told apart.
// While an unsubscribe is waiting for the server's answer, that coin's books are dropped: whoever switches
// a book's grouping never sees a message from the old one.
const draining = new Map<string, number>();
let ws: WebSocket | null = null;
let backoff = 1000;
let ping = 0;
let retry = 0;

const keyOf = (s: Sub) => (s.type === "l2Book" ? `l2Book:${s.coin}:${s.nSigFigs ?? ""}:${s.mantissa ?? ""}:${s.fast ? "fast" : ""}` : s.type);

function send(msg: object) {
  if (ws?.readyState !== WebSocket.OPEN) return false;
  ws.send(JSON.stringify(msg));
  return true;
}

function setUp(up: boolean) {
  for (const w of watchers) w(up);
}

function deliver(msg: { channel?: string; data?: any }) {
  if (msg.channel === "subscriptionResponse") {
    const { method, subscription } = msg.data ?? {};
    if (method === "unsubscribe" && subscription?.type === "l2Book") {
      const left = (draining.get(subscription.coin) ?? 1) - 1;
      if (left > 0) draining.set(subscription.coin, left);
      else draining.delete(subscription.coin);
    }
    return;
  }
  if (msg.channel === "l2Book") {
    const coin = msg.data?.coin;
    if (draining.has(coin)) return;
    for (const { sub, handlers } of entries.values()) {
      if (sub.type === "l2Book" && sub.coin === coin) for (const h of handlers) h(msg.data);
    }
    return;
  }
  const entry = msg.channel ? entries.get(msg.channel) : undefined;
  if (entry) for (const h of entry.handlers) h(msg.data);
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
    try {
      deliver(JSON.parse(e.data));
    } catch {
      // Not JSON: nothing to deliver.
    }
  });
  ws.addEventListener("close", () => {
    clearInterval(ping);
    ws = null;
    draining.clear();
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
      if (send({ method: "unsubscribe", subscription: e.sub }) && e.sub.type === "l2Book") {
        draining.set(e.sub.coin, (draining.get(e.sub.coin) ?? 0) + 1);
      }
      // Closed only if nothing subscribes straight after, as a lab does when it switches books.
      queueMicrotask(() => {
        if (entries.size === 0) ws?.close();
      });
    }
  };
}

/** Tells `fn` whenever the connection comes up or goes down. */
export function onConnection(fn: (up: boolean) => void) {
  watchers.add(fn);
}
