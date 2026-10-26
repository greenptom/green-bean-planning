import { getDataset } from "@/lib/data";

export default async function ReferencePage() {
  const ds = await getDataset();
  const bySite = ds.sites.filter((s) => s.active).map((s) => ({ site: s, recipes: ds.recipes.filter((r) => r.site_code === s.code) }));
  return (
    <div className="space-y-10">
      <header>
        <p className="eyebrow">Seeded from Ash's Green Bean Supply Plan 2026 (recipe tabs) and the 26 Oct 2026 Cropster walkthrough · edit via a migration or the Supabase table editor</p>
        <h1 className="text-3xl font-bold mt-1">Reference data</h1>
      </header>

      <section>
        <h2 className="text-lg font-bold mb-3">Sites</h2>
        <table className="plan w-full text-sm">
          <thead><tr><th className="text-left">Code</th><th className="text-left">Name</th><th className="text-left">Role</th><th className="text-left">Stock source</th><th className="text-left">Cropster location</th><th className="text-left">Cin7 branch</th><th className="num">Green factor</th></tr></thead>
          <tbody>{ds.sites.map((s) => <tr key={s.code}><td className="font-mono">{s.code}</td><td>{s.name}</td><td>{s.role}</td><td>{s.stock_source}</td><td>{s.cropster_location ?? "—"}</td><td>{s.cin7_branch ?? "—"}</td><td className="num">×{s.green_conversion_factor}</td></tr>)}</tbody>
        </table>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-3">Cropster locations → planning meaning</h2>
        <table className="plan w-full text-sm">
          <thead><tr><th className="text-left">Cropster name</th><th className="text-left">Kind</th><th className="text-left">Site</th><th className="text-left">Fixing status</th></tr></thead>
          <tbody>{ds.locations.map((l) => <tr key={l.code}><td>{l.cropster_name ?? <span className="text-ink-3">(not in Cropster)</span>}</td><td>{l.kind}</td><td className="font-mono">{l.site_code}</td><td>{l.fixing_status ?? "—"}</td></tr>)}</tbody>
        </table>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-3">Blend designations (Cropster “Project”) → origin</h2>
        <table className="plan w-full text-sm">
          <thead><tr><th className="text-left">Project value</th><th className="text-left">Origin</th><th className="text-left">Site</th><th className="text-left">Note</th></tr></thead>
          <tbody>{ds.blendDesignations.map((b) => <tr key={b.name}><td>{b.name}</td><td className="font-mono">{b.origin_code}</td><td className="font-mono">{b.site_code}</td><td className="text-ink-2">{b.note}</td></tr>)}</tbody>
        </table>
      </section>

      {bySite.map(({ site, recipes }) => (
        <section key={site.code}>
          <h2 className="text-lg font-bold mb-3">Recipes — {site.name} ({recipes.length} rows)</h2>
          <div className="max-h-96 overflow-auto rounded border border-rule">
            <table className="plan w-full text-xs">
              <thead><tr><th className="text-left">SKU</th><th className="text-left">Origin</th><th className="num">Qty</th><th className="text-left">Unit</th><th className="text-left">Source</th></tr></thead>
              <tbody>{recipes.map((r, i) => <tr key={i}><td className="font-mono">{r.sku}</td><td className="font-mono">{r.origin_code}</td><td className="num">{r.qty}</td><td>{r.unit_kind}</td><td className="text-ink-3">{r.source}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
