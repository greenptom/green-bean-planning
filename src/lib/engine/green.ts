/**
 * Demand → green. One unit of a SKU at a site consumes `qty` grams of each origin per its recipe.
 * `g_coffee_per_can` recipes are multiplied by the site's green_conversion_factor (instant → green etc).
 */
import type { DemandFg, DemandGreen, Recipe, Site, SiteCode } from "../types";
import { weekStart } from "./weeks";

export type UnmappedSku = { site_code: SiteCode; sku: string; units: number };

export const computeGreenDemand = (demand: DemandFg[], recipes: Recipe[], sites: Site[]) => {
  const factor = new Map(sites.map((s) => [s.code, s.green_conversion_factor]));
  const bySiteSku = new Map<string, Recipe[]>();
  for (const r of recipes) {
    const k = `${r.site_code}|${r.sku}`;
    bySiteSku.set(k, [...(bySiteSku.get(k) ?? []), r]);
  }
  const acc = new Map<string, DemandGreen>();
  const unmapped = new Map<string, UnmappedSku>();
  for (const d of demand) {
    const recs = bySiteSku.get(`${d.site_code}|${d.sku}`);
    if (!recs?.length) {
      const k = `${d.site_code}|${d.sku}`;
      const u = unmapped.get(k) ?? { site_code: d.site_code, sku: d.sku, units: 0 };
      u.units += d.units;
      unmapped.set(k, u);
      continue;
    }
    const wk = weekStart(d.week_start);
    for (const r of recs) {
      const grams = r.unit_kind === "g_coffee_per_can" ? r.qty * (factor.get(d.site_code) ?? 1) : r.qty;
      const kg = (grams * d.units) / 1000;
      const k = `${d.as_of_date}|${d.site_code}|${r.origin_code}|${wk}`;
      const row = acc.get(k) ?? { as_of_date: d.as_of_date, site_code: d.site_code, origin_code: r.origin_code, week_start: wk, kg: 0 };
      row.kg += kg;
      acc.set(k, row);
    }
  }
  return { green: [...acc.values()], unmapped: [...unmapped.values()] };
};
