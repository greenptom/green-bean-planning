import type { WeekRow } from "@/lib/engine/plan";
import { fmtWeek, isoWeekNumber } from "@/lib/engine/weeks";
import { kg } from "@/lib/format";

/**
 * Ash's "Green Bean" tab layout: weeks across, the five planning rows down.
 * Opening · Fcst use · Arrivals · Closing · Weeks cover. Arrivals carry their reference on hover.
 */
export const DrawdownTable = ({ rows }: { rows: WeekRow[] }) => {
  const lines: { label: string; get: (r: WeekRow) => number | null; cls?: (v: number | null, r: WeekRow) => string; title?: (r: WeekRow) => string }[] = [
    { label: "Opening", get: (r) => r.opening },
    { label: "Fcst use", get: (r) => r.demand },
    { label: "Arrivals", get: (r) => r.arrivals, cls: (v) => (v ? "text-green font-medium" : "text-ink-3"), title: (r) => r.arrivalRefs.map((a) => `${a.ref} ${kg(a.kg)} kg — ${a.detail}${a.priced ? "" : " (unpriced)"}`).join("\n") },
    { label: "Closing", get: (r) => r.closing, cls: (v) => (v !== null && v < 0 ? "neg font-medium" : "") },
    { label: "Weeks cover", get: (r) => r.weeks_cover, cls: (v) => (v === null ? "text-ink-3" : v < 2 ? "neg" : v < 4 ? "text-amber" : "") },
  ];
  return (
    <div className="overflow-x-auto rounded border border-rule">
      <table className="plan text-xs">
        <thead>
          <tr>
            <th className="sticky-col text-left">w/c</th>
            {rows.map((r) => <th key={r.week} className="num">{fmtWeek(r.week)}<br /><span className="text-ink-3 font-normal">wk {isoWeekNumber(r.week)}</span></th>)}
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.label}>
              <td className="sticky-col font-medium">{l.label}</td>
              {rows.map((r) => {
                const v = l.get(r);
                return (
                  <td key={r.week} className={`num ${l.cls?.(v, r) ?? ""}`} title={l.title?.(r)}>
                    {v === null ? "—" : l.label === "Weeks cover" ? v.toFixed(1) : kg(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
