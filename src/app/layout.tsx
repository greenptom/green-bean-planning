import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getDataset } from "@/lib/data";
import { fmtAsOf, staleness } from "@/lib/format";

const FONTS = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap";

export const metadata: Metadata = {
  title: "Grind · Green Bean Planning",
  description: "Weekly demand-to-supply view of green coffee across the roastery and co-manufacturers.",
};

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/sites/RST", label: "Sites" },
  { href: "/coverage", label: "Coverage & buy list" },
  { href: "/scenario", label: "Scenario" },
  { href: "/flow", label: "Green → FG flow" },
  { href: "/uploads", label: "Uploads" },
  { href: "/reference", label: "Reference" },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const ds = await getDataset();
  const feeds: [string, string | null][] = [
    ["Demand", ds.asOf.demand],
    ["Cropster", ds.asOf.lots],
    ["Cin7 POs", ds.asOf.purchase_orders],
    ["Site reports", ds.asOf.site_stock_reports],
  ];
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONTS} />
      </head>
      <body className="min-h-full flex flex-col">
        <header className="border-b border-rule">
          <div className="mx-auto max-w-[1400px] px-6 py-4 flex flex-wrap items-baseline gap-x-8 gap-y-2">
            <Link href="/" className="display text-xl font-bold tracking-tight">
              Grind <span className="text-ink-3 font-medium">/</span> Green Bean Planning
            </Link>
            <nav className="flex flex-wrap gap-x-5 text-sm">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="text-ink-2 hover:text-ink">{n.label}</Link>
              ))}
            </nav>
            <div className="ml-auto flex gap-4 text-[11px] text-ink-3">
              {feeds.map(([k, v]) => {
                const st = staleness(v, ds.settings.stale_after_days);
                return (
                  <span key={k} className="flex items-center gap-1">
                    <span className={`inline-block h-2 w-2 rounded-full ${st === "ok" ? "bg-green" : st === "stale" ? "bg-amber" : "bg-red"}`} />
                    {k} {fmtAsOf(v)}
                  </span>
                );
              })}
              <span className="rounded border border-rule px-1.5">{ds.mode === "local" ? "seed mode" : "supabase"}</span>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] px-6 py-8 flex-1">{children}</main>
        <footer className="border-t border-rule text-[11px] text-ink-3 px-6 py-3 text-center">
          Every figure traces to an upload and an as-of date. Targets: {Math.round(ds.settings.coverage_target * 100)}% coverage · {ds.settings.container_kg.toLocaleString()} kg per container.
        </footer>
      </body>
    </html>
  );
}
