// Shared by the changelog page and its RSS feed.

export type Entry = { time: string; network: string; area: string; summary: string };

/** A stable id for one change: its anchor on the changelog page and its link in the feed. */
export function entryId(e: Entry) {
  let h = 0x811c9dc5; // FNV-1a over the whole entry
  for (const ch of `${e.time}\u0000${e.network}\u0000${e.area}\u0000${e.summary}`) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `c-${e.time.slice(0, 10)}-${h.toString(36)}`;
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Summaries use two bits of Markdown, `code` and [links](https://...); this turns them into HTML. */
export const inlineHtml = (s: string) =>
  escape(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');

/** The same summary as plain text. */
export const plainText = (s: string) => s.replace(/`([^`]+)`/g, "$1").replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, "$1");
