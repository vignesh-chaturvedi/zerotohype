// Motion for the track drawings and the hero chart. While a drawing is hovered (or, on touch
// screens, on screen), dots travel along its lines; the chart-like drawings also get a crosshair
// that follows the pointer and says what it is over. Nothing runs while nothing is hovered.

const NS = "http://www.w3.org/2000/svg";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const noHover = matchMedia("(hover: none)").matches;
const SPEED = 62; // drawing units per second

type Pt = { x: number; y: number };
type Flow = { el: SVGGeometryElement; len: number; mode?: string; dots: SVGCircleElement[]; offset: number };

const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent: Element) => {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  parent.appendChild(node);
  return node;
};

function sample(path: SVGGeometryElement, n = 260): Pt[] {
  const len = path.getTotalLength();
  return Array.from({ length: n + 1 }, (_, i) => {
    const p = path.getPointAtLength((len * i) / n);
    return { x: p.x, y: p.y };
  });
}

/** The y of a left-to-right path at x. On a vertical step it takes the value after the step. */
function yAt(pts: Pt[], x: number): number {
  let best = pts[0];
  let gap = Infinity;
  for (const p of pts) {
    const d = Math.abs(p.x - x);
    if (d <= gap + 0.05) {
      gap = Math.min(gap, d);
      best = p;
    }
  }
  return best.y;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function setup(svg: SVGSVGElement) {
  const kind = svg.dataset.kind ?? "";
  const host = (svg.closest("a") ?? svg.closest(".cover") ?? svg) as HTMLElement | SVGElement;
  const vbW = svg.viewBox.baseVal.width;
  const vbH = svg.viewBox.baseVal.height;

  // Travelling dots.
  const ptsLayer = el("g", { class: "pts" }, svg);
  const flows: Flow[] = [...svg.querySelectorAll<SVGGeometryElement>("[data-flow]")].map((path, i) => {
    const n = Number(path.dataset.flow) || 1;
    const dots = Array.from({ length: n }, () => el("circle", { r: 2.7, class: "pt" }, ptsLayer));
    const len = path.getTotalLength();
    // Stagger the lines so dots stream in one after another instead of moving in lockstep.
    return { el: path, len, mode: path.dataset.mode, dots, offset: ((i * 0.381) % 1) * len };
  });
  const near = [...svg.querySelectorAll<SVGGraphicsElement>("[data-near]")].map((node) => {
    const b = node.getBBox();
    return { node, x: b.x + b.width / 2, y: b.y + b.height / 2, r: Math.max(6, Math.max(b.width, b.height) / 2 + 2) };
  });

  // Crosshair.
  const xh = el("g", { class: "xh" }, svg);
  const line = el("line", { class: "xh-line" }, xh);
  const dot = el("circle", { class: "xh-dot", r: 3.6 }, xh);
  const labelBg = el("rect", { class: "xh-bg", rx: 3 }, xh);
  const label = el("text", { class: "xh-text" }, xh);
  const snaps: Record<string, Pt[]> = {};
  svg.querySelectorAll<SVGGeometryElement>("[data-snap]").forEach((p) => (snaps[p.dataset.snap!] = sample(p)));

  const setLabel = (text: string, x: number, y: number) => {
    label.textContent = text;
    const right = x > vbW * 0.62;
    label.setAttribute("text-anchor", right ? "end" : "start");
    label.setAttribute("x", String(right ? x - 9 : x + 9));
    label.setAttribute("y", String(clamp(y - 9, 14, vbH - 6)));
    const b = label.getBBox();
    labelBg.setAttribute("x", String(b.x - 4));
    labelBg.setAttribute("y", String(b.y - 2.5));
    labelBg.setAttribute("width", String(b.width + 8));
    labelBg.setAttribute("height", String(b.height + 5));
  };
  const vLine = (x: number, y1: number, y2: number) => {
    line.setAttribute("x1", String(x)); line.setAttribute("x2", String(x));
    line.setAttribute("y1", String(y1)); line.setAttribute("y2", String(y2));
  };
  const hLine = (y: number, x1: number, x2: number) => {
    line.setAttribute("x1", String(x1)); line.setAttribute("x2", String(x2));
    line.setAttribute("y1", String(y)); line.setAttribute("y2", String(y));
  };
  const putDot = (x: number, y: number) => { dot.setAttribute("cx", String(x)); dot.setAttribute("cy", String(y)); };
  const only = (nodes: Iterable<Element>, cls: string, keep?: Element | null) => {
    for (const n of nodes) n.classList.toggle(cls, n === keep);
  };

  const bars = [...svg.querySelectorAll<SVGRectElement>("[data-bar]")];
  const rungs = [...svg.querySelectorAll<SVGRectElement>("[data-rung]")];
  const routes = [...svg.querySelectorAll<SVGPathElement>("[data-row]")];
  const oracleDots = [...svg.querySelectorAll<SVGCircleElement>("[data-i]")];
  const nodeDots = [...svg.querySelectorAll<SVGCircleElement>("[data-node]")];
  const edgeLines = [...svg.querySelectorAll<SVGPathElement>(".edge")];
  const cells = [...svg.querySelectorAll<SVGRectElement>("[data-col]")];
  const seal = svg.querySelector(".seal");
  const ladderDot = svg.querySelector<SVGCircleElement>(".ladder-dot");

  let pointer = false;

  function moveLadder(i: number) {
    const r = rungs[i];
    if (!r || !ladderDot) return;
    only(rungs, "lit", r);
    ladderDot.setAttribute("cx", String(Number(r.dataset.end) + 9));
    ladderDot.setAttribute("cy", r.dataset.y!);
  }

  // Each chart-like drawing says what the pointer is over. Returns false when it has no crosshair.
  function point(p: Pt): boolean {
    switch (kind) {
      case "book": {
        const bid = p.x <= 207;
        const x = bid ? clamp(p.x, 111, 203) : clamp(p.x, 213, 304);
        const y = yAt(snaps[bid ? "bid" : "ask"], x);
        const edges = bid ? [110, 128, 146, 162, 178, 192, 204] : [212, 226, 242, 258, 276, 292, 305];
        const seg = edges.findIndex((e, i) => i < edges.length - 1 && x >= e && x <= edges[i + 1]);
        const level = bid ? 6 - seg : seg + 1;
        vLine(x, y, 168); putDot(x, y);
        setLabel(`${bid ? "BID" : "ASK"} · LEVEL ${level}`, x, y);
        return true;
      }
      case "funding": {
        const x = clamp(p.x, 111, 304);
        const y = yAt(snaps.curve, x);
        const i = clamp(Math.round((x - 116.5) / 12), 0, bars.length - 1);
        only(bars, "lit", bars[i]);
        const v = Number(bars[i].dataset.bar);
        vLine(x, 34, 172); putDot(x, y);
        setLabel(`HOUR ${i + 1} · ${v > 0 ? "LONGS PAY" : "SHORTS PAY"}`, x, y);
        return true;
      }
      case "oracle": {
        const x = clamp(p.x, 112, 304);
        const y = yAt(snaps.step, x);
        const i = clamp(Math.floor((x - 112) / 21), 0, oracleDots.length - 1);
        only(oracleDots, "lit", oracleDots[i]);
        vLine(x, y, 166); putDot(x, y);
        setLabel(`UPDATE ${i + 1} · T+${i * 3} S`, x, y);
        return true;
      }
      case "window": {
        const x = clamp(p.x, 111, 304);
        const y = yAt(snaps.trace, x);
        vLine(x, 40, 172); putDot(x, y);
        setLabel(`${x >= 248 ? "IN WINDOW" : "BEFORE WINDOW"} · ${y < 100 ? "ABOVE" : "BELOW"}`, x, y);
        return true;
      }
      case "ladder": {
        let i = 0;
        rungs.forEach((r, k) => { if (Math.abs(Number(r.dataset.y) - p.y) < Math.abs(Number(rungs[i].dataset.y) - p.y)) i = k; });
        moveLadder(i);
        const y = Number(rungs[i].dataset.y);
        hLine(y, 120, 305); putDot(120, y);
        setLabel(`LEVEL ${i + 1} OF ${rungs.length}`, 300, y);
        return true;
      }
      case "flow": {
        if (p.x > 245) { only(routes, "hot", null); return false; }
        let i = 0;
        routes.forEach((r, k) => { if (Math.abs(Number(r.dataset.y) - p.y) < Math.abs(Number(routes[i].dataset.y) - p.y)) i = k; });
        only(routes, "hot", routes[i]);
        const y = Number(routes[i].dataset.y);
        putDot(114, y); vLine(114, y, y);
        setLabel(`ORDER ${i + 1} · FEE TO BUILDER`, 120, y);
        return true;
      }
      case "nodes": {
        let i = 0;
        nodeDots.forEach((n, k) => {
          const d = Math.hypot(Number(n.getAttribute("cx")) - p.x, Number(n.getAttribute("cy")) - p.y);
          const best = Math.hypot(Number(nodeDots[i].getAttribute("cx")) - p.x, Number(nodeDots[i].getAttribute("cy")) - p.y);
          if (d < best) i = k;
        });
        only(nodeDots, "hot", nodeDots[i]);
        for (const e of edgeLines) e.classList.toggle("hot", e.dataset.a === String(i) || e.dataset.b === String(i));
        return false;
      }
      case "price": {
        const pad = Number(svg.dataset.pad), H = Number(svg.dataset.h), lo = Number(svg.dataset.lo), hi = Number(svg.dataset.hi);
        const t0 = Number(svg.dataset.t0), L = Number(svg.dataset.len);
        const x = clamp(p.x, pad, vbW - pad);
        const y = yAt(snaps.trace, x);
        const price = lo + ((H - pad - y) / (H - 2 * pad)) * (hi - lo);
        const sec = Math.round((t0 + ((x - pad) / (vbW - 2 * pad)) * (L - t0)) / 1000);
        vLine(x, 0, H); putDot(x, y);
        setLabel(`${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · ${sec < 0 ? "−" : "+"}${Math.abs(sec)} s`, x, y);
        return true;
      }
      default:
        return false;
    }
  }

  const toSvg = (e: PointerEvent): Pt => {
    const m = svg.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: q.x, y: q.y };
  };
  svg.addEventListener("pointermove", (e) => {
    pointer = true;
    svg.classList.toggle("has-pointer", point(toSvg(e)));
  });
  svg.addEventListener("pointerleave", () => {
    pointer = false;
    svg.classList.remove("has-pointer");
    only(bars, "lit", null); only(routes, "hot", null); only(nodeDots, "hot", null); only(edgeLines, "hot", null);
    if (!live) { only(oracleDots, "lit", null); only(rungs, "lit", null); }
  });

  // The animation loop runs only while the drawing is live.
  let live = false;
  let raf = 0;
  let start = 0;
  function frame(now: number) {
    if (!start) start = now;
    const t = (now - start) / 1000;
    const dotsAt: Pt[] = [];
    for (const f of flows) {
      f.dots.forEach((d, k) => {
        const phase = (t * SPEED + f.offset + (k * f.len) / f.dots.length) % (f.mode === "pingpong" ? 2 * f.len : f.len);
        const at = phase <= f.len ? phase : 2 * f.len - phase;
        const q = f.el.getPointAtLength(at);
        d.setAttribute("cx", String(q.x));
        d.setAttribute("cy", String(q.y));
        const fade = f.mode === "pingpong" ? 1 : Math.min(1, at / 10, (f.len - at) / 10);
        d.style.opacity = String(Math.max(0, fade));
        dotsAt.push({ x: q.x, y: q.y });
      });
    }
    for (const n of near) {
      const hit = dotsAt.some((q) => Math.hypot(q.x - n.x, q.y - n.y) < n.r);
      if (!(pointer && kind === "oracle")) n.node.classList.toggle("lit", hit);
    }
    if (kind === "sign") {
      const step = Math.floor(t * 7) % 12; // 8 columns, then the seal for a beat
      for (const c of cells) c.classList.toggle("lit", Number(c.dataset.col) === step);
      seal?.classList.toggle("lit", step >= 8);
    }
    if (kind === "ladder" && !pointer) moveLadder(Math.floor(t * 3) % rungs.length);
    raf = requestAnimationFrame(frame);
  }

  function setLive(on: boolean) {
    if (on === live) return;
    live = on;
    svg.classList.toggle("is-live", on);
    if (reduceMotion) return;
    if (on) { start = 0; raf = requestAnimationFrame(frame); }
    else {
      cancelAnimationFrame(raf);
      for (const c of cells) c.classList.remove("lit");
      seal?.classList.remove("lit");
      if (!pointer) { only(oracleDots, "lit", null); only(rungs, "lit", null); }
      for (const n of near) n.node.classList.remove("lit");
    }
  }

  // Drawings inside [data-motion-manual] run only when the page dispatches a "motion" event on them.
  svg.addEventListener("motion", (e) => setLive(Boolean((e as CustomEvent<boolean>).detail)));
  if (svg.closest("[data-motion-manual]")) return;
  if (noHover) {
    new IntersectionObserver(([entry]) => setLive(entry.isIntersecting), { threshold: 0.6 }).observe(host as Element);
  } else {
    host.addEventListener("pointerenter", () => setLive(true));
    host.addEventListener("pointerleave", () => setLive(false));
  }
}

document.querySelectorAll<SVGSVGElement>("svg[data-kind]").forEach(setup);
