import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { adminClearLogs, adminListProviders, adminLogs } from "@/lib/admin.functions";
import { PageHeader, StatusBadge, fmtDate } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/logs")({ component: LogsPage });

function LogsPage() {
  const [page, setPage] = useState(1);
  const [provider, setProvider] = useState("");
  const [status, setStatus] = useState<"" | "success" | "failed">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [days, setDays] = useState(30);
  const fn = useServerFn(adminLogs);
  const listP = useServerFn(adminListProviders);
  const clear = useServerFn(adminClearLogs);
  const qc = useQueryClient();
  const filters = { page, provider: provider || undefined, status: status || undefined, from: from || undefined, to: to || undefined };
  const { data, isFetching } = useQuery({ queryKey: ["admin", "logs", filters], queryFn: () => fn({ data: filters }), placeholderData: keepPreviousData });
  const { data: providers } = useQuery({ queryKey: ["admin", "providers"], queryFn: () => listP() });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const doClear = async () => {
    if (!window.confirm(`Hapus log yang lebih lama dari ${days} hari?`)) return;
    const r = await clear({ data: { olderThanDays: days } });
    toast.success(`${r.deleted} log dihapus.`);
    qc.invalidateQueries({ queryKey: ["admin"] });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Logs" subtitle="Hanya hostname dan metadata yang dicatat." />
      <div className="card3d grid gap-3 p-4 sm:grid-cols-4">
        <select className="input3d" value={provider} onChange={(e) => { setProvider(e.target.value); setPage(1); }} aria-label="Provider">
          <option value="">Semua provider</option>
          {providers?.map((p) => <option key={p.id} value={p.slug}>{p.name}</option>)}
        </select>
        <select className="input3d" value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setPage(1); }} aria-label="Status">
          <option value="">Semua status</option>
          <option value="success">Berhasil</option>
          <option value="failed">Gagal</option>
        </select>
        <input type="date" className="input3d" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} aria-label="Dari tanggal" />
        <input type="date" className="input3d" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} aria-label="Sampai tanggal" />
      </div>

      <div className={`card3d p-2 sm:p-4 ${isFetching ? "opacity-80" : ""}`}>
        {data && data.rows.length === 0 && <p className="p-4 text-sm text-muted-foreground">Tidak ada log.</p>}
        <div className="hidden grid-cols-[1.3fr_1fr_1fr_0.8fr_1.3fr] gap-3 px-3 py-2 text-xs text-muted-foreground md:grid">
          <span>Waktu</span><span>Provider</span><span>Status</span><span>Durasi</span><span>Host input</span>
        </div>
        <ul className="divide-y divide-border">
          {data?.rows.map((r) => (
            <li key={r.id} className="grid grid-cols-2 gap-2 px-3 py-3 text-sm md:grid-cols-[1.3fr_1fr_1fr_0.8fr_1.3fr] md:items-center">
              <span className="text-xs text-muted-foreground">{fmtDate(r.created_at)}</span>
              <span className="font-semibold">{r.provider_slug}</span>
              <span><StatusBadge status={r.status} code={r.error_code} /></span>
              <span className="tabular-nums">{r.execution_time_ms ?? "-"} ms</span>
              <span className="url-text col-span-2 text-muted-foreground md:col-span-1">{r.input_host ?? "-"}</span>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between gap-2 p-3">
          <button className="btn3d btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹ PREV</button>
          <span className="text-xs text-muted-foreground">Hal {page} / {pages} · {data?.total ?? 0} log</span>
          <button className="btn3d btn-ghost btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>NEXT ›</button>
        </div>
      </div>

      <div className="card3d flex flex-wrap items-end gap-3 p-4">
        <label className="block">
          <span className="label3d mb-1.5 block">Hapus log lebih lama dari (hari)</span>
          <input type="number" min={0} max={3650} className="input3d w-32" value={days} onChange={(e) => setDays(Number(e.target.value))} />
        </label>
        <button className="btn3d btn-danger" onClick={doClear}><Trash2 className="h-4 w-4" /> BERSIHKAN LOG</button>
        <p className="w-full text-xs text-muted-foreground">Retensi yang disarankan: 30 hari.</p>
      </div>
    </div>
  );
}
