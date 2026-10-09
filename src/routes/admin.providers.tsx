import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, FlaskConical, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  adminDeleteProvider, adminListProviders, adminMoveProvider, adminSaveProvider, adminTestProvider, adminToggleProvider,
  type ProviderInput,
} from "@/lib/admin.functions";
import { THEME_COLORS, THEME_ICONS } from "@/lib/url";
import { ProviderIcon } from "@/components/ProviderIcon";
import { PageHeader, Toggle, fmtDate } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/providers")({ component: ProvidersPage });

type Row = Awaited<ReturnType<typeof adminListProviders>>[number];

const EMPTY: ProviderInput = {
  name: "", slug: "", description: "", endpoint_url: "https://", method: "GET", headers_config: {},
  auth_mode: "header", auth_header: "x-apikey", input_parameter: "url",
  response_mapping: { successPath: "status", destinationPath: "bypassed_url", originalPath: "original_url", creatorPath: "creator", executionTimePath: "execution_time_ms", errorPath: "message" },
  timeout_ms: 20000, enabled: false, theme_config: { color: "cyan", icon: "zap" },
};

function rowToInput(r: Row): ProviderInput {
  const t = (r.theme_config ?? {}) as ProviderInput["theme_config"];
  return {
    name: r.name, slug: r.slug, description: r.description, endpoint_url: r.endpoint_url,
    method: r.method === "POST" ? "POST" : "GET",
    headers_config: (r.headers_config ?? {}) as Record<string, string>,
    auth_mode: (["header", "bearer", "query", "none"].includes(r.auth_mode) ? r.auth_mode : "header") as ProviderInput["auth_mode"],
    auth_header: r.auth_header, input_parameter: r.input_parameter,
    response_mapping: { ...EMPTY.response_mapping, ...((r.response_mapping ?? {}) as object) } as ProviderInput["response_mapping"],
    timeout_ms: r.timeout_ms, enabled: r.enabled,
    theme_config: { color: t.color ?? "cyan", icon: t.icon ?? "zap" },
  };
}

function ProvidersPage() {
  const qc = useQueryClient();
  const list = useServerFn(adminListProviders);
  const toggle = useServerFn(adminToggleProvider);
  const del = useServerFn(adminDeleteProvider);
  const move = useServerFn(adminMoveProvider);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "providers"], queryFn: () => list() });
  const [editing, setEditing] = useState<{ id?: string; input: ProviderInput } | null>(null);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin"] });
    qc.invalidateQueries({ queryKey: ["providers"] });
  };
  const toggleM = useMutation({ mutationFn: (v: { id: string; enabled: boolean }) => toggle({ data: v }), onSuccess: refresh });
  const moveM = useMutation({ mutationFn: (v: { id: string; direction: "up" | "down" }) => move({ data: v }), onSuccess: refresh });
  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Provider dihapus."); refresh(); },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Providers"
        subtitle="Semua provider memakai satu API key global."
        action={
          <button className="btn3d btn-admin" onClick={() => setEditing({ input: { ...EMPTY } })}>
            <Plus className="h-4 w-4" /> TAMBAH PROVIDER
          </button>
        }
      />
      {isLoading && <p className="text-sm text-muted-foreground">Memuat...</p>}
      {data && data.length === 0 && <div className="card3d p-6 text-sm text-muted-foreground">Belum ada provider.</div>}
      <div className="grid gap-4 xl:grid-cols-2">
        {data?.map((p, i) => {
          const t = (p.theme_config ?? {}) as { color?: string; icon?: string };
          const ok = p.last_test_status === "Connection successful";
          return (
            <div key={p.id} className={`tile3d tone-${t.color ?? "cyan"} p-4 sm:p-5`}>
              <div className="flex items-start gap-3">
                <span className="tone-icon h-11 w-11 shrink-0"><ProviderIcon icon={t.icon ?? "zap"} className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-lg font-bold">{p.name}</span>
                    <span className="badge badge-muted">{p.slug}</span>
                    <span className={`badge ${p.enabled ? "badge-success" : "badge-warn"}`}>{p.enabled ? "Aktif" : "Nonaktif"}</span>
                  </div>
                  <p className="url-text mt-1 text-muted-foreground">{p.method} {p.endpoint_url}</p>
                </div>
                <Toggle checked={p.enabled} label="Aktifkan provider" disabled={toggleM.isPending} onChange={(v) => toggleM.mutate({ id: p.id, enabled: v })} />
              </div>
              <div className="mt-3 rounded-xl bg-ink p-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground">Test terakhir:</span>
                  <span>{fmtDate(p.last_test_at)}</span>
                  {p.last_test_status && <span className={`badge ${ok ? "badge-success" : "badge-error"}`}>{p.last_test_status}</span>}
                </div>
                {p.last_test_error && <p className="mt-1 text-pink">{p.last_test_error}</p>}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn3d btn-sm" onClick={() => setEditing({ id: p.id, input: rowToInput(p) })}><Pencil className="h-3.5 w-3.5" /> EDIT</button>
                <button className="btn3d btn-ghost btn-icon" disabled={i === 0} onClick={() => moveM.mutate({ id: p.id, direction: "up" })} aria-label="Naikkan"><ArrowUp className="h-4 w-4" /></button>
                <button className="btn3d btn-ghost btn-icon" disabled={i === data.length - 1} onClick={() => moveM.mutate({ id: p.id, direction: "down" })} aria-label="Turunkan"><ArrowDown className="h-4 w-4" /></button>
                <button
                  className="btn3d btn-danger btn-sm ml-auto"
                  onClick={() => { if (window.confirm(`Hapus provider ${p.name}?`)) delM.mutate(p.id); }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> HAPUS
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {editing && <ProviderModal initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
    </div>
  );
}

type TestResult = Awaited<ReturnType<typeof adminTestProvider>>;

function ProviderModal({ initial, onClose, onSaved }: { initial: { id?: string; input: ProviderInput }; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<ProviderInput>(initial.input);
  const [headersText, setHeadersText] = useState(JSON.stringify(initial.input.headers_config, null, 2));
  const [mappingText, setMappingText] = useState(JSON.stringify(initial.input.response_mapping, null, 2));
  const [testUrl, setTestUrl] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [test, setTest] = useState<TestResult | null>(null);
  const save = useServerFn(adminSaveProvider);
  const tester = useServerFn(adminTestProvider);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [onClose]);

  const set = <K extends keyof ProviderInput>(k: K, v: ProviderInput[K]) => setF((s) => ({ ...s, [k]: v }));

  const build = (): ProviderInput | null => {
    try {
      const headers = headersText.trim() ? JSON.parse(headersText) : {};
      const mapping = JSON.parse(mappingText);
      if (typeof headers !== "object" || Array.isArray(headers)) throw new Error("Headers harus objek JSON");
      if (!mapping.destinationPath) throw new Error("Mapping wajib memiliki destinationPath");
      return { ...f, slug: f.slug.toLowerCase(), headers_config: headers, response_mapping: mapping };
    } catch (e) {
      setErr(`JSON tidak valid: ${(e as Error).message}`);
      return null;
    }
  };

  const onSave = async () => {
    setErr(null);
    const p = build();
    if (!p) return;
    setSaving(true);
    try {
      const r = await save({ data: { id: initial.id, provider: p } });
      if (!r.ok) setErr(r.message);
      else { toast.success("Provider disimpan."); onSaved(); }
    } catch (e) {
      setErr(validationMsg(e));
    } finally { setSaving(false); }
  };

  const onTest = async () => {
    setErr(null);
    setTest(null);
    const p = build();
    if (!p) return;
    if (!testUrl.trim()) return setErr("Isi URL uji terlebih dahulu.");
    setTesting(true);
    try {
      setTest(await tester({ data: { id: initial.id, provider: p, testUrl } }));
    } catch (e) {
      setErr(validationMsg(e));
    } finally { setTesting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/80 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="card3d pop-in flex max-h-[92vh] w-full max-w-2xl flex-col rounded-b-none sm:rounded-b-[1.5rem]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Form provider"
      >
        <div className="flex items-center justify-between border-b p-4 sm:p-5">
          <h2 className="text-lg font-bold">{initial.id ? "Edit provider" : "Tambah provider"}</h2>
          <button className="btn3d btn-ghost btn-icon" onClick={onClose} aria-label="Tutup"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 overflow-y-auto p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama"><input className="input3d" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="SFL" /></Field>
            <Field label="Slug"><input className="input3d" value={f.slug} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="sfl" /></Field>
          </div>
          <Field label="Deskripsi"><input className="input3d" value={f.description} onChange={(e) => set("description", e.target.value)} /></Field>
          <Field label="API endpoint URL (HTTPS)"><input className="input3d font-mono text-sm" value={f.endpoint_url} onChange={(e) => set("endpoint_url", e.target.value.trim())} /></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Method">
              <select className="input3d" value={f.method} onChange={(e) => set("method", e.target.value as "GET" | "POST")}><option>GET</option><option>POST</option></select>
            </Field>
            <Field label="Parameter URL input"><input className="input3d" value={f.input_parameter} onChange={(e) => set("input_parameter", e.target.value)} /></Field>
            <Field label="Timeout (ms)"><input type="number" className="input3d" min={2000} max={60000} value={f.timeout_ms} onChange={(e) => set("timeout_ms", Number(e.target.value))} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mode API key global">
              <select className="input3d" value={f.auth_mode} onChange={(e) => set("auth_mode", e.target.value as ProviderInput["auth_mode"])}>
                <option value="header">Custom header</option>
                <option value="bearer">Authorization: Bearer</option>
                <option value="query">Query parameter</option>
                <option value="none">Tanpa API key</option>
              </select>
            </Field>
            {(f.auth_mode === "header" || f.auth_mode === "query") && (
              <Field label={f.auth_mode === "header" ? "Nama header" : "Nama parameter"}>
                <input className="input3d" value={f.auth_header} onChange={(e) => set("auth_header", e.target.value)} placeholder="x-apikey" />
              </Field>
            )}
          </div>
          <Field label="Header tambahan (JSON, tanpa secret)"><textarea className="input3d" value={headersText} onChange={(e) => setHeadersText(e.target.value)} /></Field>
          <Field label="Response mapping (JSON path)"><textarea className="input3d min-h-40" value={mappingText} onChange={(e) => setMappingText(e.target.value)} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Warna">
              <div className="flex flex-wrap gap-2">
                {THEME_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => set("theme_config", { ...f.theme_config, color: c })} data-active={f.theme_config.color === c} className={`tile3d tone-${c} p-1.5`} aria-label={c}>
                    <span className="tone-icon block h-6 w-6" />
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Ikon">
              <div className="flex flex-wrap gap-2">
                {THEME_ICONS.map((ic) => (
                  <button key={ic} type="button" onClick={() => set("theme_config", { ...f.theme_config, icon: ic })} data-active={f.theme_config.icon === ic} className={`tile3d tone-${f.theme_config.color} grid h-10 w-10 place-items-center`} aria-label={ic}>
                    <ProviderIcon icon={ic} className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </Field>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-ink p-3">
            <span className="text-sm font-semibold">Aktifkan untuk pengguna</span>
            <Toggle checked={f.enabled} label="Enabled" onChange={(v) => set("enabled", v)} />
          </div>

          <div className="rounded-2xl border border-cyan/25 p-4">
            <div className="label3d">Uji endpoint</div>
            <input className="input3d mt-2 text-sm" placeholder="https://sfl.gl/AalXumRD" value={testUrl} onChange={(e) => setTestUrl(e.target.value)} />
            <button type="button" className="btn3d btn-sm mt-3" onClick={onTest} disabled={testing}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />} TEST ENDPOINT
            </button>
            {test && (
              <div className="fade-up mt-3 rounded-xl bg-ink p-3 text-sm">
                <span className={`badge ${test.ok ? "badge-success" : "badge-error"}`}>{test.status}</span>
                <p className="mt-2 text-muted-foreground">{test.detail}</p>
                <p className="mt-1 text-xs text-muted-foreground">HTTP {test.httpStatus ?? "-"} · {test.elapsedMs} ms</p>
                {test.destinationUrl && <p className="url-text mt-2 text-emerald">{test.destinationUrl}</p>}
              </div>
            )}
          </div>
          {err && <p className="rounded-lg border border-pink/30 bg-pink/10 p-3 text-sm text-pink" role="alert">{err}</p>}
        </div>
        <div className="flex gap-3 border-t p-4 sm:p-5">
          <button className="btn3d btn-ghost flex-1" onClick={onClose}>BATAL</button>
          <button className="btn3d btn-admin flex-1" onClick={onSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} SIMPAN
          </button>
        </div>
      </div>
    </div>
  );
}

function validationMsg(e: unknown) {
  const m = (e as Error)?.message ?? "";
  try {
    const parsed = JSON.parse(m);
    if (Array.isArray(parsed) && parsed[0]) return `${parsed[0].path?.join(".")}: ${parsed[0].message}`;
  } catch { /* not zod */ }
  return "Data tidak valid. Periksa kembali semua field.";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label3d mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}
