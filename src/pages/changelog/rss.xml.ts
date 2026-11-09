// The API changelog as an RSS feed: one item per change, newest first, each linking to it on the page.
import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import entries from "../../data/changelog.json";
import { entryId, inlineHtml, plainText, type Entry } from "../../lib/changelog";

export function GET(context: APIContext) {
  return rss({
    title: "Zero to HYPE: Hyperliquid API changelog",
    description: "What changed in Hyperliquid's API, detected from mainnet, testnet and the docs every 6 hours.",
    site: context.site!,
    trailingSlash: false, // the links end in #anchors, which a trailing slash would break
    items: (entries as Entry[]).map((e) => {
      const tags = e.network === e.area ? [e.network] : [e.network, e.area];
      return {
        title: `[${tags.join(" · ")}] ${plainText(e.summary)}`,
        link: `/changelog/#${entryId(e)}`,
        pubDate: new Date(e.time),
        description: inlineHtml(e.summary),
        categories: tags,
      };
    }),
    customData: "<language>en</language>",
  });
}
