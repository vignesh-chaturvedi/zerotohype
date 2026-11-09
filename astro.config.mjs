// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://zerotohype.xyz",
  integrations: [sitemap()],
  // Code is coloured with CSS variables, so it follows the site's palette in both themes (global.css).
  markdown: { shikiConfig: { theme: "css-variables" } },
});