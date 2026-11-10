// Draws the site's icons from public/favicon.svg into public/: favicon.ico (16, 32 and 48px) for browsers
// and tools that don't read SVG, the 180px apple-touch-icon.png iOS puts on a home screen, and the 192px,
// 512px and maskable icons that site.webmanifest lists. Run it again after changing the logo:
//   node scripts/icons.mjs

import { readFile, writeFile } from "node:fs/promises";
import { Resvg } from "@resvg/resvg-js";

const pub = new URL("../public/", import.meta.url);
const logo = await readFile(new URL("favicon.svg", pub), "utf8");

const png = (svg, size) => new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();

// The logo's glyph on a square of its own background colour, shrunk by `scale`: iOS and Android round
// the corners themselves, and a maskable icon has to keep everything inside the middle 80%.
const background = logo.match(/<rect[^>]*fill="([^"]+)"/)[1];
const glyph = logo.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").replace(/<rect[^>]*\/>/, "");
const square = (scale) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><rect width="28" height="28" fill="${background}"/>` +
  `<g transform="translate(14 14) scale(${scale}) translate(-14 -14)">${glyph}</g></svg>`;

/** An .ico holding PNG images, which every browser since 2010 reads. */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // an icon
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size % 256, 0); // width; 0 means 256
    entry.writeUInt8(size % 256, 1); // height
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

const files = {
  "favicon.ico": ico([16, 32, 48].map((size) => ({ size, data: png(logo, size) }))),
  "apple-touch-icon.png": png(square(0.8), 180),
  "icon-192.png": png(logo, 192),
  "icon-512.png": png(logo, 512),
  "icon-maskable-512.png": png(square(0.62), 512),
};
for (const [name, data] of Object.entries(files)) {
  await writeFile(new URL(name, pub), data);
  console.log(`public/${name}: ${data.length} bytes`);
}
