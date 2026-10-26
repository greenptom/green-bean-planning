import { getDataset } from "@/lib/data";
import { buildPlan } from "@/lib/engine/plan";
import { ScenarioWorkbench } from "@/components/ScenarioWorkbench";

/** Ash's "Scenario Buy" row, as a workbench: add containers landing in a week and watch Weeks Cover respond. */
export default async function ScenarioPage() {
  const ds = await getDataset();
  const plan = buildPlan(ds);
  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">What-if · adds arrivals on top of contracted lots and open POs · nothing is saved until you choose to</p>
        <h1 className="text-3xl font-bold mt-1">Scenario buys</h1>
      </header>
      <ScenarioWorkbench
        origins={plan.origins.map((o) => ({ code: o.code, name: o.name }))}
        sites={[{ code: "ALL", name: "All sites" }, ...ds.sites.filter((s) => s.active).map((s) => ({ code: s.code, name: s.name }))]}
        containerKg={ds.settings.container_kg}
        defaultWeek={plan.horizonStart}
      />
    </div>
  );
}
