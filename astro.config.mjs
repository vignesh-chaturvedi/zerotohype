// @ts-check
import { defineConfig } from "astro/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sitemap from "@astrojs/sitemap";
import { satteri } from "@astrojs/markdown-satteri";

const dist = fileURLToPath(new URL("./dist/", import.meta.url));

/** A page's last-modified date in the sitemap: the dateModified in its structured data (Base.astro), such
 *  as when a lesson's facts were last checked. Pages without one are listed without a date.
 *  @param {import("@astrojs/sitemap").SitemapItem} item */
function lastmod(item) {
  try {
    const html = readFileSync(`${dist}${new URL(item.url).pathname.slice(1)}index.html`, "utf8");
    const date = html.match(/"dateModified":"([^"]+)"/)?.[1];
    if (date) item.lastmod = date;
  } catch {
    // Not a page with an index.html; listed as it is.
  }
  return item;
}

/** Puts each Markdown table in a box that scrolls sideways when the table is wider than the page
 *  (global.css, src/scripts/scroll-areas.ts), so the table itself keeps its table layout and semantics. */
const tableScroll = {
  name: "table-scroll",
  element: {
    filter: ["table"],
    /** @param {any} node @param {any} ctx */
    visit(node, ctx) {
      ctx.wrapNode(node, { type: "element", tagName: "div", properties: { className: ["table-scroll"] }, children: [] });
    },
  },
};

export default defineConfig({
  site: "https://zerotohype.xyz",
  integrations: [sitemap({ serialize: lastmod })],
  markdown: {
    // Astro's own Markdown processor, with the table boxes added. Keep its version the one astro pins.
    processor: satteri({ hastPlugins: [tableScroll] }),
    // Code is coloured with CSS variables, so it follows the site's palette in both themes (global.css).
    shikiConfig: { theme: "css-variables" },
  },
});
