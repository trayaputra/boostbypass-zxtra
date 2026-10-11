import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getBranding, DEFAULT_BRANDING, type Branding } from "@/lib/public.functions";
import { Logo } from "@/components/ProviderIcon";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound } from "lucide-react";
import { adminKeyStatus, adminSaveBranding } from "@/lib/admin.functions";
import { PageHeader } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/settings")({ component: SettingsPage });

function SettingsPage() {
  const fn = useServerFn(adminKeyStatus);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "key"], queryFn: () => fn() });
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Logo dan API key global." />
      <BrandingCard />
      <div className="card3d p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="tone-violet tone-icon h-11 w-11"><KeyRound className="h-5 w-5" /></span>
          <div>
            <div className="font-display font-bold">BYPASS_API_KEY</div>
            <div className="text-xs text-muted-foreground">Satu key global untuk semua provider</div>
          </div>
          <span className={`badge ml-auto ${isLoading ? "badge-muted" : data?.configured ? "badge-success" : "badge-error"}`}>
            {isLoading ? "Memeriksa" : data?.configured ? "Configured" : "Missing"}
          </span>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Key disimpan sebagai secret di server dan tidak pernah dikirim ke browser, ditampilkan, atau dicatat di log.
          Panel ini tidak bisa mengubah key secara langsung.
        </p>
        <div className="mt-4 rounded-xl bg-ink p-4 text-sm">
          <div className="label3d mb-2">Cara mengganti key</div>
          <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>Buka pengaturan proyek di Lovable → Cloud → Secrets.</li>
            <li>Perbarui nilai <code className="text-cyan">BYPASS_API_KEY</code>.</li>
            <li>Publish ulang aplikasi agar versi live memakai key baru.</li>
            <li>Gunakan TEST ENDPOINT di halaman Providers untuk memastikan.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

function BrandingCard() {
  const qc = useQueryClient();
  const get = useServerFn(getBranding);
  const save = useServerFn(adminSaveBranding);
  const { data } = useQuery({ queryKey: ["branding"], queryFn: () => get() });
  const [b, setB] = useState<Branding>(DEFAULT_BRANDING);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setB(data); }, [data]);
  const set = (k: keyof Branding, v: string) => setB((x) => ({ ...x, [k]: v }));
  const onSave = async () => {
    setBusy(true);
    try {
      await save({ data: b });
      qc.setQueryData(["branding"], b);
      toast.success("Logo disimpan");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan logo");
    } finally { setBusy(false); }
  };
  const preview = b.mode === "image" && b.imageUrl ? (
    <img src={b.imageUrl} alt="Pratinjau" className="h-16 w-16 rounded-xl object-cover" />
  ) : (
    <span className="font-display inline-flex h-16 w-16 items-center justify-center rounded-xl text-3xl font-extrabold text-ink"
      style={{ background: `linear-gradient(135deg, ${b.from}, ${b.to})` }}>{b.letter || "?"}</span>
  );
  return (
    <div className="card3d p-5 sm:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Logo size={44} />
        <div>
          <div className="font-display font-bold">Logo Header</div>
          <div className="text-xs text-muted-foreground">Tampil di halaman utama, login, dan panel admin</div>
        </div>
      </div>
      <div className="flex gap-2">
        {(["letter", "image"] as const).map((m) => (
          <button key={m} type="button" onClick={() => set("mode", m)}
            className={`badge ${b.mode === m ? "badge-success" : "badge-muted"}`}>
            {m === "letter" ? "Huruf" : "Gambar"}
          </button>
        ))}
      </div>
      {b.mode === "letter" ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block"><span className="label3d">Huruf (maks 2)</span>
            <input className="input3d mt-1" maxLength={2} value={b.letter} onChange={(e) => set("letter", e.target.value)} /></label>
          <label className="block"><span className="label3d">Warna awal</span>
            <input type="color" className="mt-1 h-12 w-full rounded-xl bg-ink" value={b.from} onChange={(e) => set("from", e.target.value)} /></label>
          <label className="block"><span className="label3d">Warna akhir</span>
            <input type="color" className="mt-1 h-12 w-full rounded-xl bg-ink" value={b.to} onChange={(e) => set("to", e.target.value)} /></label>
        </div>
      ) : (
        <label className="block"><span className="label3d">URL gambar (https)</span>
          <input className="input3d mt-1" placeholder="https://i.ibb.co/xxxx/logo.png" value={b.imageUrl}
            onChange={(e) => set("imageUrl", e.target.value.trim())} /></label>
      )}
      <div className="flex items-center gap-4">
        {preview}
        <button type="button" disabled={busy} onClick={onSave} className="btn3d btn-admin ml-auto">
          {busy ? "MENYIMPAN..." : "SIMPAN LOGO"}
        </button>
      </div>
    </div>
  );
}
