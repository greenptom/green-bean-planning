/**
 * Local data source: reads the seed CSVs in supabase/seed so the app runs with no database.
 * Stock comes from Ash's Stock Master (Feb 2026) until a Cropster export is uploaded.
 */
import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import type { Dataset, DemandFg, Inbound, Location, Origin, Recipe, Settings, Site, SiteCode, SiteStockReport } from "../types";

const seedDir = () => path.join(process.cwd(), "supabase", "seed");

const readCsv = <T extends object>(file: string): T[] => {
  const text = fs.readFileSync(path.join(seedDir(), file), "utf8");
  return Papa.parse<T>(text, { header: true, skipEmptyLines: true, dynamicTyping: true }).data;
};

const bool = (v: unknown) => v === true || v === "true";

export const loadLocalDataset = (): Dataset => {
  const sites = readCsv<Record<string, unknown>>("sites.csv").map((r) => ({
    code: r.code as SiteCode,
    name: String(r.name),
    country: String(r.country ?? ""),
    role: r.role as Site["role"],
    stock_source: r.stock_source as Site["stock_source"],
    cropster_location: (r.cropster_location as string) || null,
    cin7_branch: (r.cin7_branch as string) || null,
    green_conversion_factor: Number(r.green_conversion_factor ?? 1),
    conversion_note: (r.conversion_note as string) || null,
    active: bool(r.active),
  }));
  const origins = readCsv<Record<string, unknown>>("origins.csv").map((r) => ({
    code: String(r.code), name: String(r.name), country: String(r.country ?? ""), decaf: bool(r.decaf), sort_order: Number(r.sort_order ?? 100),
  })) as Origin[];
  const locations = readCsv<Record<string, unknown>>("locations.csv").map((r) => ({
    code: String(r.code),
    cropster_name: (r.cropster_name as string) || null,
    kind: r.kind as Location["kind"],
    site_code: r.site_code as SiteCode,
    fixing_status: (r.fixing_status as Location["fixing_status"]) || null,
  }));
  const blendDesignations = readCsv<{ name: string; origin_code: string; site_code: SiteCode; note: string }>("blend_designations.csv");
  const recipes = readCsv<Recipe>("recipes.csv");
  const demandRows = readCsv<{ site_code: SiteCode; sku: string; week_start: string; units: number; source: string }>("demand_fg.csv");
  const demandAsOf = "2026-10-09"; // Ash's sheet last modified
  const demandFg: DemandFg[] = demandRows.map((r) => ({
    as_of_date: demandAsOf, site_code: r.site_code, sku: r.sku, week_start: String(r.week_start), units: Number(r.units), kind: "production_planned", source: r.source,
  }));
  const stock = readCsv<{ as_of_date: string; origin_code: string; location_code: string; kg: number; source: string }>("stock_master.csv");
  const siteStockReports: SiteStockReport[] = stock.map((r) => ({
    as_of_date: String(r.as_of_date),
    site_code: locations.find((l) => l.code === r.location_code)?.site_code ?? null,
    location_code: r.location_code,
    origin_code: r.origin_code,
    kg_green: Number(r.kg),
    kg_semi_finished: 0,
    source: r.source,
  }));
  const inbound = readCsv<Inbound>("inbound.csv").map((r) => ({ ...r, eta_week: String(r.eta_week), gbp_per_kg: r.gbp_per_kg === null || r.gbp_per_kg === ("" as unknown) ? null : Number(r.gbp_per_kg) }));
  const settingsRaw = JSON.parse(fs.readFileSync(path.join(seedDir(), "settings.json"), "utf8")) as Record<string, unknown[]>;
  const settings: Settings = {
    coverage_target: Number(settingsRaw.coverage_target[0]),
    coverage_tolerance: [Number(settingsRaw.coverage_tolerance[0]), Number(settingsRaw.coverage_tolerance[1])],
    container_kg: Number(settingsRaw.container_kg[0]),
    horizon_weeks: Number(settingsRaw.horizon_weeks[0]),
    roast_loss: Number(settingsRaw.roast_loss[0]),
    haco_sf_yield: Number(settingsRaw.haco_sf_yield[0]),
    stale_after_days: Number(settingsRaw.stale_after_days[0]),
  };

  return {
    mode: "local",
    sites, origins, locations, blendDesignations, recipes, demandFg,
    lots: [],
    purchaseOrders: [],
    productionJobs: [],
    fgStock: [],
    siteStockReports,
    inbound,
    settings,
    asOf: { demand: demandAsOf, lots: null, purchase_orders: null, production_jobs: null, fg_stock: null, site_stock_reports: stock[0]?.as_of_date ? String(stock[0].as_of_date) : null },
  };
};
