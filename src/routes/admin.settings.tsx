import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound } from "lucide-react";
import { adminKeyStatus } from "@/lib/admin.functions";
import { PageHeader } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/settings")({ component: SettingsPage });

function SettingsPage() {
  const fn = useServerFn(adminKeyStatus);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "key"], queryFn: () => fn() });
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Konfigurasi API key global." />
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
