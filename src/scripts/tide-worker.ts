// Draws the homepage ridges off the main thread. tide.ts hands this worker the canvas and then sends
// it the same messages it would otherwise give tide-scene.ts directly.

import { createScene, type Msg } from "./tide-scene";
import monoUrl from "@fontsource/martian-mono/files/martian-mono-latin-500-normal.woff2?url";

type Init = { type: "init"; canvas: OffscreenCanvas; reduce: boolean };

let handle: ((msg: Msg) => void) | null = null;

addEventListener("message", (e: MessageEvent<Init | Msg>) => {
  const msg = e.data;
  if (msg.type === "init") {
    handle = createScene(msg.canvas, msg.reduce);
    loadLabelFont();
  } else handle?.(msg);
});

// A worker can't use the page's fonts, so it loads the labels' face itself. The page has already
// fetched the same file, so this comes from the cache; until it's ready the labels use a fallback.
function loadLabelFont() {
  const fonts = (self as unknown as { fonts?: FontFaceSet }).fonts;
  if (!fonts || typeof FontFace === "undefined") return;
  new FontFace("Martian Mono", `url(${monoUrl})`, { weight: "500" })
    .load()
    .then((face) => {
      fonts.add(face);
      handle?.({ type: "redraw" });
    })
    .catch(() => {});
}
