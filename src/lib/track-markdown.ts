// A track as Markdown, for pasting into an assistant or notes: the lesson, when its facts were last
// checked, and what to read and build, with every link made absolute so it works wherever it's pasted.
// Served at /tracks/<id>.md, and gathered into /llms-full.txt.

import type { CollectionEntry } from "astro:content";
import { SITE } from "./structured-data";

const kindLabel = { lab: "Lab", workbench: "Workbench", project: "Project", guide: "Guide" } as const;
const day = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
/** Site-relative links, as in [T9](/tracks/t09-hyperevm/), made absolute. */
const absolute = (md: string) => md.replace(/\]\(\//g, `](${SITE}/`);

export function trackMarkdown(track: CollectionEntry<"tracks">): string {
  const t = track.data;
  const url = `${SITE}/tracks/${track.id}/`;
  const out = [`# ${t.code} ${t.title}`, "", `> ${t.summary}`, ""];
  out.push(
    `From Zero to HYPE, a free roadmap for building on Hyperliquid: <${url}>` +
      (t.verified ? `. Its facts were last checked against the live API on ${day(t.verified)}.` : "."),
    "",
  );
  if (track.body?.trim()) out.push(absolute(track.body.trim()), "");
  out.push("## Read first: the official docs", "", ...t.docs.map((d) => `- [${d.title}](${d.url})${d.note ? `: ${d.note}` : ""}`), "");
  if (t.outside.length > 0) {
    out.push("## Then: guides worth your time", "", ...t.outside.map((d) => `- [${d.title}](${d.url})${d.by ? ` (${d.by})` : ""}${d.note ? `: ${d.note}` : ""}`), "");
  }
  if (t.build.length > 0) {
    out.push("## Build", "", ...t.build.map((b) => `- ${kindLabel[b.kind]}: ${b.status === "live" && b.href ? `[${b.label}](${SITE}${b.href})` : `${b.label} (planned)`}`), "");
  }
  return out.join("\n");
}
