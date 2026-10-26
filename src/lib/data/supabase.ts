/**
 * Supabase data source. Reads reference tables plus the latest as_of_date of every uploaded dataset.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Dataset, Settings } from "../types";

export const supabaseServer = (): SupabaseClient => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing: NEXT_PUBLIC_SUPABASE_URL and a key");
  return createClient(url, key, { auth: { persistSession: false } });
};

const latest = async (sb: SupabaseClient, table: string): Promise<string | null> => {
  const { data } = await sb.from(table).select("as_of_date").order("as_of_date", { ascending: false }).limit(1);
  return data?.[0]?.as_of_date ?? null;
};

const latestRows = async <T>(sb: SupabaseClient, table: string, extraOrder?: string): Promise<{ rows: T[]; asOf: string | null }> => {
  const asOf = await latest(sb, table);
  if (!asOf) return { rows: [], asOf: null };
  let q = sb.from(table).select("*").eq("as_of_date", asOf).limit(50000);
  if (extraOrder) q = q.order(extraOrder);
  const { data, error } = await q;
  if (error) throw error;
  return { rows: (data ?? []) as T[], asOf };
};

export const loadSupabaseDataset = async (): Promise<Dataset> => {
  const sb = supabaseServer();
  const [sites, origins, locations, blends, recipes, settingsRows, inbound] = await Promise.all([
    sb.from("sites").select("*").order("code"),
    sb.from("origins").select("*").order("sort_order"),
    sb.from("locations").select("*"),
    sb.from("blend_designations").select("*"),
    sb.from("recipes").select("*").is("valid_to", null),
    sb.from("settings").select("*"),
    sb.from("inbound").select("*").order("eta_week"),
  ]);
  const demand = await latestRows<Dataset["demandFg"][number]>(sb, "demand_fg");
  const lots = await latestRows<Dataset["lots"][number]>(sb, "lots");
  const pos = await latestRows<Dataset["purchaseOrders"][number]>(sb, "purchase_orders");
  const jobs = await latestRows<Dataset["productionJobs"][number]>(sb, "production_jobs");
  const fg = await latestRows<Dataset["fgStock"][number]>(sb, "fg_stock");
  const reports = await sb.from("site_stock_reports").select("*").order("as_of_date", { ascending: false }).limit(5000);

  const s = Object.fromEntries((settingsRows.data ?? []).map((r) => [r.key, r.value])) as Record<string, unknown[]>;
  const settings: Settings = {
    coverage_target: Number(s.coverage_target?.[0] ?? 0.7),
    coverage_tolerance: [Number(s.coverage_tolerance?.[0] ?? 0.65), Number(s.coverage_tolerance?.[1] ?? 0.75)],
    container_kg: Number(s.container_kg?.[0] ?? 20000),
    horizon_weeks: Number(s.horizon_weeks?.[0] ?? 52),
    roast_loss: Number(s.roast_loss?.[0] ?? 0.15),
    haco_sf_yield: Number(s.haco_sf_yield?.[0] ?? 0.38),
    stale_after_days: Number(s.stale_after_days?.[0] ?? 8),
  };

  return {
    mode: "supabase",
    sites: sites.data ?? [],
    origins: origins.data ?? [],
    locations: locations.data ?? [],
    blendDesignations: blends.data ?? [],
    recipes: recipes.data ?? [],
    demandFg: demand.rows,
    lots: lots.rows,
    purchaseOrders: pos.rows,
    productionJobs: jobs.rows,
    fgStock: fg.rows,
    siteStockReports: reports.data ?? [],
    inbound: inbound.data ?? [],
    settings,
    asOf: { demand: demand.asOf, lots: lots.asOf, purchase_orders: pos.asOf, production_jobs: jobs.asOf, fg_stock: fg.asOf, site_stock_reports: reports.data?.[0]?.as_of_date ?? null },
  };
};
