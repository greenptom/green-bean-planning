"use client";
import { useEffect, useState } from "react";
import type { Drawdown } from "@/lib/engine/plan";
import { DrawdownTable } from "./DrawdownTable";
import { fmtWeek, addWeeks } from "@/lib/engine/weeks";
import { kg } from "@/lib/format";

type Buy = { origin_code: string; site_code: string; land_week: string; kg: number; note?: string };
type Opt = { code: string; name: string };

export const ScenarioWorkbench = ({ origins, sites, containerKg, defaultWeek }: { origins: Opt[]; sites: Opt[]; containerKg: number; defaultWeek: string }) => {
  const [origin, setOrigin] = useState(origins[0]?.code ?? "BR");
  const [site, setSite] = useState("ALL");
  const [weeks, setWeeks] = useState(26);
  const [buys, setBuys] = useState<Buy[]>([]);
  const [draft, setDraft] = useState<Buy>({ origin_code: origins[0]?.code ?? "BR", site_code: "ALL", land_week: addWeeks(defaultWeek, 8), kg: containerKg });
  const [result, setResult] = useState<{ base: Drawdown; scenario: Drawdown } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/scenario", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ origin_code: origin, site_code: site, weeks, buys }) })
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setResult(j); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [origin, site, weeks, buys]);

  const sel = "rounded border border-rule bg-paper px-2 py-1 text-sm";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs">Origin<br /><select className={sel} value={origin} onChange={(e) => setOrigin(e.target.value)}>{origins.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}</select></label>
        <label className="text-xs">Site<br /><select className={sel} value={site} onChange={(e) => setSite(e.target.value)}>{sites.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}</select></label>
        <label className="text-xs">Weeks<br /><select className={sel} value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>{[13, 26, 39, 52].map((w) => <option key={w} value={w}>{w}</option>)}</select></label>
        <span className="text-xs text-ink-3 self-center">{loading ? "recalculating…" : result ? `stock-out ${result.base.stockout_week ? `w/c ${fmtWeek(result.base.stockout_week)}` : "none"} → ${result.scenario.stockout_week ? `w/c ${fmtWeek(result.scenario.stockout_week)}` : "none"}` : ""}</span>
      </div>

      <div className="rounded border border-rule p-4 grid md:grid-cols-[1fr_1fr] gap-6">
        <div>
          <p className="eyebrow mb-2">Add a buy</p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs">Origin<br /><select className={sel} value={draft.origin_code} onChange={(e) => setDraft({ ...draft, origin_code: e.target.value })}>{origins.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}</select></label>
            <label className="text-xs">For site<br /><select className={sel} value={draft.site_code} onChange={(e) => setDraft({ ...draft, site_code: e.target.value })}>{sites.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}</select></label>
            <label className="text-xs">Lands w/c<br /><input type="date" className={sel} value={draft.land_week} onChange={(e) => setDraft({ ...draft, land_week: e.target.value })} /></label>
            <label className="text-xs">Containers<br /><input type="number" min={1} className={`${sel} w-20`} value={Math.round(draft.kg / containerKg)} onChange={(e) => setDraft({ ...draft, kg: Number(e.target.value) * containerKg })} /></label>
            <label className="text-xs">Note<br /><input className={sel} placeholder="e.g. Cocatrel May 27 GTC 260" value={draft.note ?? ""} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></label>
            <button type="button" className="rounded bg-ink text-paper px-3 py-1.5 text-sm" onClick={() => setBuys([...buys, draft])}>Add {kg(draft.kg)} kg</button>
          </div>
        </div>
        <div>
          <p className="eyebrow mb-2">Scenario buys ({buys.length})</p>
          {buys.length === 0 ? <p className="text-sm text-ink-3">None yet.</p> : (
            <ul className="text-sm space-y-1">
              {buys.map((b, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className="font-mono text-xs">{b.origin_code}</span><span>{b.site_code}</span><span>w/c {fmtWeek(b.land_week)}</span><span className="num">{kg(b.kg)} kg</span><span className="text-ink-3">{b.note}</span>
                  <button type="button" className="text-xs underline text-ink-3" onClick={() => setBuys(buys.filter((_, j) => j !== i))}>remove</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {result && (
        <>
          <section>
            <h2 className="text-lg font-bold mb-2">Base — contracted lots and open POs only</h2>
            <DrawdownTable rows={result.base.rows} />
          </section>
          <section>
            <h2 className="text-lg font-bold mb-2">With scenario buys</h2>
            <DrawdownTable rows={result.scenario.rows} />
          </section>
        </>
      )}
    </div>
  );
};
