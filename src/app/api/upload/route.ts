import { NextResponse } from "next/server";
import { getDataset, dataMode } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { parseCin7Pos, parseCin7Production, parseCropsterLots, parseFgStock, parseForecast } from "@/lib/parsers";
import { computeGreenDemand } from "@/lib/engine/green";
import type { SiteCode } from "@/lib/types";

export const dynamic = "force-dynamic";

const KINDS = ["forecast", "cropster_lots", "cin7_pos", "cin7_production", "fg_stock"] as const;
type Kind = (typeof KINDS)[number];

export async function POST(req: Request) {
  const form = await req.formData();
  const kind = String(form.get("kind")) as Kind;
  const asOf = String(form.get("as_of") || new Date().toISOString().slice(0, 10));
  const file = form.get("file");
  if (!KINDS.includes(kind) || !(file instanceof File)) return NextResponse.json({ error: "kind and file are required" }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  const ds = await getDataset();
  const skuSite = (sku: string): SiteCode => ds.recipes.find((r) => r.sku === sku)?.site_code ?? (/^PFCCN/.test(sku) ? "UM" : /CRAFT-INSTANT|SACHET/.test(sku) ? "HAC" : /COLDBREW/.test(sku) ? "MUN" : "RST");

  let parsed: { rows: object[]; warnings: string[]; headers: string[] };
  switch (kind) {
    case "forecast": parsed = parseForecast(buf, asOf, { sites: ds.sites, skuSite }); break;
    case "cropster_lots": parsed = parseCropsterLots(buf, asOf, { locations: ds.locations, origins: ds.origins }); break;
    case "cin7_pos": parsed = parseCin7Pos(buf, asOf, { sites: ds.sites, origins: ds.origins }); break;
    case "cin7_production": parsed = parseCin7Production(buf, asOf, { sites: ds.sites }); break;
    case "fg_stock": parsed = parseFgStock(buf, asOf, { sites: ds.sites }); break;
  }

  if (dataMode() === "local") {
    return NextResponse.json({ mode: "local", persisted: false, rows: parsed.rows.length, warnings: parsed.warnings, headers: parsed.headers, sample: parsed.rows.slice(0, 5) });
  }

  const sb = supabaseServer();
  const storagePath = `${kind}/${asOf}/${file.name}`;
  await sb.storage.from("uploads").upload(storagePath, buf, { upsert: true, contentType: file.type || "application/octet-stream" });
  const { data: up, error: upErr } = await sb.from("uploads").insert({ kind, as_of_date: asOf, file_name: file.name, storage_path: storagePath, row_count: parsed.rows.length, notes: parsed.warnings.join("\n") || null }).select().single();
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const table = { forecast: "demand_fg", cropster_lots: "lots", cin7_pos: "purchase_orders", cin7_production: "production_jobs", fg_stock: "fg_stock" }[kind];
  await sb.from(table).delete().eq("as_of_date", asOf); // re-upload for the same day replaces
  const chunks = Array.from({ length: Math.ceil(parsed.rows.length / 1000) }, (_, i) => parsed.rows.slice(i * 1000, (i + 1) * 1000).map((r) => ({ ...r, upload_id: up.id })));
  for (const c of chunks) {
    const { error } = await sb.from(table).insert(c);
    if (error) return NextResponse.json({ error: error.message, uploaded: up.id }, { status: 500 });
  }

  if (kind === "forecast" || kind === "cin7_production") {
    // production jobs are demand too: merge with forecast rows for the same as_of so demand_green stays one table
    const pageAll = async (table: string) => {
      const out: Record<string, unknown>[] = [];
      for (let from = 0; ; from += 1000) {
        const { data } = await sb.from(table).select("*").eq("as_of_date", asOf).order("id").range(from, from + 999);
        out.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      return out;
    };
    const demandRows = (await pageAll("demand_fg")) as unknown as Parameters<typeof computeGreenDemand>[0];
    const jobRows = (await pageAll("production_jobs")) as { site_code: SiteCode | null; sku: string; scheduled_date: string | null; qty: number }[];
    const all = [
      ...(demandRows ?? []),
      ...(jobRows ?? []).map((j) => ({ as_of_date: asOf, site_code: j.site_code ?? "RST", sku: j.sku, week_start: j.scheduled_date ?? asOf, units: j.qty, kind: "production_planned" as const })),
    ];
    const { green } = computeGreenDemand(all, ds.recipes, ds.sites);
    await sb.from("demand_green").delete().eq("as_of_date", asOf);
    for (let i = 0; i < green.length; i += 1000) await sb.from("demand_green").insert(green.slice(i, i + 1000));
  }

  return NextResponse.json({ mode: "supabase", persisted: true, upload_id: up.id, rows: parsed.rows.length, warnings: parsed.warnings });
}
