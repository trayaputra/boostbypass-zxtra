import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, Boxes, CheckCircle2, Clock, Power, XCircle } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { adminStats } from "@/lib/admin.functions";
import { PageHeader, StatusBadge, fmtDate } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/")({ component: Dashboard });

function Dashboard() {
  const fn = useServerFn(adminStats);
  const { data, isLoading, error } = useQuery({ queryKey: ["admin", "stats"], queryFn: () => fn() });
  const s = data;
  const tiles = [
    { label: "Total provider", value: s?.totalProviders, icon: Boxes, tone: "violet" },
    { label: "Provider aktif", value: s?.activeProviders, icon: Power, tone: "emerald" },
    { label: "Total request", value: s?.totalRequests, icon: Activity, tone: "cyan" },
    { label: "Berhasil", value: s?.successRequests, icon: CheckCircle2, tone: "emerald" },
    { label: "Gagal", value: s?.failedRequests, icon: XCircle, tone: "pink" },
    { label: "Rata-rata (14 hari)", value: s ? `${s.avgResponseMs} ms` : undefined, icon: Clock, tone: "orange" },
  ];
  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle="Statistik nyata dari database." />
      {error && <p className="text-sm text-pink">Gagal memuat statistik.</p>}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className={`tile3d tone-${t.tone} p-4`}>
            <span className="tone-icon h-9 w-9"><t.icon className="h-4 w-4" /></span>
            <div className="mt-3 font-display text-2xl font-extrabold tabular-nums sm:text-3xl">
              {isLoading ? "—" : t.value ?? 0}
            </div>
            <div className="text-xs text-muted-foreground">{t.label}</div>
          </div>
        ))}
      </div>
      <div className="card3d p-4 sm:p-6">
        <h2 className="font-bold">Aktivitas 14 hari</h2>
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={(s?.daily ?? []).map((d) => ({ ...d, label: d.date.slice(5) }))}>
              <XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip cursor={{ fill: "oklch(1 0 0 / 0.04)" }} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }} />
              <Bar dataKey="success" stackId="a" fill="var(--emerald)" name="Berhasil" />
              <Bar dataKey="failed" stackId="a" fill="var(--pink)" name="Gagal" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="card3d p-4 sm:p-6">
        <h2 className="font-bold">Request terbaru</h2>
        {s && s.recent.length === 0 && <p className="mt-3 text-sm text-muted-foreground">Belum ada request.</p>}
        <ul className="mt-3 divide-y divide-border">
          {s?.recent.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <span className="font-semibold">{r.provider_slug}</span>
              <StatusBadge status={r.status} code={r.error_code} />
              <span className="text-muted-foreground">{r.execution_time_ms ?? "-"} ms</span>
              <span className="text-xs text-muted-foreground">{fmtDate(r.created_at)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
