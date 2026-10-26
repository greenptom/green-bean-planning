import Link from "next/link";
import { getDataset } from "@/lib/data";
import { buildPlan, coverage } from "@/lib/engine/plan";
import { kg, pct, tonnes, fmtAsOf } from "@/lib/format";
import { fmtWeek } from "@/lib/engine/weeks";

export default async function Overview() {
  const ds = await getDataset();
  const plan = buildPlan(ds);
  const rows = plan.origins.map((o) => coverage(ds, plan.green, "ALL", o.code)).filter((r) => r.demand_52w > 0 || r.on_hand > 0 || r.contracted > 0);
  const totDemand = rows.reduce((a, r) => a + r.demand_52w, 0);
  const totCovered = rows.reduce((a, r) => a + r.on_hand + r.contracted, 0);
  const totGap = rows.reduce((a, r) => a + r.gap_kg, 0);
  const containers = rows.reduce((a, r) => a + r.containers, 0);
  const bySite = ds.sites.filter((s) => s.active).map((s) => ({
    site: s,
    demand: plan.green.filter((g) => g.site_code === s.code && g.week_start >= plan.horizonStart && g.week_start < plan.horizonEnd).reduce((a, g) => a + g.kg, 0),
    stockouts: plan.origins.map((o) => coverage(ds, plan.green, s.code, o.code)).filter((c) => c.stockout_week && c.demand_52w > 0),
  }));

  return (
    <div className="space-y-10">
      <section>
        <p className="eyebrow">52-week position · from w/c {fmtWeek(plan.horizonStart)} · demand as of {fmtAsOf(ds.asOf.demand)}</p>
        {plan.demandWeeksInHorizon < ds.settings.horizon_weeks && (
          <p className="mt-2 inline-block rounded border border-amber/40 bg-amber-soft px-2 py-1 text-xs">Demand data covers {plan.demandWeeksInHorizon} of {ds.settings.horizon_weeks} weeks (ends w/c {plan.lastDemandWeek ? fmtWeek(plan.lastDemandWeek) : "—"}). Coverage is understated until the 12-month forecast is uploaded.</p>
        )}
        <h1 className="text-3xl font-bold mt-1">Green coffee across every site</h1>
        <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4">
          <Stat label="52-week green demand" value={tonnes(totDemand)} />
          <Stat label="On hand + contracted" value={tonnes(totCovered)} sub={ds.asOf.lots ? `Cropster ${fmtAsOf(ds.asOf.lots)}` : "no Cropster upload yet"} />
          <Stat label="Coverage" value={pct(totDemand ? totCovered / totDemand : null)} sub={`target ${pct(ds.settings.coverage_target)}`} tone={totDemand && totCovered / totDemand >= ds.settings.coverage_tolerance[0] ? "ok" : "warn"} />
          <Stat label="Gap to target" value={tonnes(totGap)} />
          <Stat label="Containers to buy" value={String(containers)} sub={`${ds.settings.container_kg.toLocaleString()} kg each`} />
        </div>
      </section>

      <section className="grid md:grid-cols-2 gap-10">
        <div>
          <h2 className="text-lg font-bold mb-3">By origin, all sites</h2>
          <table className="plan w-full text-sm">
            <thead><tr><th className="text-left">Origin</th><th className="num">Demand kg</th><th className="num">On hand</th><th className="num">Contracted</th><th className="num">Cover</th><th className="num">Gap</th><th className="num">Ctnrs</th><th className="text-left">Runs out</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.origin_code}>
                  <td className="font-medium">{ds.origins.find((o) => o.code === r.origin_code)?.name}</td>
                  <td className="num">{kg(r.demand_52w)}</td><td className="num">{kg(r.on_hand)}</td><td className="num">{kg(r.contracted)}</td>
                  <td className={`num ${r.coverage !== null && r.coverage < ds.settings.coverage_tolerance[0] ? "neg" : ""}`}>{pct(r.coverage)}</td>
                  <td className="num">{kg(r.gap_kg)}</td><td className="num">{r.containers || ""}</td>
                  <td className={r.stockout_week ? "neg" : "text-ink-3"}>{r.stockout_week ? `w/c ${fmtWeek(r.stockout_week)}` : "covered"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h2 className="text-lg font-bold mb-3">By site</h2>
          <ul className="divide-y divide-rule">
            {bySite.map(({ site, demand, stockouts }) => (
              <li key={site.code} className="py-3 flex items-baseline gap-4">
                <Link href={`/sites/${site.code}`} className="font-medium w-56 hover:underline">{site.name}</Link>
                <span className="num text-sm w-24 text-right">{tonnes(demand)}</span>
                <span className="text-sm text-ink-2">{stockouts.length ? <span className="neg">{stockouts.map((s) => `${s.origin_code} w/c ${fmtWeek(s.stockout_week!)}`).join(" · ")}</span> : <span className="text-ink-3">no stock-out in 52 weeks</span>}</span>
              </li>
            ))}
          </ul>
          {plan.unmapped.length > 0 && (
            <div className="mt-6 rounded border border-amber/40 bg-amber-soft p-3 text-sm">
              <p className="font-medium">{plan.unmapped.length} SKUs with demand but no recipe — their green is not counted.</p>
              <p className="text-ink-2 mt-1">{plan.unmapped.map((u) => `${u.site_code} ${u.sku} (${kg(u.units)} units)`).join(" · ")}</p>
              <Link href="/reference" className="underline">Add recipes</Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

const Stat = ({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "ok" | "warn" }) => (
  <div className={`rounded border border-rule p-4 ${tone === "warn" ? "bg-amber-soft" : tone === "ok" ? "bg-green-soft" : "bg-paper-2"}`}>
    <p className="eyebrow">{label}</p>
    <p className="display text-2xl font-bold mt-1 num">{value}</p>
    {sub && <p className="text-xs text-ink-3 mt-1">{sub}</p>}
  </div>
);
