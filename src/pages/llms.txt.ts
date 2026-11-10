// /llms.txt: the site described for assistants and the tools that feed them (llmstxt.org): what it is,
// each track with its Markdown version, the references and the labs.
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { terms } from "../data/glossary";
import { SITE } from "../lib/structured-data";

const day = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export const GET: APIRoute = async () => {
  const tracks = (await getCollection("tracks")).sort((a, b) => a.data.order - b.data.order);
  const lines = [
    "# Zero to HYPE",
    "",
    "> A free, open-source roadmap for building on Hyperliquid: ten tracks mapped to the official docs and the best outside guides, with labs that run against the real API in the browser.",
    "",
    "Each lesson shows the date its facts were last checked against the live API. Every track below links to its Markdown version, which has the lesson and its reading list. Errors, terms and API changes have references of their own.",
    "",
    "## Tracks",
    "",
    ...tracks.map((t) => {
      const kind = t.data.depth === "lesson" ? `Lesson${t.data.verified ? `, checked ${day(t.data.verified)}` : ""}.` : "Reading list.";
      return `- [${t.data.code} ${t.data.title}](${SITE}/tracks/${t.id}.md): ${t.data.summary} ${kind}`;
    }),
    "",
    "## Reference",
    "",
    `- [Hyperliquid API errors](${SITE}/errors/): The errors the API returns, with their exact text, where each shows up in the reply, what it means and what to do about it. Tested on testnet where it can be without funds.`,
    `- [Hyperliquid glossary](${SITE}/glossary/): ${terms.length} terms in plain words, each linked to where it's explained properly.`,
    `- [Hyperliquid API changelog](${SITE}/changelog/): What changed on mainnet, testnet and in the docs, checked every 6 hours. Also as RSS: ${SITE}/changelog/rss.xml`,
    "",
    "## Labs",
    "",
    `- [Sign without money](${SITE}/labs/sign-without-money/): Sign an action with a throwaway key on testnet and see whether the exchange recovers that key.`,
    `- [Funding and mark price](${SITE}/labs/funding/): Live oracle, mark and impact prices for any perp, with the premium and funding worked out.`,
    `- [Settlement explorer](${SITE}/labs/settlement/): Real HIP-4 settlements recomputed from recorded prices.`,
    "",
    "## Optional",
    "",
    `- [Every track in one file](${SITE}/llms-full.txt)`,
    `- [About](${SITE}/about/): How the facts are checked, who writes the site and how to report a mistake.`,
    "- [Source on GitHub](https://github.com/vignesh-chaturvedi/zerotohype)",
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
