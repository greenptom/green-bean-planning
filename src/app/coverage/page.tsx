import { getDataset } from "@/lib/data";
import { buildPlan, coverage } from "@/lib/engine/plan";
import { fmtWeek, addWeeks } from "@/lib/engine/weeks";
import { kg, pct, tonnes, fmtAsOf } from "@/lib/format";
import { CopyBlock } from "@/components/CopyBlock";

/** The screen that replaces the 23 Sep 2026 screenshot to Howey. */
export default async function CoveragePage() {
  const ds = await getDataset();
  const plan = buildPlan(ds);
  const sites = ds.sites.filter((s) => s.active);
  const grid = plan.origins.map((o) => ({
    origin: o,
    all: coverage(ds, plan.green, "ALL", o.code),
    perSite: sites.map((s) => coverage(ds, plan.green, s.code, o.code)),
  })).filter((g) => g.all.demand_52w > 0 || g.all.on_hand + g.all.contracted > 0);

  const buyList = grid.filter((g) => g.all.containers > 0).map((g) => {
    // need-by: the first week closing drops below the target cover, i.e. the stock-out week less 6 weeks shipping, floored at next week
    const needBy = g.all.stockout_week ? addWeeks(g.all.stockout_week, -6) : null;
    return { origin: g.origin.name, containers: g.all.containers, gap: g.all.gap_kg, cover: g.all.coverage, needBy, sites: g.perSite.filter((p) => p.containers > 0).map((p) => `${p.site_code} ${p.containers}`).join(", ") };
  });

  const post = [
    `Green bean position — w/c ${fmtWeek(plan.horizonStart)} (demand ${fmtAsOf(ds.asOf.demand)}, Cropster ${fmtAsOf(ds.asOf.lots)})`,
    ...grid.map((g) => `• ${g.origin.name}: ${pct(g.all.coverage)} covered (${tonnes(g.all.on_hand + g.all.contracted)} of ${tonnes(g.all.demand_52w)})${g.all.stockout_week ? ` — runs out w/c ${fmtWeek(g.all.stockout_week)}` : ""}`),
    buyList.length ? `To buy for ${pct(ds.settings.coverage_target)}: ${buyList.map((b) => `${b.containers}× ${b.origin}${b.needBy ? ` by w/c ${fmtWeek(b.needBy)}` : ""}`).join(", ")}` : `No purchases needed to hold ${pct(ds.settings.coverage_target)}.`,
  ].join("\n");

  return (
    <div className="space-y-10">
      <header>
        <p className="eyebrow">Target {pct(ds.settings.coverage_target)} · tolerance {pct(ds.settings.coverage_tolerance[0])}–{pct(ds.settings.coverage_tolerance[1])} · {ds.settings.container_kg.toLocaleString()} kg per container</p>
        <h1 className="text-3xl font-bold mt-1">Coverage and buy list</h1>
      </header>

      <section>
        <h2 className="text-lg font-bold mb-3">Coverage grid — origin × site</h2>
        <p className="text-sm text-ink-2 mb-3">Each cell: (on hand + contracted earmarked for the site) ÷ 52-week demand at that site. Contracted lots are earmarked by the Cropster Project field, then by name hints (UM / HACO / BA), else the roastery.</p>
        <table className="plan w-full text-sm">
          <thead><tr><th className="text-left">Origin</th><th className="num">All sites</th>{sites.map((s) => <th key={s.code} className="num">{s.code}</th>)}<th className="num">Gap kg</th><th className="num">Containers</th></tr></thead>
          <tbody>
            {grid.map((g) => (
              <tr key={g.origin.code}>
                <td className="font-medium">{g.origin.name}</td>
                <Cell c={g.all.coverage} lo={ds.settings.coverage_tolerance[0]} hi={ds.settings.coverage_tolerance[1]} title={`${kg(g.all.on_hand + g.all.contracted)} / ${kg(g.all.demand_52w)} kg`} />
                {g.perSite.map((p) => <Cell key={p.site_code} c={p.demand_52w ? p.coverage : null} lo={ds.settings.coverage_tolerance[0]} hi={ds.settings.coverage_tolerance[1]} title={`${kg(p.on_hand + p.contracted)} / ${kg(p.demand_52w)} kg`} />)}
                <td className="num">{kg(g.all.gap_kg)}</td><td className="num font-medium">{g.all.containers || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="grid md:grid-cols-2 gap-10">
        <div>
          <h2 className="text-lg font-bold mb-3">Buy list for Howey</h2>
          {buyList.length ? (
            <table className="plan w-full text-sm">
              <thead><tr><th className="text-left">Origin</th><th className="num">Containers</th><th className="num">Gap kg</th><th className="num">Cover now</th><th className="text-left">Need landed by</th><th className="text-left">Split</th></tr></thead>
              <tbody>{buyList.map((b) => <tr key={b.origin}><td className="font-medium">{b.origin}</td><td className="num">{b.containers}</td><td className="num">{kg(b.gap)}</td><td className="num">{pct(b.cover)}</td><td>{b.needBy ? `w/c ${fmtWeek(b.needBy)}` : "no stock-out in 52 wks"}</td><td className="text-ink-2">{b.sites || "—"}</td></tr>)}</tbody>
            </table>
          ) : <p className="text-sm text-ink-2">Nothing to buy to hold the target.</p>}
          <p className="text-xs text-ink-3 mt-2">Need-by = first stock-out week less 6 weeks for shipping and release. Adjust in settings once Tamas confirms lead times by supplier.</p>
        </div>
        <div>
          <h2 className="text-lg font-bold mb-3">Monday post for #proj-coffee-buying</h2>
          <CopyBlock text={post} />
        </div>
      </section>
    </div>
  );
}

const Cell = ({ c, lo, hi, title }: { c: number | null; lo: number; hi: number; title: string }) => (
  <td className={`num ${c === null ? "text-ink-3" : c < lo ? "bg-red-soft text-red" : c > hi ? "bg-green-soft" : "bg-amber-soft"}`} title={title}>{pct(c)}</td>
);
