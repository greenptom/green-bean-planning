/**
 * Row-batch upload for large files (the 11 MB Forecast – All Channels export is over Vercel's 4.5 MB body limit).
 * The browser parses the workbook and posts compact rows:
 *   POST { action: "begin", kind, as_of, file_name, total }          -> { upload_id }
 *   POST { action: "rows", kind, as_of, upload_id, rows: [...] }      (repeat, ≤5000 rows per call)
 *   POST { action: "finish", kind, as_of, upload_id }                 -> recompute demand_green
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDataset, dataMode } from "@/lib/data";
import { supabaseServer } from "@/lib/data/supabase";
import { computeGreenDemand } from "@/lib/engine/green";
import { weekStart } from "@/lib/engine/weeks";
import type { SiteCode } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ForecastRow = z.object({ sku: z.string().min(1), week: z.string().min(8), units: z.number(), channel: z.string().nullable().optional() });
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("begin"), kind: z.literal("forecast"), as_of: z.string(), file_name: z.string(), total: z.number().int().nonnegative() }),
  z.object({ action: z.literal("rows"), kind: z.literal("forecast"), as_of: z.string(), upload_id: z.string(), rows: z.array(ForecastRow).max(5000) }),
  z.object({ action: z.literal("finish"), kind: z.literal("forecast"), as_of: z.string(), upload_id: z.string() }),
]);

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const body = parsed.data;
  if (dataMode() === "local") return NextResponse.json({ mode: "local", persisted: false, note: "seed mode: rows accepted but not stored" });
  const sb = supabaseServer();
  const ds = await getDataset();
  const skuSite = (sku: string): SiteCode => ds.recipes.find((r) => r.sku === sku)?.site_code ?? (/^PFCCN/.test(sku) ? "UM" : /CRAFT-INSTANT|SACHET/.test(sku) ? "HAC" : /COLDBREW/.test(sku) ? "MUN" : "RST");

  if (body.action === "begin") {
    const { data, error } = await sb.from("uploads").insert({ kind: body.kind, as_of_date: body.as_of, file_name: body.file_name, row_count: body.total, notes: "row-batch upload (parsed in browser)" }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await sb.from("demand_fg").delete().eq("as_of_date", body.as_of).eq("kind", "forecast");
    return NextResponse.json({ upload_id: data.id });
  }

  if (body.action === "rows") {
    const rows = body.rows.filter((r) => r.units).map((r) => ({
      upload_id: body.upload_id, as_of_date: body.as_of, site_code: skuSite(r.sku), sku: r.sku, channel: r.channel ?? null,
      week_start: weekStart(r.week), units: r.units, kind: "forecast", source: "Forecast – All Channels",
    }));
    for (let i = 0; i < rows.length; i += 1000) {
      const { error } = await sb.from("demand_fg").insert(rows.slice(i, i + 1000));
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ inserted: rows.length });
  }

  // finish: recompute demand_green for this as_of from forecast + production jobs
  const pageAll = async (table: string) => {
    const out: Record<string, unknown>[] = [];
    for (let from = 0; ; from += 1000) {
      const { data } = await sb.from(table).select("*").eq("as_of_date", body.as_of).order("id").range(from, from + 999);
      out.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    return out;
  };
  const demandRows = (await pageAll("demand_fg")) as unknown as Parameters<typeof computeGreenDemand>[0];
  const jobRows = (await pageAll("production_jobs")) as { site_code: SiteCode | null; sku: string; scheduled_date: string | null; qty: number }[];
  const all = [...demandRows, ...jobRows.map((j) => ({ as_of_date: body.as_of, site_code: j.site_code ?? "RST", sku: j.sku, week_start: j.scheduled_date ?? body.as_of, units: j.qty, kind: "production_planned" as const }))];
  const { green, unmapped } = computeGreenDemand(all, ds.recipes, ds.sites);
  await sb.from("demand_green").delete().eq("as_of_date", body.as_of);
  for (let i = 0; i < green.length; i += 1000) {
    const { error } = await sb.from("demand_green").insert(green.slice(i, i + 1000));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await sb.from("uploads").update({ row_count: demandRows.length }).eq("id", body.upload_id);
  return NextResponse.json({ persisted: true, demand_rows: demandRows.length, green_rows: green.length, unmapped: unmapped.map((u) => `${u.site_code} ${u.sku}`) });
}
