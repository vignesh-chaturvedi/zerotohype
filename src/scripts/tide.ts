// The homepage backdrop: Hyperliquid's live BTC order book drawn as a stack of ridges. Each ridge is
// one snapshot of the book, with the bids rising to the left of the mid price and the asks to the
// right; the newest slides in at the front and older ones recede towards the horizon.
//
// This file connects the page to the drawing in tide-scene.ts. Where the browser can hand a canvas
// to a worker, the drawing runs there (tide-worker.ts), so it never holds up scrolling, taps or
// typing; elsewhere it runs on the main thread.

import { subscribe, onConnection, type Book } from "./hl-feed";
import { isPaused, onMotionChange } from "./motion";
import type { Msg } from "./tide-scene";

const COIN = "BTC";
const STEP = 900; // ms between ridges

const stage = document.querySelector<HTMLElement>("[data-tide]");
const canvas = stage?.querySelector("canvas");
if (stage && canvas) run(stage, canvas);

function run(stage: HTMLElement, canvas: HTMLCanvasElement) {
  const caption = stage.querySelector<HTMLElement>("[data-tide-caption]");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const send = connect(canvas, reduce);

  // Colours come from the theme tokens, and are sent again whenever the light/dark switch flips.
  const css = getComputedStyle(stage);
  const color = (name: string) => css.getPropertyValue(name).trim();
  const sendColors = () =>
    send({ type: "colors", colors: { bg: color("--bg"), bid: color("--bid"), ask: color("--ask"), ink: color("--ink") }, mono: color("--data") || "monospace" });
  sendColors();

  let latest: Book | null = null;
  let mode: "waiting" | "live" | "simulated" = "waiting";
  let visible = true;

  const say = (text: string, state: string) => {
    if (!caption) return;
    caption.textContent = text;
    caption.dataset.state = state;
  };
  const liveCaption = () => isPaused()
    ? `Paused: the ${COIN} order book on Hyperliquid, as it stood when the motion was paused.`
    : `Live: the ${COIN} order book on Hyperliquid, one snapshot per ridge, newest in front.`;
  // Paused by the reader (motion.ts): the ridges stop where they are and no new ones arrive.
  const play = () => send({ type: "play", on: visible && !document.hidden && !isPaused() });
  onMotionChange(() => {
    play();
    if (mode === "live") say(liveCaption(), "live");
  });

  // The ridges stay below the intro paragraph, which reaches past the middle of the stage on short
  // phones, and above the caption at the bottom, which wraps to two lines there.
  const copy = stage.querySelector<HTMLElement>(".stage-copy");
  const lede = stage.querySelector<HTMLElement>(".lede");
  const foot = stage.querySelector<HTMLElement>(".stage-foot");
  const sendSize = () => {
    const box = stage.getBoundingClientRect();
    send({
      type: "size", w: stage.clientWidth, h: stage.clientHeight, dpr: devicePixelRatio || 1,
      ceiling: lede ? lede.getBoundingClientRect().bottom - box.top + 8 : 0,
      floor: foot ? box.bottom - foot.getBoundingClientRect().top : 0,
    });
  };
  const resized = new ResizeObserver(sendSize);
  for (const el of [stage, copy, foot]) if (el) resized.observe(el);
  new MutationObserver(sendColors).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; play(); }).observe(stage);
  document.addEventListener("visibilitychange", play);
  stage.addEventListener("pointermove", (e) => {
    const box = stage.getBoundingClientRect();
    send({ type: "pointer", at: { x: e.clientX - box.left, y: e.clientY - box.top } });
  });
  stage.addEventListener("pointerleave", () => send({ type: "pointer", at: null }));

  const stop = subscribe({ type: "l2Book", coin: COIN, nSigFigs: 4 }, (book: Book) => {
    latest = book;
    if (mode !== "live") {
      mode = "live";
      send({ type: "push", book, fill: true });
      stage.classList.add("has-tide");
      say(liveCaption(), "live");
      if (reduce) stop();
    }
  });
  onConnection((up) => {
    if (!up && mode === "live") say(`Reconnecting to the ${COIN} order book…`, "waiting");
    if (up && mode === "live") say(liveCaption(), "live");
  });
  setTimeout(() => {
    if (mode !== "waiting") return;
    mode = "simulated";
    send({ type: "push", fill: true });
    stage.classList.add("has-tide");
    say("Simulated depth: the live order book didn't load. Refresh to try again.", "simulated");
  }, 6000);

  if (!reduce) {
    setInterval(() => {
      if (!visible || document.hidden || isPaused()) return;
      if (mode === "live" && latest) send({ type: "push", book: latest });
      else if (mode === "simulated") send({ type: "push" });
    }, STEP);
  }
}

// Hands the canvas to a worker when the browser allows it, and otherwise draws here. Either way the
// page talks to the drawing through the same messages.
function connect(canvas: HTMLCanvasElement, reduce: boolean): (msg: Msg) => void {
  // A canvas handed to a worker can't be taken back, so check first that the browser can draw 2D on one.
  const offscreen2d = typeof OffscreenCanvas === "function" && (() => {
    try { return !!new OffscreenCanvas(1, 1).getContext("2d"); } catch { return false; }
  })();
  if (offscreen2d && "transferControlToOffscreen" in canvas) {
    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL("./tide-worker.ts", import.meta.url), { type: "module" });
      const offscreen = canvas.transferControlToOffscreen();
      worker.postMessage({ type: "init", canvas: offscreen, reduce }, [offscreen]);
      const w = worker;
      return (msg) => w.postMessage(msg);
    } catch {
      worker?.terminate();
    }
  }
  let handle: ((msg: Msg) => void) | null = null;
  const queue: Msg[] = [];
  import("./tide-scene").then(({ createScene }) => {
    handle = createScene(canvas, reduce);
    for (const msg of queue.splice(0)) handle(msg);
  });
  return (msg) => {
    if (handle) handle(msg);
    else queue.push(msg);
  };
}
