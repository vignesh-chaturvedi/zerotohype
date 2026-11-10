// The price tape under the homepage stage: live mid prices from Hyperliquid's allMids feed.
// Each price flashes mint when it ticks up and orange when it ticks down. While the reader has paused
// the motion (motion.ts), the prices hold still too, and catch up when it resumes.

import { subscribe } from "./hl-feed";
import { isPaused } from "./motion";

const tape = document.querySelector<HTMLElement>("[data-tape]");
if (tape) {
  const cells = new Map<string, HTMLElement[]>();
  for (const el of tape.querySelectorAll<HTMLElement>("[data-mid]")) {
    const coin = el.dataset.mid!;
    cells.set(coin, [...(cells.get(coin) ?? []), el]);
  }
  const last = new Map<string, number>();
  let pending: Record<string, string> | null = null;

  const format = (p: number) => {
    const digits = p >= 1000 ? 0 : p >= 100 ? 1 : p >= 1 ? 3 : 5;
    return p.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  };

  function paint() {
    if (!pending || isPaused()) return;
    const mids = pending;
    pending = null;
    for (const [coin, els] of cells) {
      const raw = mids[coin];
      if (raw === undefined) continue;
      const p = Number(raw);
      const prev = last.get(coin);
      last.set(coin, p);
      for (const el of els) {
        const out = el.querySelector("b");
        if (out) out.textContent = format(p);
        if (prev !== undefined && p !== prev) {
          el.classList.remove("up", "down");
          void el.offsetWidth;
          el.classList.add(p > prev ? "up" : "down");
        }
      }
    }
    tape!.classList.add("is-live");
  }

  subscribe({ type: "allMids" }, (data: { mids?: Record<string, string> }) => {
    if (data?.mids) pending = data.mids;
  });
  setInterval(paint, 1000);
}
