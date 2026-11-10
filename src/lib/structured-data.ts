// Structured data (schema.org, as JSON-LD) for search engines and assistants: what the site is, who
// writes it, what each page is and where it sits. Base.astro puts one graph per page in the head, and
// the sitemap takes each page's last-modified date from it (astro.config.mjs).

export const SITE = "https://zerotohype.xyz";
const SITE_ID = `${SITE}/#website`;
const AUTHOR_ID = `${SITE}/about/#author`;

export type Node = Record<string, unknown>;

/** The person behind the site. The About page says who they are; GitHub and X are where else they are. */
export const author: Node = {
  "@type": "Person",
  "@id": AUTHOR_ID,
  name: "Vignesh Chaturvedi",
  url: `${SITE}/about/`,
  sameAs: ["https://github.com/vignesh-chaturvedi", "https://x.com/vitwts"],
};

export const website: Node = {
  "@type": "WebSite",
  "@id": SITE_ID,
  url: `${SITE}/`,
  name: "Zero to HYPE",
  description: "A free, open-source roadmap for building on Hyperliquid, with labs that run against the real API.",
  inLanguage: "en",
  author: { "@id": AUTHOR_ID },
  publisher: { "@id": AUTHOR_ID },
};

/** What a page is about, besides itself. */
const hyperliquid: Node = { "@type": "Thing", name: "Hyperliquid", url: "https://hyperliquid.xyz" };

/** The share card drawn for a page (scripts/og-cards.mjs), named after its path. */
export function cardUrl(path: string) {
  const slug = path.replace(/^\/|\/$/g, "").replace(/\//g, "-") || "home";
  return `${SITE}/og/${slug === "404" ? "home" : slug}.png`;
}

/** The trail from the homepage down to a page, given as [name, path] pairs after the homepage. */
export function breadcrumbs(trail: [string, string][]): Node {
  return {
    "@type": "BreadcrumbList",
    itemListElement: [["Zero to HYPE", "/"], ...trail].map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: new URL(path, SITE).href })),
  };
}

/** A page of the site, of a given type: a lesson is a TechArticle, a reading list a CollectionPage. */
export function page(type: string, path: string, f: { name: string; headline?: string; description: string; modified?: Date; section?: string }): Node {
  const url = new URL(path, SITE).href;
  const article = type === "TechArticle";
  return {
    "@type": type,
    "@id": `${url}#page`,
    url,
    name: f.name,
    ...(article ? { headline: f.headline ?? f.name } : {}),
    description: f.description,
    image: cardUrl(path),
    inLanguage: "en",
    isPartOf: { "@id": SITE_ID },
    about: hyperliquid,
    author: { "@id": AUTHOR_ID },
    ...(article ? { publisher: { "@id": AUTHOR_ID } } : {}),
    ...(f.section ? { articleSection: f.section } : {}),
    ...(f.modified ? { dateModified: f.modified.toISOString().slice(0, 10) } : {}),
  };
}

/** The graph as the text of a <script type="application/ld+json">; "<" is escaped so it can't end the script. */
export const jsonLd = (nodes: Node[]) => JSON.stringify({ "@context": "https://schema.org", "@graph": nodes }).replace(/</g, "\\u003c");
