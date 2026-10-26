/**
 * Seed Supabase from supabase/seed/*.csv. Run after applying migrations:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed.ts
 */
import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import { createClient } from "@supabase/supabase-js";

// Load .env.local (Next.js convention) so the script works from a plain `npm run seed`.
const envFile = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Fill NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local (copy .env.example first)");
const sb = createClient(url, key, { auth: { persistSession: false } });
const dir = path.join(process.cwd(), "supabase", "seed");
const csv = <T extends Record<string, unknown> = Record<string, unknown>>(f: string) => Papa.parse<T>(fs.readFileSync(path.join(dir, f), "utf8"), { header: true, skipEmptyLines: true, dynamicTyping: true }).data;
const nullify = <T extends Record<string, unknown>>(r: T) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v === "" ? null : v])) as T;

const upsert = async (table: string, rows: object[], onConflict?: string) => {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from(table).upsert(rows.slice(i, i + 500), onConflict ? { onConflict } : undefined);
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  console.log(`${table}: ${rows.length}`);
};

const main = async () => {
  await upsert("sites", csv("sites.csv").map(nullify));
  await upsert("origins", csv("origins.csv").map(nullify));
  await upsert("locations", csv("locations.csv").map(nullify));
  await upsert("blend_designations", csv("blend_designations.csv").map(nullify));
  await upsert("recipes", csv("recipes.csv").map(nullify), "site_code,sku,origin_code,valid_from");
  const settings = JSON.parse(fs.readFileSync(path.join(dir, "settings.json"), "utf8")) as Record<string, unknown>;
  await upsert("settings", Object.entries(settings).map(([k, v]) => ({ key: k, value: v, updated_by: "seed" })));

  const seedAsOf = "2026-10-09";
  const { data: up } = await sb.from("uploads").insert({ kind: "sheet_seed", as_of_date: seedAsOf, file_name: "Green Bean Supply Plan 2026 (Ash)", notes: "Production planned per site, Stock Master, Inbound" }).select().single();
  const demand = csv<{ site_code: string; sku: string; week_start: string; units: number; source: string }>("demand_fg.csv").map((r) => ({ upload_id: up!.id, as_of_date: seedAsOf, site_code: r.site_code, sku: r.sku, week_start: String(r.week_start), units: r.units, kind: "production_planned", source: r.source }));
  await sb.from("demand_fg").delete().eq("as_of_date", seedAsOf);
  await upsert("demand_fg", demand);
  const locs = csv<{ code: string; site_code: string }>("locations.csv");
  const stock = csv<{ as_of_date: string; origin_code: string; location_code: string; kg: number; source: string }>("stock_master.csv").map((r) => ({ upload_id: up!.id, as_of_date: String(r.as_of_date), site_code: locs.find((l) => l.code === r.location_code)?.site_code ?? null, location_code: r.location_code, origin_code: r.origin_code, kg_green: r.kg, source: r.source }));
  await upsert("site_stock_reports", stock);
  const inbound = csv<Record<string, unknown>>("inbound.csv").map((r) => ({ upload_id: up!.id, ...nullify(r), eta_week: String(r.eta_week) }));
  await upsert("inbound", inbound);

  // demand_green for the seed
  const { computeGreenDemand } = await import("../src/lib/engine/green");
  const sites = csv<{ code: string; green_conversion_factor: number }>("sites.csv");
  const recipes = csv<{ site_code: string; sku: string; origin_code: string; qty: number; unit_kind: string; valid_from: string; source: string }>("recipes.csv");
  const { green, unmapped } = computeGreenDemand(demand as never, recipes as never, sites as never);
  await sb.from("demand_green").delete().eq("as_of_date", seedAsOf);
  await upsert("demand_green", green);
  console.log("unmapped SKUs:", unmapped.map((u) => `${u.site_code} ${u.sku}`).join(", ") || "none");
};

main().catch((e) => { console.error(e); process.exit(1); });
