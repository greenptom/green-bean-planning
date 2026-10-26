import { SITE_FLOWS } from "@/lib/flow";
import { getDataset } from "@/lib/data";

export default async function FlowPage() {
  const ds = await getDataset();
  return (
    <div className="space-y-10">
      <header>
        <p className="eyebrow">The logic the planner reasons with · one lane per manufacturer</p>
        <h1 className="text-3xl font-bold mt-1">How green becomes finished goods</h1>
        <p className="text-sm text-ink-2 mt-2 max-w-3xl">Grind buys all green centrally (Howey contracts in 20 t containers against the C market). From there each site transforms it differently, and that transformation sets the recipe unit and the conversion the tool applies before it counts coverage.</p>
      </header>

      <div className="grid gap-6">
        {SITE_FLOWS.map((f) => {
          const site = ds.sites.find((s) => s.code === f.site);
          return (
            <section key={f.site} className="rounded border border-rule overflow-hidden">
              <div className="bg-paper-2 px-5 py-3 flex flex-wrap items-baseline gap-4">
                <h2 className="text-lg font-bold">{f.title}</h2>
                <span className="text-xs text-ink-3">conversion factor ×{site?.green_conversion_factor ?? 1} · stock via {site?.stock_source}</span>
              </div>
              <div className="px-5 py-4">
                <p className="text-sm text-ink-2 mb-4">{f.summary}</p>
                <ol className="grid md:grid-cols-6 gap-3">
                  {f.stages.map((s, i) => (
                    <li key={s.label} className="rounded border border-rule p-3 text-xs flex flex-col gap-1 relative">
                      <span className="eyebrow">{i + 1} · {s.label}</span>
                      <span className="font-medium">{s.where}</span>
                      <span className="text-ink-2">{s.what}</span>
                      {s.conversion && <span className="text-green">{s.conversion}</span>}
                      {(s.system || s.owner) && <span className="text-ink-3 mt-auto">{[s.system, s.owner].filter(Boolean).join(" · ")}</span>}
                    </li>
                  ))}
                </ol>
                {f.caveats.length > 0 && (
                  <ul className="mt-4 text-xs text-ink-2 list-disc pl-5 space-y-1">{f.caveats.map((c) => <li key={c}>{c}</li>)}</ul>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <section className="rounded border border-rule p-5 text-sm">
        <h2 className="text-lg font-bold mb-2">Recipe units, in one place</h2>
        <table className="plan text-sm">
          <thead><tr><th className="text-left">Site</th><th className="text-left">Recipe unit</th><th className="text-left">Applied conversion</th><th className="text-left">Example</th></tr></thead>
          <tbody>
            <tr><td>RST</td><td>g green per unit</td><td>none</td><td>200g bag = 235.2 g green (≈15% roast loss)</td></tr>
            <tr><td>UM</td><td>g green per box</td><td>none (shares already × box base)</td><td>House 10-pod box = 42.84 g BR + 18.36 g GT</td></tr>
            <tr><td>HAC</td><td>g green per unit incl. micro-ground</td><td>none; SF stock ÷ 0.38 to green-equivalent</td><td>CRAFT-INSTANT = 245.03 g</td></tr>
            <tr><td>MUN</td><td>g instant per can</td><td>× 3.0 → green (unconfirmed)</td><td>COLDBREW-FW = 2.5 g instant → 7.5 g green</td></tr>
            <tr><td>CRL</td><td>g coffee per can</td><td>× 1.18 roasted → green (to confirm)</td><td>COLDBREW-FW = 15.9 g → 18.8 g green</td></tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
