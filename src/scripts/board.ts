// The homepage's departure board: Hyperliquid's live perp mid prices on split-flap cells, each price's
// change over 24 hours, and the time left until the next hourly funding payment. Mids come from the
// allMids feed (hl-feed.ts), after one allMids call over HTTP to fill the board at once, since the
// feed's first message can take several seconds; the price 24 hours ago, prevDayPx, comes from a
// metaAndAssetCtxs call every few minutes. A character that changes flips over like a flap on a
// Solari board.
//
// While the reader has paused the motion (motion.ts), the board holds still and catches up when it
// resumes. With reduced motion, characters change without flipping.

import { subscribe, onConnection } from "./hl-feed";
import { isPaused, onMotionChange } from "./motion";
import { info } from "../lib/markets";

type Row = { flaps: HTMLElement[]; text: HTMLElement; chg: HTMLElement; shown: string | null };
type Ctx = { prevDayPx: string };

const board = document.querySelector<HTMLElement>("[data-board]");
if (board) run(board);

function run(board: HTMLElement) {
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const caption = board.querySelector<HTMLElement>("[data-board-caption]");
  const clock = board.querySelector<HTMLElement>("[data-funding]");
  const rows = new Map<string, Row>();
  for (const tr of board.querySelectorAll<HTMLElement>("[data-mid]")) {
    rows.set(tr.dataset.mid!, {
      flaps: [...tr.querySelectorAll<HTMLElement>("[data-px] .flap")],
      text: tr.querySelector<HTMLElement>("[data-px-text]")!,
      chg: tr.querySelector<HTMLElement>("[data-chg]")!,
      shown: null,
    });
  }

  let mids: Record<string, string> | null = null;
  let prevDay = new Map<string, number>();
  let up = false;
  let filled = false;

  const say = (text: string, state: string) => {
    if (!caption || (caption.textContent === text && caption.dataset.state === state)) return;
    caption.textContent = text;
    caption.dataset.state = state;
  };
  const status = () => {
    if (!filled) say("Loading prices from api.hyperliquid.xyz…", "waiting");
    else if (!up) say("Lost the feed from api.hyperliquid.xyz; reconnecting…", "waiting");
    else if (isPaused()) say("Paused: the prices as they stood when the motion was paused.", "paused");
    else say("Live from Hyperliquid mainnet's allMids feed.", "live");
  };

  // Prices as a mid is usually quoted: whole dollars for BTC, more decimals the cheaper the coin.
  const format = (p: number) => {
    const digits = p >= 10_000 ? 0 : p >= 1000 ? 1 : p >= 100 ? 2 : p >= 1 ? 3 : 5;
    return p.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  };

  function paint() {
    if (!mids || isPaused()) return;
    rows.forEach((row, coin) => {
      const raw = mids![coin];
      if (raw === undefined) return;
      const p = Number(raw);
      const shown = format(p);
      const first = row.shown === null;
      if (shown !== row.shown) {
        const cells = shown.padStart(row.flaps.length, " ").slice(-row.flaps.length);
        row.flaps.forEach((flap, i) => {
          if (first && !still) rattle(flap, cells[i], i * 45 + [...rows.keys()].indexOf(coin) * 70);
          else flip(flap, cells[i], !still);
        });
        row.text.textContent = shown;
        row.shown = shown;
      }
      const ref = prevDay.get(coin);
      if (ref) {
        const pct = ((p - ref) / ref) * 100;
        const sign = pct >= 0.005 ? "up" : pct <= -0.005 ? "down" : "flat";
        row.chg.dataset.dir = sign;
        row.chg.textContent = `${sign === "up" ? "▲" : sign === "down" ? "▼" : "■"} ${Math.abs(pct).toFixed(2)}%`;
      }
    });
    filled = true;
    board.classList.add("is-live");
    status();
  }

  // Funding is paid on the hour, every hour (UTC).
  function tick() {
    if (!clock || isPaused()) return;
    const left = 3600 - (Math.floor(Date.now() / 1000) % 3600);
    clock.textContent = `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
  }

  async function loadPrevDay() {
    try {
      const [meta, ctxs] = await info<[{ universe: { name: string }[] }, Ctx[]]>({ type: "metaAndAssetCtxs" });
      const next = new Map<string, number>();
      meta.universe.forEach((m, i) => {
        const v = Number(ctxs[i]?.prevDayPx);
        if (rows.has(m.name) && v > 0) next.set(m.name, v);
      });
      prevDay = next;
      paint();
    } catch {
      // The change column waits for the next try.
    }
  }

  const take = (next: Record<string, string>) => {
    const first = !mids;
    mids = next;
    if (first) paint();
  };
  info<Record<string, string>>({ type: "allMids" }).then(take, () => {
    // The feed below fills the board instead.
  });
  subscribe({ type: "allMids" }, (data: { mids?: Record<string, string> }) => {
    if (data?.mids) take(data.mids);
  });
  onConnection((on) => {
    up = on;
    status();
  });
  onMotionChange(() => {
    status();
    paint();
    tick();
  });
  loadPrevDay();
  setInterval(loadPrevDay, 5 * 60_000);
  setInterval(paint, 2000);
  setInterval(tick, 1000);
  tick();
  status();
}

/** Turns a flap to `next`: the old top half falls away to show the new one, then the new bottom half
 *  swings down over the old. A flap that's mid-turn finishes at once before the next turn starts. */
function flip(flap: HTMLElement, next: string, animate: boolean) {
  const prev = flap.dataset.ch ?? " ";
  if (prev === next) return;
  const [top, bottom] = [flap.querySelector<HTMLElement>(".u")!, flap.querySelector<HTMLElement>(".d")!];
  flap.querySelectorAll(".fall, .rise").forEach((leaf) => leaf.remove());
  bottom.textContent = prev;
  flap.dataset.ch = next;
  top.textContent = next;
  if (!animate) {
    bottom.textContent = next;
    return;
  }
  const leaf = (cls: string, ch: string) => {
    const el = document.createElement("span");
    el.className = cls;
    el.textContent = ch;
    return el;
  };
  const fall = leaf("fall", prev);
  const rise = leaf("rise", next);
  flap.append(fall, rise);
  rise.addEventListener("animationend", () => {
    bottom.textContent = next;
    fall.remove();
    rise.remove();
  }, { once: true });
}

/** The first fill: each flap runs through a few digits before it lands, as a board does when it wakes. */
function rattle(flap: HTMLElement, final: string, delay: number) {
  const turns = 2 + Math.floor(Math.random() * 4);
  for (let i = 0; i < turns; i++) {
    setTimeout(() => flip(flap, String(Math.floor(Math.random() * 10)), true), delay + i * 85);
  }
  setTimeout(() => flip(flap, final, true), delay + turns * 85);
}
