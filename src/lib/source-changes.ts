import entries from "../data/changelog.json";

type Entry = { time: string; network: string; area: string; summary: string };
type Link = { title: string; url: string };

const norm = (url: string) => url.replace(/\/+$/, "").toLowerCase();

/**
 * The docs pages in `docs` that the changelog bot saw edited after `since`, one per page, newest edit
 * first. A lesson uses this to say when its sources changed after its facts were last checked.
 */
export function editedSince(docs: Link[], since: Date): (Link & { time: string })[] {
  const cited = new Map(docs.map((d) => [norm(d.url), d]));
  const seen = new Set<string>();
  const out: (Link & { time: string })[] = [];
  for (const e of entries as Entry[]) {
    if (e.network !== "docs" || Date.parse(e.time) <= since.getTime()) continue;
    const url = e.summary.match(/\((https:\/\/[^)\s]+)\)/)?.[1];
    const doc = url ? cited.get(norm(url)) : undefined;
    if (!doc || seen.has(norm(doc.url))) continue;
    seen.add(norm(doc.url));
    out.push({ ...doc, time: e.time });
  }
  return out.sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
}
