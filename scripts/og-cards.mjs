// Draws a 1200×630 share card for every page in dist/ and saves it as dist/og/<slug>.png, the path
// that Base.astro puts in og:image. Runs after `astro build`, so it reads the finished pages:
// the title, eyebrow and description come from each page's HTML, and the track drawings are the
// same SVGs the site shows. Satori lays out the text; resvg turns the SVG into a PNG.

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist");
const W = 1200, H = 630;
const C = { bg: "#0c0c0b", surface: "#141412", ink: "#f2efe8", ink2: "#c8c4ba", muted: "#8e897f", accent: "#ff8a4c", rule: "#262521" };

const fontFile = (pkg, name) => readFile(join(root, "node_modules/@fontsource", pkg, "files", `${name}.woff`));
const fonts = [
  { name: "Schibsted Grotesk", weight: 600, data: await fontFile("schibsted-grotesk", "schibsted-grotesk-latin-600-normal") },
  { name: "Public Sans", weight: 400, data: await fontFile("public-sans", "public-sans-latin-400-normal") },
  { name: "Martian Mono", weight: 400, data: await fontFile("martian-mono", "martian-mono-latin-400-normal") },
  { name: "Martian Mono", weight: 500, data: await fontFile("martian-mono", "martian-mono-latin-500-normal") },
];

// ---- Reading the built pages ------------------------------------------------------------------

async function pages(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory() && !["og", "pagefind", "_astro", "data"].includes(entry.name)) out.push(...(await pages(path)));
    else if (entry.name === "index.html") out.push(path);
  }
  return out;
}

const decode = (s) =>
  s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/\s+/g, " ").trim();

function read(html) {
  const h1At = html.search(/<h1[\s>]/);
  const h1 = decode(html.slice(h1At).match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "");
  const before = html.slice(Math.max(0, h1At - 1500), h1At);
  const eyebrows = [...before.matchAll(/<p class="eyebrow[^"]*"[^>]*>([\s\S]*?)<\/p>/g)];
  const eyebrow = decode(eyebrows.at(-1)?.[1] ?? "");
  const description = decode(html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "");
  return { h1, eyebrow, description };
}

// The track drawings, taken from the homepage's preview panel: code -> { color, svg }.
function drawings(home) {
  const out = {};
  for (const m of home.matchAll(/<div class="pv[^"]*"[^>]*data-code="(T\d+)"[^>]*style="--c: (#[0-9a-f]{6})"[\s\S]*?(<svg viewBox="0 0 320 200"[\s\S]*?<\/svg>)/gi)) {
    out[m[1]] = { color: m[2], svg: m[3] };
  }
  return out;
}

// ---- Drawing --------------------------------------------------------------------------------

const mix = (a, b, t) => {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return "#" + x.map((v, i) => Math.round(v * t + y[i] * (1 - t)).toString(16).padStart(2, "0")).join("");
};

// One track drawing as a standalone SVG, coloured the way the dark site shows it. resvg shares one
// stylesheet across the whole card, so the site's classes become plain attributes here.
function motif(d, { x, y, w, h, crop = "100 28 214 154" }) {
  const ink = d.color, bg = mix(d.color, C.surface, 0.07);
  const attrs = {
    f0: 'fill="none"', f1: `fill="${ink}" fill-opacity=".1"`, f2: `fill="${ink}" fill-opacity=".22"`, f3: `fill="${ink}" fill-opacity=".85"`,
    bg: `fill="${bg}"`, "bg-stroke": `fill="${bg}"`, dash: 'stroke-dasharray="3 4" stroke-opacity=".7"', thick: 'stroke-width="2.4"', rail: 'stroke="none" fill="none"',
  };
  const inner = d.svg
    .replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "")
    .replace(/<text[\s\S]*?<\/text>/g, "")
    .replace(/ data-[\w-]+(="[^"]*")?/g, "")
    .replace(/ class="([^"]*)"/g, (_, list) => " " + list.split(/\s+/).map((c) => attrs[c] ?? "").filter(Boolean).join(" "));
  return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${crop}">
    <g fill="none" stroke="${ink}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${inner}</g>
  </svg>`;
}

function panel(x, y, w, h, color) {
  const bg = mix(color, C.surface, 0.07);
  return `<defs><pattern id="dots" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="8" cy="8" r="1.1" fill="${color}" fill-opacity=".16"/></pattern></defs>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${bg}"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="url(#dots)"/>
    <rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="18" fill="none" stroke="${color}" stroke-opacity=".25"/>`;
}

function art(kind, look, all) {
  const glyph = `<g transform="translate(64 60)"><rect width="40" height="40" rx="10" fill="${C.ink}"/>
    <ellipse cx="16.6" cy="22" rx="6.6" ry="8.9" fill="none" stroke="${C.bg}" stroke-width="3.4"/>
    <path d="M24.3 15.7 L31.7 8.3 M25.7 8.3 H31.7 V14.3" fill="none" stroke="${C.accent}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  const strip = Object.values(all).map((d, i, a) => `<rect x="${(W / a.length) * i}" y="${H - 6}" width="${W / a.length + 1}" height="6" fill="${d.color}" fill-opacity=".85"/>`).join("");
  let pic = "";
  if (kind === "mosaic") {
    const list = Object.values(all);
    const px = 660, py = 60, cw = 230, ch = 94, gap = 8;
    pic = list.map((d, i) => {
      const cx = px + (i % 2) * (cw + gap), cy = py + Math.floor(i / 2) * (ch + gap);
      return panel(cx, cy, cw, ch, d.color).replace(/id="dots"/, `id="dots${i}"`).replace(/url\(#dots\)/, `url(#dots${i})`) +
        motif(d, { x: cx + 10, y: cy + 4, w: cw - 20, h: ch - 8 });
    }).join("");
  } else if (look) {
    pic = panel(660, 60, 476, 510, look.color) + motif(look, { x: 680, y: 150, w: 436, h: 330 });
  }
  return `<rect width="${W}" height="${H}" fill="${C.bg}"/>${pic}${glyph}${strip}`;
}

const el = (type, style, children) => ({ type, props: { style: { display: "flex", ...style }, children } });

function text({ eyebrow, title, description, number, color, wide }) {
  const size = title.length <= 24 ? 74 : title.length <= 44 ? 62 : 52;
  const desc = description.length > 150 ? description.slice(0, 147).replace(/\s+\S*$/, "") + "…" : description;
  const left = el("div", { position: "absolute", left: 64, top: 0, width: wide ? 560 : 556, height: H, flexDirection: "column" }, [
    el("div", { position: "absolute", left: 56, top: 64, fontFamily: "Schibsted Grotesk", fontWeight: 600, fontSize: 26, letterSpacing: "-0.02em", color: C.ink, alignItems: "center" }, [
      "Zero to ",
      el("span", { marginLeft: 8, fontFamily: "Martian Mono", fontWeight: 500, fontSize: 18, color: C.accent }, "HYPE"),
    ]),
    el("div", { position: "absolute", left: 0, top: 168, width: "100%", flexDirection: "column" }, [
      el("div", { fontFamily: "Martian Mono", fontWeight: 500, fontSize: 17, letterSpacing: "0.12em", textTransform: "uppercase", color: color ?? C.muted, marginBottom: 22 }, eyebrow),
      el("div", { fontFamily: "Schibsted Grotesk", fontWeight: 600, fontSize: size, lineHeight: 1.0, letterSpacing: "-0.045em", color: C.ink }, title),
      el("div", { marginTop: 24, fontFamily: "Public Sans", fontSize: 23, lineHeight: 1.45, color: C.ink2 }, desc),
    ]),
    el("div", { position: "absolute", left: 0, bottom: 52, fontFamily: "Martian Mono", fontSize: 18, color: C.muted }, [
      el("span", { color: C.accent }, "zerotohype.xyz"),
      el("span", { marginLeft: 14 }, "free and open source"),
    ]),
  ]);
  const kids = [left];
  if (number) kids.push(el("div", { position: "absolute", left: 692, top: 86, fontFamily: "Martian Mono", fontWeight: 400, fontSize: 64, letterSpacing: "-0.08em", color }, number));
  return el("div", { width: W, height: H, position: "relative" }, kids);
}

async function card(info, bgArt) {
  const svg = await satori(text(info), { width: W, height: H, fonts });
  const merged = svg.replace(/^(<svg[^>]*>)/, `$1${bgArt}`);
  return new Resvg(merged, { fitTo: { mode: "width", value: W }, font: { loadSystemFonts: false } }).render().asPng();
}

// ---- Main -----------------------------------------------------------------------------------

const homeHtml = await readFile(join(dist, "index.html"), "utf8");
const looks = drawings(homeHtml);
if (Object.keys(looks).length < 10) throw new Error(`og-cards: found ${Object.keys(looks).length} track drawings on the homepage, expected 10`);

// Pages that aren't tracks borrow the drawing of the track they belong to.
const borrowed = {
  "labs-sign-without-money": "T3", "labs-funding": "T4", "labs-settlement": "T8",
  "labs-order-book": "T2", "labs-tick-and-lot": "T2", "labs-liquidation-price": "T4", changelog: "T9",
};

await mkdir(join(dist, "og"), { recursive: true });
let n = 0;
for (const file of await pages(dist)) {
  const dir = relative(dist, join(file, ".."));
  const slug = dir ? dir.replace(/[\\/]/g, "-") : "home";
  const html = await readFile(file, "utf8");
  const { h1, eyebrow, description } = read(html);
  const trackCode = slug.startsWith("tracks-") ? eyebrow.match(/^(T\d+)/)?.[1] : borrowed[slug];
  const look = trackCode ? looks[trackCode] : null;
  const info = slug === "home"
    ? { eyebrow: "A free roadmap for Hyperliquid builders", title: h1, description: "Ten tracks mapped to the official docs and the best guides, with labs that run on the real API.", wide: true }
    : {
        eyebrow: slug.startsWith("tracks-") ? eyebrow.replace(/ · \d+ of \d+$/, "") : eyebrow,
        title: h1,
        description,
        number: slug.startsWith("tracks-") ? trackCode.replace("T", "").padStart(2, "0") : undefined,
        color: look?.color,
      };
  const png = await card(info, art(look ? "track" : "mosaic", look, looks));
  await writeFile(join(dist, "og", `${slug}.png`), png);
  n++;
}
console.log(`og-cards: wrote ${n} share cards to dist/og/`);
