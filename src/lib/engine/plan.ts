/**
 * The planning model, written to mirror Ash's "Green Bean" tab:
 *   Fcst Use → Stock Held → Future Stock Land → Scenario Buy → Weeks Cover
 * but per origin × site, with provenance on every arrival.
 */
import type { Dataset, DemandGreen, Lot, PurchaseOrder, ScenarioBuy, SiteCode } from "../types";
import { addWeeks, monthFirstWeek, thisWeek, weekRange, weekStart } from "./weeks";
import { computeGreenDemand } from "./green";

export type Arrival = {
  week: string;
  kg: number;
  kind: "lot_contracted" | "po" | "inbound" | "scenario";
  ref: string;
  detail: string;
  fixing_status?: string | null;
  priced: boolean;
};

export type WeekRow = {
  week: string;
  opening: number;
  demand: number;
  arrivals: number;
  closing: number;
  weeks_cover: number | null;
  arrivalRefs: Arrival[];
};

export type Drawdown = {
  site_code: SiteCode | "ALL";
  origin_code: string;
  opening_kg: number;
  opening_source: string;
  contracted_kg: number;
  rows: WeekRow[];
  stockout_week: string | null;
  demand_52w: number;
  arrivals_52w: number;
};

export type SiteHint = { site_code: SiteCode; patterns: RegExp[] };
const SITE_HINTS: SiteHint[] = [
  { site_code: "UM", patterns: [/\(UM\b/i, /ultramar/i, /\(UM,/i] },
  { site_code: "HAC", patterns: [/haco/i] },
  { site_code: "MAS", patterns: [/masteroast/i, /\(BA\)/i] },
];

/** Which site a contracted lot is earmarked for — Cropster Project (blend designation) first, then name hints, else roastery. */
export const lotSite = (lot: Lot, ds: Dataset): SiteCode => {
  const bd = ds.blendDesignations.find((b) => b.name === lot.blend_designation);
  if (bd?.site_code) return bd.site_code;
  const loc = ds.locations.find((l) => l.code === lot.location_code);
  if (loc && loc.kind !== "contracted") return loc.site_code;
  for (const h of SITE_HINTS) if (h.patterns.some((p) => p.test(lot.name ?? ""))) return h.site_code;
  return "RST";
};

const poSite = (po: PurchaseOrder, ds: Dataset): SiteCode => {
  if (po.site_code) return po.site_code;
  const s = ds.sites.find((x) => x.cin7_branch && po.branch && po.branch.toLowerCase().startsWith(x.cin7_branch.toLowerCase().slice(0, 5)));
  return s?.code ?? "RST";
};

/** Opening on-hand kg for origin × site: Cropster physical lots if uploaded, else the latest site/stock-master report. */
export const openingStock = (ds: Dataset, origin: string, site: SiteCode | "ALL") => {
  const locs = ds.locations.filter((l) => l.kind !== "contracted" && (site === "ALL" || l.site_code === site)).map((l) => l.code);
  const lots = ds.lots.filter((l) => l.origin_code === origin && l.location_code && locs.includes(l.location_code));
  if (lots.length) return { kg: lots.reduce((a, l) => a + l.kg, 0), source: `Cropster ${ds.asOf.lots}` };
  const latestDate = ds.siteStockReports.filter((r) => r.origin_code === origin).map((r) => r.as_of_date).sort().at(-1);
  if (!latestDate) return { kg: 0, source: "no stock record" };
  const rows = ds.siteStockReports.filter((r) => r.origin_code === origin && r.as_of_date === latestDate && (site === "ALL" || r.site_code === site || (r.location_code && locs.includes(r.location_code))));
  return { kg: rows.reduce((a, r) => a + r.kg_green, 0), source: `${rows[0]?.source ?? "stock report"} ${latestDate}` };
};

export const arrivalsFor = (ds: Dataset, origin: string, site: SiteCode | "ALL", scenario: ScenarioBuy[] = []): Arrival[] => {
  const out: Arrival[] = [];
  // 1. Contracted Cropster lots (pseudo-locations) with an arrival month
  for (const l of ds.lots) {
    if (l.origin_code !== origin || l.fixing_status === "landed") continue;
    const s = lotSite(l, ds);
    if (site !== "ALL" && s !== site) continue;
    if (!l.arrival_month) continue;
    out.push({ week: monthFirstWeek(l.arrival_month), kg: l.kg, kind: "lot_contracted", ref: l.lot_id, detail: `${l.name} · ${l.fixing_status} · ${l.price_note ?? ""}`.trim(), fixing_status: l.fixing_status, priced: l.price_gbp_kg != null });
  }
  // 2. Cin7 open POs with a dated ETA/ETD, only when no Cropster lot already carries the same PO
  const lotPos = new Set(ds.lots.map((l) => l.cin7_po).filter(Boolean));
  for (const po of ds.purchaseOrders) {
    if (po.origin_code !== origin || !(po.qty_open ?? 0)) continue;
    if (lotPos.has(po.po_number)) continue;
    const s = poSite(po, ds);
    if (site !== "ALL" && s !== site) continue;
    const when = po.eta ?? po.etd;
    if (!when) continue;
    out.push({ week: weekStart(when), kg: po.qty_open ?? 0, kind: "po", ref: po.po_number, detail: `${po.product_name ?? po.cin7_sku ?? ""} · ${po.supplier ?? ""}`, priced: (po.unit_cost ?? 0) > 0 });
  }
  // 3. Inbound tab rows not already covered by a lot or PO
  const seen = new Set(out.map((a) => a.ref));
  for (const i of ds.inbound) {
    if (i.origin_code !== origin || seen.has(i.contract_ref) || seen.has(i.po_number)) continue;
    if (site !== "ALL" && site !== "RST") continue; // Inbound tab is roastery-bound
    out.push({ week: weekStart(i.eta_week), kg: i.kg, kind: "inbound", ref: i.contract_ref || i.po_number, detail: `${i.supplier} · ${i.po_number}`, priced: i.gbp_per_kg != null });
  }
  // 4. Scenario buys
  for (const b of scenario) {
    if (b.origin_code !== origin) continue;
    if (site !== "ALL" && b.site_code !== "ALL" && b.site_code !== site) continue;
    out.push({ week: weekStart(b.land_week), kg: b.kg, kind: "scenario", ref: "scenario", detail: b.note ?? "scenario buy", priced: false });
  }
  return out;
};

export const contractedKg = (ds: Dataset, origin: string, site: SiteCode | "ALL") =>
  ds.lots.filter((l) => l.origin_code === origin && l.fixing_status !== "landed" && (site === "ALL" || lotSite(l, ds) === site)).reduce((a, l) => a + l.kg, 0);

export const buildDrawdown = (ds: Dataset, green: DemandGreen[], origin: string, site: SiteCode | "ALL", opts: { from?: string; weeks?: number; scenario?: ScenarioBuy[] } = {}): Drawdown => {
  const from = opts.from ?? thisWeek();
  const weeks = weekRange(from, opts.weeks ?? ds.settings.horizon_weeks);
  const demandByWeek = new Map<string, number>();
  for (const g of green) if (g.origin_code === origin && (site === "ALL" || g.site_code === site)) demandByWeek.set(g.week_start, (demandByWeek.get(g.week_start) ?? 0) + g.kg);
  const arrivals = arrivalsFor(ds, origin, site, opts.scenario);
  const opening = openingStock(ds, origin, site);
  let bal = opening.kg;
  let stockout: string | null = null;
  const rows: WeekRow[] = weeks.map((w, i) => {
    const demand = demandByWeek.get(w) ?? 0;
    const refs = arrivals.filter((a) => a.week === w);
    const arr = refs.reduce((a, r) => a + r.kg, 0);
    const openingW = bal;
    bal = bal - demand + arr;
    const fwd = weeks.slice(i + 1, i + 5).map((x) => demandByWeek.get(x) ?? 0);
    const avg = fwd.length ? fwd.reduce((a, b) => a + b, 0) / fwd.length : 0;
    if (bal < 0 && !stockout) stockout = w;
    return { week: w, opening: openingW, demand, arrivals: arr, closing: bal, weeks_cover: avg > 0 ? bal / avg : null, arrivalRefs: refs };
  });
  return {
    site_code: site, origin_code: origin, opening_kg: opening.kg, opening_source: opening.source,
    contracted_kg: contractedKg(ds, origin, site), rows, stockout_week: stockout,
    demand_52w: rows.reduce((a, r) => a + r.demand, 0), arrivals_52w: rows.reduce((a, r) => a + r.arrivals, 0),
  };
};

export type CoverageRow = {
  site_code: SiteCode | "ALL";
  origin_code: string;
  demand_52w: number;
  on_hand: number;
  contracted: number;
  coverage: number | null;
  gap_kg: number;
  containers: number;
  stockout_week: string | null;
};

export const coverage = (ds: Dataset, green: DemandGreen[], site: SiteCode | "ALL", origin: string): CoverageRow => {
  const dd = buildDrawdown(ds, green, origin, site);
  const covered = dd.opening_kg + dd.contracted_kg;
  const cov = dd.demand_52w > 0 ? covered / dd.demand_52w : null;
  const gap = Math.max(0, dd.demand_52w * ds.settings.coverage_target - covered);
  return { site_code: site, origin_code: origin, demand_52w: dd.demand_52w, on_hand: dd.opening_kg, contracted: dd.contracted_kg, coverage: cov, gap_kg: gap, containers: Math.ceil(gap / ds.settings.container_kg), stockout_week: dd.stockout_week };
};

export const buildPlan = (ds: Dataset) => {
  const { green, unmapped } = computeGreenDemand(ds.demandFg, ds.recipes, ds.sites);
  const horizonStart = thisWeek();
  const horizonEnd = addWeeks(horizonStart, ds.settings.horizon_weeks);
  const originsInDemand = [...new Set(green.filter((g) => g.week_start >= horizonStart && g.week_start < horizonEnd).map((g) => g.origin_code))];
  const ordered = ds.origins.filter((o) => originsInDemand.includes(o.code) || ds.lots.some((l) => l.origin_code === o.code));
  const lastDemandWeek = green.map((g) => g.week_start).sort().at(-1) ?? null;
  const demandWeeksInHorizon = new Set(green.filter((g) => g.week_start >= horizonStart && g.week_start < horizonEnd).map((g) => g.week_start)).size;
  return { green, unmapped, origins: ordered, horizonStart, horizonEnd, lastDemandWeek, demandWeeksInHorizon };
};
