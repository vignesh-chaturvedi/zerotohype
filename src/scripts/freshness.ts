// "Checked" dates say how long ago they were, and colour their dot by age, because a page may have
// been built a while before it is read.
//   [data-checked="<ISO time>"]  when the facts were checked
//   [data-fresh="<days>,<days>"] ages up to which it counts as fresh, then as ageing (default 14,30)
//   [data-ago]                   inside it, filled with " · 18 days ago"
// The element's data-state becomes "fresh", "aging" or "stale"; the page sets it at build time too.

import { freshness } from "../lib/freshness";

function ago(ms: number) {
  const hours = Math.round(ms / 36e5);
  if (hours < 1) return "under an hour ago";
  if (hours < 36) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(ms / 864e5);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

for (const el of document.querySelectorAll<HTMLElement>("[data-checked]")) {
  const at = Date.parse(el.dataset.checked ?? "");
  if (Number.isNaN(at)) continue;
  const [fresh, aging] = (el.dataset.fresh ?? "14,30").split(",").map(Number);
  el.dataset.state = freshness(at, fresh, aging);
  const out = el.querySelector<HTMLElement>("[data-ago]");
  if (out) out.textContent = ` · ${ago(Math.max(0, Date.now() - at))}`;
}
