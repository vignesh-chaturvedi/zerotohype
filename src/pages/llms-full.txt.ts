// /llms-full.txt: every track's Markdown version (src/lib/track-markdown.ts) in one file, in roadmap order.
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { trackMarkdown } from "../lib/track-markdown";

export const GET: APIRoute = async () => {
  const tracks = (await getCollection("tracks")).sort((a, b) => a.data.order - b.data.order);
  const intro = "# Zero to HYPE: every track\n\n> A free, open-source roadmap for building on Hyperliquid, from https://zerotohype.xyz. The index is at https://zerotohype.xyz/llms.txt.\n";
  return new Response([intro, ...tracks.map(trackMarkdown)].join("\n---\n\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
