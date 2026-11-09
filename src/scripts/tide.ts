// The homepage backdrop: Hyperliquid's live BTC order book drawn as a stack of ridges. Each ridge is
// one snapshot of the book, with the bids rising to the left of the mid price and the asks to the
// right; the newest slides in at the front and older ones recede towards the horizon.

import { subscribe, onConnection, type Book } from "./hl-feed";

const COIN = "BTC";
const N = 34; // ridges on screen
const K = 121; // points per ridge
const STEP = 900; // ms between ridges
const SLIDE = 780; // ms for a new ridge to move into place
const FOCAL = 7; // perspective: bigger is flatter

type Ridge = { cum: Float32Array; mid: number; span: number };

const stage = document.querySelector<HTMLElement>("[data-tide]");
const canvas = stage?.querySelector("canvas");
if (stage && canvas) run(stage, canvas);

function run(stage: HTMLElement, canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const caption = stage.querySelector<HTMLElement>("[data-tide-caption]");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const css = getComputedStyle(stage);
  const color = (name: string) => css.getPropertyValue(name).trim();
  const C = { bg: color("--bg"), bid: color("--bid"), ask: color("--ask"), ink: color("--ink"), muted: color("--muted") };
  const mono = color("--data") || "monospace";
  const haze = "rgba(242, 239, 232, 0.035)";

  let ridges: Ridge[] = [];
  let latest: Book | null = null;
  let mode: "waiting" | "live" | "simulated" = "waiting";
  let spanRef = 0;
  let depthRef = 0;
  let pushedAt = 0;
  let visible = true;
  let raf = 0;
  let pointer: { x: number; y: number } | null = null;
  let w = 0, h = 0, dpr = 1;

  const say = (text: string, state: string) => {
    if (!caption) return;
    caption.textContent = text;
    caption.dataset.state = state;
  };

  // Cumulative size at K points from the far bids (u = -1) through the mid (u = 0) to the far asks (u = 1).
  function profile(book: Book, span: number): Ridge {
    const [bids, asks] = book.levels;
    const mid = (Number(bids[0]?.px) + Number(asks[0]?.px)) / 2;
    const side = (levels: typeof bids) => {
      const d: number[] = [0], c: number[] = [0];
      for (const l of levels) {
        d.push(Math.abs(Number(l.px) - mid));
        c.push(c[c.length - 1] + Number(l.sz));
      }
      return (dist: number) => {
        let i = 0;
        while (i < d.length - 1 && d[i + 1] <= dist) i++;
        if (i === d.length - 1) return c[i];
        return c[i] + ((dist - d[i]) / (d[i + 1] - d[i] || 1)) * (c[i + 1] - c[i]);
      };
    };
    const bidAt = side(bids), askAt = side(asks);
    const cum = new Float32Array(K);
    for (let k = 0; k < K; k++) {
      const u = (k / (K - 1)) * 2 - 1;
      cum[k] = u < 0 ? bidAt(-u * span) : askAt(u * span);
    }
    return { cum, mid, span };
  }

  function push(book: Book, fill = false) {
    const [bids, asks] = book.levels;
    if (!bids.length || !asks.length) return;
    const mid = (Number(bids[0].px) + Number(asks[0].px)) / 2;
    const reach = Math.min(Math.abs(Number(bids[bids.length - 1].px) - mid), Math.abs(Number(asks[asks.length - 1].px) - mid));
    spanRef = spanRef ? spanRef * 0.92 + reach * 0.08 : reach;
    const ridge = profile(book, spanRef);
    const edge = Math.max(ridge.cum[0], ridge.cum[K - 1]);
    depthRef = depthRef ? depthRef * 0.9 + edge * 0.1 : edge;
    if (fill) ridges = Array.from({ length: N + 1 }, () => ridge);
    else ridges = [ridge, ...ridges].slice(0, N + 1);
    pushedAt = performance.now();
    if (reduce) draw(pushedAt);
  }

  // A made-up book, used only when the live feed can't be reached, and labelled as such.
  let simMid = 100_000;
  function simulated(): Book {
    simMid += (Math.random() - 0.5) * 12;
    const lv = (sign: number): Book["levels"][0] =>
      Array.from({ length: 20 }, (_, i) => ({ px: String(simMid + sign * (5 + i * 10)), sz: String((0.4 + Math.random() * 1.6) * (1 + i * 0.12)), n: 1 }));
    return { coin: COIN, time: Date.now(), levels: [lv(-1), lv(1)] };
  }

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = stage.clientWidth;
    h = stage.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    if (reduce || !raf) draw(performance.now());
  }

  // Screen geometry of a ridge at depth `d` (0 = front).
  const geo = (d: number) => {
    const s = FOCAL / (FOCAL + d);
    const front = h * 0.95, horizon = h * 0.52;
    return { s, base: horizon + (front - horizon) * s, half: w * 0.72 * s, amp: h * 0.42 * s };
  };
  const height = (v: number) => Math.min(1.25, Math.sqrt(v / (depthRef || 1)));

  function draw(now: number) {
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx!.fillStyle = C.bg;
    ctx!.fillRect(0, 0, w, h);
    if (!ridges.length) return;
    const t = reduce ? 1 : Math.min(1, (now - pushedAt) / SLIDE);
    const prog = 1 - Math.pow(1 - t, 3);
    const cx = w / 2;

    for (let i = ridges.length - 1; i >= 0; i--) {
      const d = i - (1 - prog);
      if (d > N - 0.01) continue;
      const g = geo(d + 0.6);
      const r = ridges[i];
      const fade = Math.min(1, (N - d) / 3) * Math.pow(g.s, 0.55);
      ctx!.beginPath();
      ctx!.moveTo(cx - g.half, h + 2);
      for (let k = 0; k < K; k++) {
        const u = (k / (K - 1)) * 2 - 1;
        ctx!.lineTo(cx + u * g.half, g.base - g.amp * height(r.cum[k]));
      }
      ctx!.lineTo(cx + g.half, h + 2);
      ctx!.closePath();
      ctx!.fillStyle = C.bg;
      ctx!.fill();
      // A faint wash of each side's colour under the line, so the layers read as a landscape.
      const wash = ctx!.createLinearGradient(0, g.base - g.amp, 0, g.base + h * 0.12);
      wash.addColorStop(0, haze);
      wash.addColorStop(1, "transparent");
      ctx!.globalAlpha = Math.max(0, Math.min(1, fade));
      ctx!.fillStyle = wash;
      ctx!.fill();
      const grad = ctx!.createLinearGradient(cx - g.half, 0, cx + g.half, 0);
      grad.addColorStop(0, C.bid);
      grad.addColorStop(0.47, C.bid);
      grad.addColorStop(0.5, C.ink);
      grad.addColorStop(0.53, C.ask);
      grad.addColorStop(1, C.ask);
      ctx!.globalAlpha = Math.max(0, Math.min(1, fade * 0.95));
      ctx!.strokeStyle = grad;
      ctx!.lineWidth = i === 0 ? 1.8 : 1.1;
      ctx!.stroke();
      ctx!.globalAlpha = 1;
    }

    // Labels and the pointer readout on the front ridge.
    const r = ridges[0];
    const g = geo(-(1 - prog) + 0.6);
    ctx!.font = `500 11px ${mono}`;
    ctx!.textBaseline = "alphabetic";
    if (mode !== "waiting") {
      const valley = g.base - g.amp * height(r.cum[(K - 1) / 2]);
      const label = `${COIN} ${r.mid.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
      ctx!.fillStyle = C.ink;
      ctx!.textAlign = "center";
      ctx!.fillText(label, cx, valley - 14);
      ctx!.fillRect(cx - 0.5, valley - 8, 1, 6);
      // Side labels ride the front ridge, a little in from each edge.
      const at = (x: number) => {
        const u = Math.max(-1, Math.min(1, (x - cx) / g.half));
        return g.base - g.amp * height(r.cum[Math.round(((u + 1) / 2) * (K - 1))]);
      };
      const inset = Math.min(64, w * 0.08);
      ctx!.fillStyle = C.bid;
      ctx!.textAlign = "left";
      ctx!.fillText("BIDS", inset, at(inset) - 12);
      ctx!.fillStyle = C.ask;
      ctx!.textAlign = "right";
      ctx!.fillText("ASKS", w - inset, at(w - inset) - 12);
    }
    if (pointer && mode !== "waiting") {
      const u = (pointer.x - cx) / g.half;
      if (Math.abs(u) <= 1 && Math.abs(u) > 0.01) {
        const k = Math.round(((u + 1) / 2) * (K - 1));
        const y = g.base - g.amp * height(r.cum[k]);
        const bid = u < 0;
        const dist = Math.abs(u) * r.span;
        ctx!.strokeStyle = bid ? C.bid : C.ask;
        ctx!.setLineDash([2, 4]);
        ctx!.beginPath();
        ctx!.moveTo(pointer.x, y);
        ctx!.lineTo(pointer.x, h);
        ctx!.stroke();
        ctx!.setLineDash([]);
        ctx!.fillStyle = bid ? C.bid : C.ask;
        ctx!.beginPath();
        ctx!.arc(pointer.x, y, 3.5, 0, Math.PI * 2);
        ctx!.fill();
        const text = `${r.cum[k].toFixed(2)} ${COIN} ${bid ? "bid" : "offered"} within $${dist.toFixed(0)}`;
        ctx!.textAlign = pointer.x > w - 240 ? "right" : "left";
        ctx!.fillText(text, pointer.x + (pointer.x > w - 240 ? -10 : 10), y - 10);
      }
    }
  }

  function frame(now: number) {
    draw(now);
    raf = requestAnimationFrame(frame);
  }
  function play(on: boolean) {
    if (reduce) return;
    cancelAnimationFrame(raf);
    raf = on ? requestAnimationFrame(frame) : 0;
  }

  new ResizeObserver(resize).observe(stage);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; play(visible && !document.hidden); }).observe(stage);
  document.addEventListener("visibilitychange", () => play(visible && !document.hidden));
  stage.addEventListener("pointermove", (e) => {
    const box = stage.getBoundingClientRect();
    pointer = { x: e.clientX - box.left, y: e.clientY - box.top };
    if (reduce) draw(performance.now());
  });
  stage.addEventListener("pointerleave", () => { pointer = null; if (reduce) draw(performance.now()); });

  const stop = subscribe({ type: "l2Book", coin: COIN, nSigFigs: 4 }, (book: Book) => {
    latest = book;
    if (mode !== "live") {
      mode = "live";
      push(book, true);
      stage.classList.add("has-tide");
      say(`Live: the ${COIN} order book on Hyperliquid, one snapshot per ridge, newest in front.`, "live");
      if (reduce) stop();
    }
  });
  onConnection((up) => {
    if (!up && mode === "live") say(`Reconnecting to the ${COIN} order book…`, "waiting");
    if (up && mode === "live") say(`Live: the ${COIN} order book on Hyperliquid, one snapshot per ridge, newest in front.`, "live");
  });
  setTimeout(() => {
    if (mode !== "waiting") return;
    mode = "simulated";
    push(simulated(), true);
    stage.classList.add("has-tide");
    say("Simulated depth: the live order book didn't load. Refresh to try again.", "simulated");
  }, 6000);

  if (!reduce) {
    setInterval(() => {
      if (!visible || document.hidden) return;
      if (mode === "live" && latest) push(latest);
      else if (mode === "simulated") push(simulated());
    }, STEP);
  }
}
