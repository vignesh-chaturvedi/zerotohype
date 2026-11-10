// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { satteri } from "@astrojs/markdown-satteri";

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
  integrations: [sitemap()],
  markdown: {
    // Astro's own Markdown processor, with the table boxes added. Keep its version the one astro pins.
    processor: satteri({ hastPlugins: [tableScroll] }),
    // Code is coloured with CSS variables, so it follows the site's palette in both themes (global.css).
    shikiConfig: { theme: "css-variables" },
  },
});
