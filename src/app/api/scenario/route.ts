import { NextResponse } from "next/server";
import { z } from "zod";
import { getDataset } from "@/lib/data";
import { buildDrawdown, buildPlan } from "@/lib/engine/plan";

const Body = z.object({
  origin_code: z.string(),
  site_code: z.string().default("ALL"),
  weeks: z.number().int().min(8).max(52).default(26),
  buys: z.array(z.object({ origin_code: z.string(), site_code: z.string().default("ALL"), land_week: z.string(), kg: z.number().positive(), note: z.string().optional() })).default([]),
});

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { origin_code, site_code, weeks, buys } = parsed.data;
  const ds = await getDataset();
  const plan = buildPlan(ds);
  const site = site_code as "ALL" | "RST" | "UM" | "HAC" | "MUN" | "CRL" | "MAS";
  const base = buildDrawdown(ds, plan.green, origin_code, site, { weeks });
  const withBuys = buildDrawdown(ds, plan.green, origin_code, site, { weeks, scenario: buys.map((b) => ({ ...b, site_code: b.site_code as "ALL" })) });
  return NextResponse.json({ base, scenario: withBuys, settings: ds.settings });
}
