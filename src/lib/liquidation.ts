// Margin and liquidation prices for perps, from the docs' "Liquidations" and "Margin tiers" pages.
//
// Maintenance margin is half the initial margin at the tier's max leverage, so its rate is
// 1 / (2 × max leverage): 1.25% where the max is 40x. Above a tier's lower bound the rate steps up, and a
// deduction keeps the total continuous:
//   maintenance = notional × rate − deduction
//   deduction(n) = deduction(n − 1) + lower bound(n) × (rate(n) − rate(n − 1))
// A position is liquidated when the equity behind it falls to its maintenance margin, judged at the mark
// price. Solved for the price, with side 1 for a long and −1 for a short:
//   liq = price − side × margin_available / size / (1 − rate × side)
// margin_available is the equity behind the position less the maintenance margin now: an isolated
// position's own margin, or a cross account's value less the maintenance of everything in it. The rate is
// the one for the tier the position falls in at the liquidation price.
//
// On 11 Nov 2026 this matched the liquidation price the API reports for all 196 isolated positions
// checked, held by accounts trading on mainnet, and for 473 of 475 cross positions in accounts in the
// standard mode. Accounts in unified or portfolio margin mode back their perps with spot balances, and
// the API works their cross positions out differently.

import type { MarginTable } from "./markets";

export type Tier = { lowerBound: number; maxLeverage: number; rate: number; deduction: number };

/** An asset's tiers. A margin table ID below 50 is a single tier whose max leverage is the ID. */
export function tiersFor(marginTableId: number | undefined, maxLeverage: number, tables: MarginTable[]): Tier[] {
  const table = tables.find(([id]) => id === marginTableId)?.[1].marginTiers;
  const raw = table?.length ? table : [{ lowerBound: "0", maxLeverage: marginTableId !== undefined && marginTableId < 50 ? marginTableId : maxLeverage }];
  let deduction = 0;
  let prev = 0;
  return raw.map((t, i) => {
    const rate = 1 / (2 * t.maxLeverage);
    const lowerBound = Number(t.lowerBound);
    if (i > 0) deduction += lowerBound * (rate - prev);
    prev = rate;
    return { lowerBound, maxLeverage: t.maxLeverage, rate, deduction };
  });
}

export const tierAt = (tiers: Tier[], notional: number) => tiers.filter((t) => notional >= t.lowerBound).at(-1) ?? tiers[0];

export const maintenanceOf = (tiers: Tier[], notional: number) => {
  const t = tierAt(tiers, notional);
  return notional * t.rate - t.deduction;
};

export type Liquidation = { price: number; tier: Tier; marginAvailable: number; maintenanceNow: number };

/**
 * The mark price at which a position is liquidated.
 * @param price  the price now (the mark, or the entry for a position not yet opened)
 * @param equity the equity behind it now: an isolated position's margin, or a cross account's value
 * @param otherMaintenance cross only: the maintenance margin of the account's other positions
 * Null when no price liquidates it: a long backed by its whole value.
 */
export function liquidationPrice(o: { side: 1 | -1; size: number; price: number; equity: number; otherMaintenance?: number; tiers: Tier[] }): Liquidation | null {
  const { side, size, price, equity, tiers } = o;
  for (const tier of tiers) {
    const maintenanceNow = size * price * tier.rate - tier.deduction;
    const marginAvailable = equity - (o.otherMaintenance ?? 0) - maintenanceNow;
    const liq = price - (side * marginAvailable) / size / (1 - tier.rate * side);
    // Zero, give or take rounding: a long at 1x comes out at 0.000000000001 or so.
    if (liq <= price * 1e-9) continue;
    if (tierAt(tiers, size * liq) === tier) return { price: liq, tier, marginAvailable, maintenanceNow };
  }
  return null;
}
