// New and re-checked lessons as an RSS feed, newest first. A lesson comes back into the feed each time its
// facts are checked against the live API again: the item's id includes the date it was checked.
import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getCollection } from "astro:content";

export async function GET(context: APIContext) {
  const lessons = (await getCollection("tracks"))
    .filter((t) => t.data.depth === "lesson" && t.data.verified)
    .sort((a, b) => b.data.verified!.getTime() - a.data.verified!.getTime());
  return rss({
    title: "Zero to HYPE: new and re-checked lessons",
    description: "Lessons on building on Hyperliquid. Each appears again whenever its facts are re-checked against the live API.",
    site: context.site!,
    items: lessons.map((t) => {
      const url = new URL(`/tracks/${t.id}/`, context.site).href;
      return {
        title: `${t.data.code} ${t.data.title}`,
        link: `/tracks/${t.id}/`,
        pubDate: t.data.verified,
        description: t.data.summary,
        categories: [t.data.stage],
        customData: `<guid isPermaLink="false">${url}#checked-${t.data.verified!.toISOString().slice(0, 10)}</guid>`,
      };
    }),
    customData: "<language>en</language>",
  });
}
