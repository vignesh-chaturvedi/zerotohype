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

The site is static. On Cloudflare Pages, connect the repository and use:

| Setting | Value |
|---|---|
| Build command | `pnpm build` |
| Output directory | `dist` |
| Environment variables | `NODE_VERSION=24`, `PNPM_VERSION=11.20.0` |

Cloudflare's build image defaults to pnpm 8, which can't read this lockfile, so set `PNPM_VERSION`.

`public/_headers` sets basic security headers. Turn on Cloudflare Web Analytics in the Pages project settings; it needs no code and sets no cookies.

## Labs and data

The labs in `src/pages/labs/` run in the browser and call Hyperliquid's API directly; they never ask for a real key. The settlement explorer reads `public/data/hip4-settlements.json`, built from [hyperkeeper](https://github.com/vignesh-chaturvedi/hyperkeeper)'s logs by `scripts/build-hip4-dataset.ts`. `scripts/probe-signing.ts` and `scripts/probe-bugs.ts` check the signing recipe against testnet.
