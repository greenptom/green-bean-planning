import Link from "next/link";
import { notFound } from "next/navigation";
import { getDataset } from "@/lib/data";
import { buildDrawdown, buildPlan, coverage } from "@/lib/engine/plan";
import { fmtWeek, isoWeekNumber } from "@/lib/engine/weeks";
import { kg, pct, tonnes } from "@/lib/format";
import type { SiteCode } from "@/lib/types";
import { SITE_FLOWS } from "@/lib/flow";
import { DrawdownTable } from "@/components/DrawdownTable";

export default async function SitePage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ weeks?: string }> }) {
  const { code } = await params;
  const { weeks: weeksParam } = await searchParams;
  const ds = await getDataset();
  const site = ds.sites.find((s) => s.code === code);
  if (!site) notFound();
  const plan = buildPlan(ds);
  const weeks = Math.min(52, Math.max(8, Number(weeksParam ?? 26)));
  const siteGreen = plan.green.filter((g) => g.site_code === site.code);
  const origins = ds.origins.filter((o) => siteGreen.some((g) => g.origin_code === o.code) || ds.lots.some((l) => l.origin_code === o.code));
  const covRows = origins.map((o) => coverage(ds, plan.green, site.code as SiteCode, o.code)).filter((r) => r.demand_52w > 0 || r.on_hand > 0);
  const drawdowns = covRows.map((r) => buildDrawdown(ds, plan.green, r.origin_code, site.code as SiteCode, { weeks }));
  const skus = [...new Set(ds.demandFg.filter((d) => d.site_code === site.code).map((d) => d.sku))].sort();
  const flow = SITE_FLOWS.find((f) => f.site === site.code);
  const fg = ds.fgStock.filter((f) => f.site_code === site.code || (!f.site_code && site.code === "RST"));

  return (
    <div className="space-y-8">
      <nav className="flex gap-1 border-b border-rule">
        {ds.sites.filter((s) => s.active).map((s) => (
          <Link key={s.code} href={`/sites/${s.code}`} className={`px-4 py-2 text-sm -mb-px border-b-2 ${s.code === site.code ? "border-ink font-medium" : "border-transparent text-ink-2 hover:text-ink"}`}>{s.name}</Link>
        ))}
      </nav>

      <header className="flex flex-wrap items-end gap-6">
        <div>
          <p className="eyebrow">{site.role.replace("_", " ")} · {site.country} · stock from {site.stock_source === "cropster" ? `Cropster “${site.cropster_location}”` : "emailed site reports"} · Cin7 branch {site.cin7_branch ?? "—"}</p>
          <h1 className="text-3xl font-bold mt-1">{site.name}</h1>
          {site.conversion_note && <p className="text-sm text-ink-2 mt-1">{site.conversion_note}</p>}
        </div>
        <div className="ml-auto flex gap-2 text-xs">
          {[13, 26, 52].map((w) => (
            <Link key={w} href={`/sites/${site.code}?weeks=${w}`} className={`rounded border px-2 py-1 ${weeks === w ? "border-ink bg-ink text-paper" : "border-rule"}`}>{w} wks</Link>
          ))}
        </div>
      </header>

      <section>
        <h2 className="text-lg font-bold mb-3">Coverage by origin</h2>
        <table className="plan w-full text-sm">
          <thead><tr><th className="text-left">Origin</th><th className="num">52-wk demand</th><th className="num">On hand</th><th className="num">Contracted (earmarked)</th><th className="num">Cover</th><th className="num">Gap to {pct(ds.settings.coverage_target)}</th><th className="num">Ctnrs</th><th className="text-left">Runs out</th></tr></thead>
          <tbody>
            {covRows.map((r) => (
              <tr key={r.origin_code}>
                <td className="font-medium">{ds.origins.find((o) => o.code === r.origin_code)?.name}</td>
                <td className="num">{kg(r.demand_52w)}</td><td className="num">{kg(r.on_hand)}</td><td className="num">{kg(r.contracted)}</td>
                <td className={`num ${r.coverage !== null && r.coverage < ds.settings.coverage_tolerance[0] ? "neg" : ""}`}>{pct(r.coverage)}</td>
                <td className="num">{kg(r.gap_kg)}</td><td className="num">{r.containers || ""}</td>
                <td className={r.stockout_week ? "neg" : "text-ink-3"}>{r.stockout_week ? `w/c ${fmtWeek(r.stockout_week)} (wk ${isoWeekNumber(r.stockout_week)})` : "covered"}</td>
              </tr>
            ))}
            {!covRows.length && <tr><td colSpan={8} className="text-ink-3">No green demand for this site in the horizon. Upload production planned or a forecast with SKUs mapped to {site.code}.</td></tr>}
          </tbody>
        </table>
      </section>

      {drawdowns.map((dd) => (
        <section key={dd.origin_code}>
          <div className="flex items-baseline gap-4 mb-2">
            <h2 className="text-lg font-bold">{ds.origins.find((o) => o.code === dd.origin_code)?.name} — weekly drawdown</h2>
            <span className="text-xs text-ink-3">opening {kg(dd.opening_kg)} kg from {dd.opening_source} · {tonnes(dd.arrivals_52w)} arriving in view</span>
          </div>
          <DrawdownTable rows={dd.rows} />
        </section>
      ))}

      <section className="grid md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-lg font-bold mb-2">SKUs planned here ({skus.length})</h2>
          <p className="text-xs text-ink-3 mb-2">From the latest demand upload. Each needs a recipe row per origin.</p>
          <div className="flex flex-wrap gap-1.5">
            {skus.map((s) => {
              const has = ds.recipes.some((r) => r.site_code === site.code && r.sku === s);
              return <span key={s} className={`rounded border px-1.5 py-0.5 text-[11px] font-mono ${has ? "border-rule" : "border-red bg-red-soft"}`} title={has ? "recipe present" : "no recipe"}>{s}</span>;
            })}
          </div>
          {fg.length > 0 && <p className="text-xs text-ink-3 mt-4">FG stock rows for this site: {fg.length} (as of {ds.asOf.fg_stock})</p>}
        </div>
        {flow && (
          <div>
            <h2 className="text-lg font-bold mb-2">How green becomes finished goods here</h2>
            <p className="text-sm text-ink-2 mb-3">{flow.summary}</p>
            <ol className="space-y-2 text-sm">
              {flow.stages.map((s, i) => (
                <li key={s.label} className="flex gap-3">
                  <span className="num text-ink-3 w-5">{i + 1}</span>
                  <div><span className="font-medium">{s.label}</span> <span className="text-ink-3">· {s.where}</span><p className="text-ink-2">{s.what}{s.conversion ? ` — ${s.conversion}` : ""}</p></div>
                </li>
              ))}
            </ol>
            <Link href="/flow" className="text-xs underline mt-2 inline-block">Full flow and caveats</Link>
          </div>
        )}
      </section>
    </div>
  );
}
