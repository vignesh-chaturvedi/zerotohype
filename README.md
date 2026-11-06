# Zero to HYPE

A free, open-source roadmap for building on Hyperliquid: every topic mapped to the official docs and the best tutorials, labs that run in the browser against testnet, and a daily changelog of what the API changed.

Independent project, not affiliated with Hyperliquid.

## Develop

Requires Node 22 or newer and pnpm.

```bash
pnpm install
pnpm dev        # http://localhost:4321
pnpm build      # static site in dist/
pnpm changelog  # check the API for changes and update the changelog
```

The changelog job runs every 6 hours on GitHub Actions (`.github/workflows/changelog.yml`) and commits any changes it finds. It keeps its snapshots in `data/snapshots/` and its entries in `src/data/changelog.json`.

## Licences

Code: MIT (`LICENSE`). Content in `src/content/`: CC BY 4.0 (`CONTENT-LICENSE.md`).

## Deploy

The site is static and runs on Cloudflare Workers with static assets. Connect the repository in Workers Builds and keep the defaults: build command `pnpm run build`, deploy command `npx wrangler deploy`. `wrangler.jsonc` serves `dist/` and answers unknown paths with `404.html`. Without it, `wrangler deploy` tries to convert the site to server rendering with the Cloudflare adapter, and the build fails.

`public/_headers` sets basic security headers. Turn on Cloudflare Web Analytics in the dashboard; it needs no code and sets no cookies.

## Labs and data

The labs in `src/pages/labs/` run in the browser and call Hyperliquid's API directly; they never ask for a real key. The settlement explorer reads `public/data/hip4-settlements.json`, built from [hyperkeeper](https://github.com/vignesh-chaturvedi/hyperkeeper)'s logs by `scripts/build-hip4-dataset.ts`. `scripts/probe-signing.ts` and `scripts/probe-bugs.ts` check the signing recipe against testnet.
