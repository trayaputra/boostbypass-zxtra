import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatusBadge({ status, code }: { status: string; code?: string | null }) {
  return status === "success" ? (
    <span className="badge badge-success">Berhasil</span>
  ) : (
    <span className="badge badge-error">{code ? code.replace(/_/g, " ") : "Gagal"}</span>
  );
}

export function fmtDate(s: string | null | undefined) {
  if (!s) return "-";
  return new Date(s).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" });
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className="toggle3d disabled:opacity-50"
      onClick={() => onChange(!checked)}
    />
  );
}
