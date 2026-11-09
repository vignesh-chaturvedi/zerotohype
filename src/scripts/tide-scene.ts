// The homepage ridges: the shape of each order-book snapshot, the slide, and the drawing. The page
// (tide.ts) drives it with messages, so the same code runs in a worker (tide-worker.ts), which keeps
// the animation off the main thread, or on the main thread where a canvas can't be handed to a worker.

import type { Book } from "./hl-feed";

const COIN = "BTC";
const N = 34; // ridges on screen
const K = 121; // points per ridge
const SLIDE = 780; // ms for a new ridge to move into place
const FOCAL = 7; // perspective: bigger is flatter

export type Colors = { bg: string; bid: string; ask: string; ink: string };
export type Msg =
  | { type: "size"; w: number; h: number; dpr: number }
  | { type: "colors"; colors: Colors; mono: string }
  | { type: "push"; book?: Book; fill?: boolean } // a new ridge at the front; without a book, a simulated one
  | { type: "pointer"; at: { x: number; y: number } | null }
  | { type: "play"; on: boolean }
  | { type: "redraw" };

type Ridge = { cum: Float32Array; mid: number; span: number };
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function createScene(canvas: HTMLCanvasElement | OffscreenCanvas, reduce: boolean): (msg: Msg) => void {
  const context = (canvas as OffscreenCanvas).getContext("2d") as Ctx | null;
  if (!context) return () => {};
  const ctx = context;
  // Workers that lack requestAnimationFrame get a timer instead.
  const nextFrame = typeof requestAnimationFrame === "function"
    ? (cb: FrameRequestCallback) => requestAnimationFrame(cb)
    : (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16) as unknown as number;
  const cancelFrame = typeof cancelAnimationFrame === "function" ? (id: number) => cancelAnimationFrame(id) : (id: number) => clearTimeout(id);

  const C: Colors = { bg: "", bid: "", ask: "", ink: "" };
  let mono = "monospace";
  let lineGrad: CanvasGradient | null = null;
  let washGrad: CanvasGradient | null = null;

  let ridges: Ridge[] = [];
  let spanRef = 0;
  let depthRef = 0;
  let pushedAt = 0;
  let pointer: { x: number; y: number } | null = null;
  let w = 0, h = 0, dpr = 1;
  let running = false;
  let frameId = 0;
  let dirty = true; // set when something besides the slide changes the picture

  function setColors(colors: Colors, font: string) {
    Object.assign(C, colors);
    mono = font || "monospace";
    const hex = C.ink.replace("#", "");
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) || 0);
    const haze = `rgba(${r}, ${g}, ${b}, 0.035)`;
    // Both gradients are made once per theme in unit space, and the transform places them on each
    // ridge: the line's runs from x = -1 (far bids) to 1 (far asks), the wash's from y = 0 to 1.
    lineGrad = ctx.createLinearGradient(-1, 0, 1, 0);
    lineGrad.addColorStop(0, C.bid);
    lineGrad.addColorStop(0.47, C.bid);
    lineGrad.addColorStop(0.5, C.ink);
    lineGrad.addColorStop(0.53, C.ask);
    lineGrad.addColorStop(1, C.ask);
    washGrad = ctx.createLinearGradient(0, 0, 0, 1);
    washGrad.addColorStop(0, haze);
    washGrad.addColorStop(1, "transparent");
  }

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
    if (reduce || !running) draw(pushedAt);
  }

  // A made-up book, used only when the live feed can't be reached, and labelled as such.
  let simMid = 100_000;
  function simulated(): Book {
    simMid += (Math.random() - 0.5) * 12;
    const lv = (sign: number): Book["levels"][0] =>
      Array.from({ length: 20 }, (_, i) => ({ px: String(simMid + sign * (5 + i * 10)), sz: String((0.4 + Math.random() * 1.6) * (1 + i * 0.12)), n: 1 }));
    return { coin: COIN, time: Date.now(), levels: [lv(-1), lv(1)] };
  }

  // Screen geometry of a ridge at depth `d` (0 = front).
  const geo = (d: number) => {
    const s = FOCAL / (FOCAL + d);
    const front = h * 0.95, horizon = h * 0.52;
    return { s, base: horizon + (front - horizon) * s, half: w * 0.72 * s, amp: h * 0.42 * s };
  };
  const height = (v: number) => Math.min(1.25, Math.sqrt(v / (depthRef || 1)));

  // Where each of the K points sits across a ridge, from -1 (far bids) to 1 (far asks), and the
  // screen height of each point on the ridge being drawn.
  const U = Float32Array.from({ length: K }, (_, k) => (k / (K - 1)) * 2 - 1);
  const ys = new Float32Array(K);
  // One ridge's outline: up from `floor` at its left end, along the line through every `step`-th
  // point, and back down at its right end. It is left open: fill closes it, and stroke skips the floor.
  function trace(cx: number, half: number, floor: number, step: number) {
    ctx.beginPath();
    ctx.moveTo(cx - half, floor);
    for (let k = 0; k < K - 1; k += step) ctx.lineTo(cx + U[k] * half, ys[k]);
    ctx.lineTo(cx + half, ys[K - 1]);
    ctx.lineTo(cx + half, floor);
  }

  function draw(now: number) {
    dirty = false;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, w, h);
    if (!ridges.length || !w || !h || !lineGrad || !washGrad) return;
    const t = reduce ? 1 : Math.min(1, (now - pushedAt) / SLIDE);
    const prog = 1 - Math.pow(1 - t, 3);
    const cx = w / 2;

    for (let i = ridges.length - 1; i >= 0; i--) {
      const d = i - (1 - prog);
      if (d > N - 0.01) continue;
      const g = geo(d + 0.6);
      const r = ridges[i];
      const fade = Math.min(1, (N - d) / 3) * Math.pow(g.s, 0.55);
      for (let k = 0; k < K; k++) ys[k] = g.base - g.amp * height(r.cum[k]);
      // Points closer than 2.5 px apart add nothing visible, so narrow (far) ridges skip some.
      const step = Math.max(1, Math.floor(2.5 / ((2 * g.half) / (K - 1))));
      // Hide the ridges behind this one.
      trace(cx, g.half, h + 2, step);
      ctx.fillStyle = C.bg;
      ctx.fill();
      // A faint wash of each side's colour under the line, so the layers read as a landscape. It has
      // faded out by `fadeEnd`, so only the band above that is filled. The nearer ridges cover
      // everything below it, so the same outline serves for the line, whose ends drop to it.
      const top = g.base - g.amp, fadeEnd = g.base + h * 0.12;
      trace(cx, g.half, Math.min(fadeEnd, h + 2), step);
      ctx.setTransform(dpr, 0, 0, dpr * (fadeEnd - top), 0, dpr * top);
      ctx.globalAlpha = Math.max(0, Math.min(1, fade));
      ctx.fillStyle = washGrad;
      ctx.fill();
      // The line. Scaling by the ridge's half-width stretches the unit gradient across it, and the
      // line width is divided by the same factor so it comes out unchanged.
      ctx.setTransform(dpr * g.half, 0, 0, dpr * g.half, dpr * cx, 0);
      ctx.globalAlpha = Math.max(0, Math.min(1, fade * 0.95));
      ctx.strokeStyle = lineGrad;
      ctx.lineWidth = (i === 0 ? 1.8 : 1.1) / g.half;
      ctx.stroke();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
    }

    // Labels and the pointer readout on the front ridge.
    const r = ridges[0];
    const g = geo(-(1 - prog) + 0.6);
    ctx.font = `500 11px ${mono}`;
    ctx.textBaseline = "alphabetic";
    const valley = g.base - g.amp * height(r.cum[(K - 1) / 2]);
    const label = `${COIN} ${r.mid.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
    ctx.fillStyle = C.ink;
    ctx.textAlign = "center";
    ctx.fillText(label, cx, valley - 14);
    ctx.fillRect(cx - 0.5, valley - 8, 1, 6);
    // Side labels ride the front ridge, a little in from each edge.
    const at = (x: number) => {
      const u = Math.max(-1, Math.min(1, (x - cx) / g.half));
      return g.base - g.amp * height(r.cum[Math.round(((u + 1) / 2) * (K - 1))]);
    };
    const inset = Math.min(64, w * 0.08);
    ctx.fillStyle = C.bid;
    ctx.textAlign = "left";
    ctx.fillText("BIDS", inset, at(inset) - 12);
    ctx.fillStyle = C.ask;
    ctx.textAlign = "right";
    ctx.fillText("ASKS", w - inset, at(w - inset) - 12);
    if (pointer) {
      const u = (pointer.x - cx) / g.half;
      if (Math.abs(u) <= 1 && Math.abs(u) > 0.01) {
        const k = Math.round(((u + 1) / 2) * (K - 1));
        const y = g.base - g.amp * height(r.cum[k]);
        const bid = u < 0;
        const dist = Math.abs(u) * r.span;
        ctx.strokeStyle = bid ? C.bid : C.ask;
        ctx.lineWidth = 1.8;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(pointer.x, y);
        ctx.lineTo(pointer.x, h);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = bid ? C.bid : C.ask;
        ctx.beginPath();
        ctx.arc(pointer.x, y, 3.5, 0, Math.PI * 2);
        ctx.fill();
        const text = `${r.cum[k].toFixed(2)} ${COIN} ${bid ? "bid" : "offered"} within $${dist.toFixed(0)}`;
        ctx.textAlign = pointer.x > w - 240 ? "right" : "left";
        ctx.fillText(text, pointer.x + (pointer.x > w - 240 ? -10 : 10), y - 10);
      }
    }
  }

  function frame(now: number) {
    // Between slides nothing moves, so frames that would repaint the same picture are skipped.
    if (dirty || now - pushedAt < SLIDE + 50) draw(now);
    frameId = nextFrame(frame);
  }
  function play(on: boolean) {
    if (reduce) return;
    cancelFrame(frameId);
    running = on;
    frameId = on ? nextFrame(frame) : 0;
  }
  // Repaint now when nothing is animating, otherwise on the next frame.
  function redraw() {
    dirty = true;
    if (reduce || !running) draw(performance.now());
  }

  return (msg: Msg) => {
    switch (msg.type) {
      case "size":
        w = msg.w;
        h = msg.h;
        dpr = Math.min(msg.dpr || 1, 2);
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        redraw();
        break;
      case "colors":
        setColors(msg.colors, msg.mono);
        redraw();
        break;
      case "push":
        push(msg.book ?? simulated(), msg.fill);
        break;
      case "pointer":
        pointer = msg.at;
        redraw();
        break;
      case "play":
        play(msg.on);
        break;
      case "redraw":
        redraw();
        break;
    }
  };
}
