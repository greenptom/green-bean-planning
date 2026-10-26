import { getDataset } from "@/lib/data";
import { fmtAsOf } from "@/lib/format";
import { UploadForm } from "@/components/UploadForm";

const KINDS = [
  { kind: "forecast", title: "Forecast – All Channels (.xlsx)", who: "Ethan · Thursday", how: "Demand planning tool → Export → Forecast – All Channels. Locked beats Forecast when set. SKUs are routed to a site by recipe, else by SKU family." },
  { kind: "cropster_lots", title: "Cropster green inventory (.xls)", who: "Planner · Friday", how: "Cropster → Green inventory → Export (all columns). Contracted pseudo-locations become arrivals using Tracking # as the month." },
  { kind: "cin7_pos", title: "Cin7 purchase orders — GRN lines (.csv)", who: "Planner · Friday", how: "Cin7 → Purchase Orders → filter Product Ordered = GRN, Open → Actions → Export with line items. Only lines with an ETA/ETD become arrivals; lines already carried by a Cropster lot (same PO #) are skipped." },
  { kind: "cin7_production", title: "Cin7 production jobs (.csv)", who: "Planner · Friday", how: "Cin7 → Production Jobs → open jobs → export. Counted as production planned at the job's branch on its scheduled date." },
  { kind: "fg_stock", title: "Cin7 finished goods stock (.csv)", who: "Planner · Friday", how: "Cin7 → Products → stock export by branch. Shown per site for context; not used in green coverage." },
] as const;

export default async function UploadsPage() {
  const ds = await getDataset();
  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow">Every number in the tool comes from one of these files, stamped with its as-of date</p>
        <h1 className="text-3xl font-bold mt-1">Weekly uploads</h1>
        {ds.mode === "local" && <p className="mt-2 text-sm rounded border border-amber/40 bg-amber-soft p-3">Running in seed mode (no Supabase configured). Uploads are parsed and previewed but not saved. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to persist.</p>}
      </header>
      <div className="grid md:grid-cols-2 gap-6">
        {KINDS.map((k) => (
          <section key={k.kind} className="rounded border border-rule p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-bold">{k.title}</h2>
              <span className="text-xs text-ink-3">{k.who}</span>
            </div>
            <p className="text-xs text-ink-2 mt-1">{k.how}</p>
            <p className="text-xs text-ink-3 mt-1">Latest: {fmtAsOf(ds.asOf[{ forecast: "demand", cropster_lots: "lots", cin7_pos: "purchase_orders", cin7_production: "production_jobs", fg_stock: "fg_stock" }[k.kind]])}</p>
            <UploadForm kind={k.kind} />
          </section>
        ))}
      </div>
    </div>
  );
}
