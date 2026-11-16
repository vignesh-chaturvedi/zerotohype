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
// The site's day theme: RAL 9016 paper, 9017 ink and bands, 1023 traffic yellow (src/styles/global.css).
const C = { bg: "#f6f6f6", band: "#1e1e1e", ink: "#1e1e1e", ink2: "#3b3d3c", muted: "#4e5451", onBand: "#f6f6f6", bandMuted: "#9ea0a1", signal: "#f0ca00" };

const fontFile = (pkg, name) => readFile(join(root, "node_modules/@fontsource", pkg, "files", `${name}.woff`));
const fonts = [
  { name: "Overpass", weight: 400, data: await fontFile("overpass", "overpass-latin-400-normal") },
  { name: "Overpass", weight: 800, data: await fontFile("overpass", "overpass-latin-800-normal") },
  { name: "Overpass", weight: 900, data: await fontFile("overpass", "overpass-latin-900-normal") },
  { name: "Overpass Mono", weight: 600, data: await fontFile("overpass-mono", "overpass-mono-latin-600-normal") },
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
  const h1Html = html.slice(h1At).match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "";
  const h1 = decode(h1Html);
  // The words the page sets on a yellow plate (its <em>), which the card sets on one too.
  const plate = decode(h1Html.match(/<em[^>]*>([\s\S]*?)<\/em>/)?.[1] ?? "");
  const before = html.slice(Math.max(0, h1At - 1500), h1At);
  const eyebrows = [...before.matchAll(/<p class="eyebrow[^"]*"[^>]*>([\s\S]*?)<\/p>/g)];
  const eyebrow = decode(eyebrows.at(-1)?.[1] ?? "");
  const description = decode(html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "");
  return { h1, plate, eyebrow, description };
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

const luminance = (hex) => {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
// The text colour that reads best on a track's paint: white, or the ink.
const onColor = (hex) => ((1.05) / (luminance(hex) + 0.05) >= (luminance(hex) + 0.05) / (luminance(C.ink) + 0.05) ? "#ffffff" : C.ink);

// One track drawing as a standalone SVG, drawn the way the site paints it: the line's colour as a flat
// panel and the drawing in the colour that reads on it. resvg shares one stylesheet across the whole
// card, so the site's classes become plain attributes here.
function motif(d, { x, y, w, h, crop = "100 28 214 154" }) {
  const ink = onColor(d.color), bg = d.color;
  const attrs = {
    f0: 'fill="none"', f1: `fill="${ink}" fill-opacity=".14"`, f2: `fill="${ink}" fill-opacity=".3"`, f3: `fill="${ink}" fill-opacity=".92"`,
    bg: `fill="${bg}"`, "bg-stroke": `fill="${bg}"`, dash: 'stroke-dasharray="3 4" stroke-opacity=".8"', thick: 'stroke-width="2.6"', rail: 'stroke="none" fill="none"',
  };
  const inner = d.svg
    .replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "")
    .replace(/<text[\s\S]*?<\/text>/g, "")
    .replace(/ data-[\w-]+(="[^"]*")?/g, "")
    .replace(/ class="([^"]*)"/g, (_, list) => " " + list.split(/\s+/).map((c) => attrs[c] ?? "").filter(Boolean).join(" "));
  return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${crop}">
    <g fill="none" stroke="${ink}" stroke-width="1.8" stroke-linecap="square" stroke-linejoin="miter">${inner}</g>
  </svg>`;
}

const panel = (x, y, w, h, color) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${color}"/>`;

// The logo's disc: traffic yellow with a slashed zero, as in the site's header.
const disc = (cx, cy, r) => `<g transform="translate(${cx - r} ${cy - r}) scale(${r / 16})">
  <circle cx="16" cy="16" r="16" fill="${C.signal}"/>
  <g fill="none" stroke="${C.ink}"><ellipse cx="16" cy="16" rx="6.1" ry="9.1" stroke-width="3.6"/><path d="M12.6 23.2 19.4 8.8" stroke-width="3.2"/></g></g>`;

function art(kind, look, all) {
  const lines = Object.values(all);
  // The black sign band across the top, and the ten lines end to end along the bottom.
  const band = `<rect width="${W}" height="96" fill="${C.band}"/>${disc(88, 48, 26)}`;
  const strip = lines.map((d, i) => `<rect x="${(W / lines.length) * i}" y="${H - 14}" width="${W / lines.length + 1}" height="14" fill="${d.color}"/>`).join("");
  let pic = "";
  if (kind === "mosaic") {
    const px = 700, py = 144, cw = 214, ch = 78, gap = 8;
    pic = lines.map((d, i) => {
      const cx = px + (i % 2) * (cw + gap), cy = py + Math.floor(i / 2) * (ch + gap);
      return panel(cx, cy, cw, ch, d.color) + motif(d, { x: cx + 8, y: cy + 3, w: cw - 16, h: ch - 6 });
    }).join("");
  } else if (look) {
    pic = panel(700, 144, 436, 420, look.color) + motif(look, { x: 716, y: 220, w: 404, h: 300 });
  }
  return `<rect width="${W}" height="${H}" fill="${C.bg}"/>${band}${pic}${strip}`;
}

const el = (type, style, children) => ({ type, props: { style: { display: "flex", ...style }, children } });
// Overpass classes its middle dot as a combining mark, so it's drawn with no width, here as in browsers
// (global.css swaps in another font's dot there). A card uses the bullet instead.
const dots = (s) => s.replace(/\u00b7/g, "\u2022");

function text({ eyebrow, title, plate, description, number, color, wide }) {
  const size = title.length <= 24 ? 80 : title.length <= 44 ? 66 : 56;
  const desc = description.length > 140 ? description.slice(0, 137).replace(/\s+\S*$/, "") + "…" : description;
  // The heading, with its last words on a yellow plate when the page has one; punctuation straight after
  // the plate stays beside it.
  const at = plate ? title.lastIndexOf(plate) : -1;
  const words = (s) => s.split(/\s+/).filter(Boolean).map((w) => el("span", { marginRight: "0.22em" }, w));
  let heading = words(title);
  if (at >= 0) {
    const rest = title.slice(at + plate.length);
    const tail = rest.match(/^[^\s]*/)[0];
    heading = [
      ...words(title.slice(0, at)),
      el("span", { marginRight: "0.22em" }, [
        el("span", { backgroundColor: C.signal, padding: "0.04em 0.1em 0", marginLeft: "-0.06em" }, plate.replace(/\s+/g, "\u00a0")),
        ...(tail ? [el("span", {}, tail)] : []),
      ]),
      ...words(rest.slice(tail.length)),
    ];
  }
  const left = el("div", { position: "absolute", left: 64, top: 0, width: wide ? 600 : 590, height: H, flexDirection: "column" }, [
    el("div", { position: "absolute", left: 66, top: 30, fontFamily: "Overpass", fontWeight: 900, fontSize: 34, color: C.onBand }, "Zero to HYPE"),
    el("div", { position: "absolute", left: 0, top: 144, width: "100%", flexDirection: "column", alignItems: "flex-start" }, [
      el("div", { fontFamily: "Overpass", fontWeight: 800, fontSize: 18, letterSpacing: "0.08em", textTransform: "uppercase", color: C.onBand, backgroundColor: C.band, padding: "8px 12px 5px", marginBottom: 22 }, dots(eyebrow)),
      el("div", { flexWrap: "wrap", fontFamily: "Overpass", fontWeight: 900, fontSize: size, lineHeight: 1.02, letterSpacing: "-0.035em", color: C.ink }, heading),
      el("div", { marginTop: 22, fontFamily: "Overpass", fontWeight: 400, fontSize: 24, lineHeight: 1.45, color: C.ink2 }, dots(desc)),
    ]),
  ]);
  const kids = [left, el("div", { position: "absolute", right: 64, top: 36, fontFamily: "Overpass", fontWeight: 800, fontSize: 21, color: C.bandMuted }, "zerotohype.xyz")];
  if (number) kids.push(el("div", { position: "absolute", left: 724, top: 160, fontFamily: "Overpass", fontWeight: 900, fontSize: 76, letterSpacing: "-0.04em", color: onColor(color) }, number));
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
  const { h1, plate, eyebrow, description } = read(html);
  const trackCode = slug.startsWith("tracks-") ? eyebrow.match(/^(T\d+)/)?.[1] : borrowed[slug];
  const look = trackCode ? looks[trackCode] : null;
  const info = slug === "home"
    ? { eyebrow: "A free roadmap for Hyperliquid builders", title: h1, plate, description: "Ten tracks mapped to the official docs and the best guides, with labs that run on the real API.", wide: true }
    : {
        eyebrow: slug.startsWith("tracks-") ? eyebrow.replace(/ · \d+ of \d+$/, "") : eyebrow,
        title: h1,
        plate,
        description,
        number: slug.startsWith("tracks-") ? trackCode.replace("T", "").padStart(2, "0") : undefined,
        color: look?.color,
      };
  const png = await card(info, art(look ? "track" : "mosaic", look, looks));
  await writeFile(join(dist, "og", `${slug}.png`), png);
  n++;
}
console.log(`og-cards: wrote ${n} share cards to dist/og/`);
