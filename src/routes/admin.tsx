import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, Boxes, LogOut, ScrollText, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { checkAdmin } from "@/lib/admin.functions";
import { Logo } from "@/components/ProviderIcon";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/admin/login" });
    try {
      await checkAdmin();
    } catch {
      await supabase.auth.signOut();
      throw redirect({ to: "/admin/login" });
    }
  },
  head: () => ({
    meta: [
      { title: "Admin — NEXORA" },
      { name: "description", content: "NEXORA admin panel." },
      { property: "og:title", content: "Admin — NEXORA" },
      { property: "og:description", content: "NEXORA admin panel." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Dashboard", icon: BarChart3, exact: true },
  { to: "/admin/providers", label: "Providers", icon: Boxes },
  { to: "/admin/logs", label: "Logs", icon: ScrollText },
  { to: "/admin/settings", label: "Settings", icon: Settings },
] as const;

function AdminLayout() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/admin/login", replace: true });
  };
  return (
    <div className="mx-auto flex min-h-screen max-w-7xl gap-6 px-3 pb-28 pt-4 sm:px-6 lg:pb-8">
      <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-60 shrink-0 flex-col lg:flex">
        <div className="card3d flex h-full flex-col p-4">
          <Link to="/" className="flex items-center gap-2.5 px-1">
            <Logo />
            <div>
              <div className="font-display font-extrabold">NEXORA</div>
              <span className="badge badge-admin">Admin</span>
            </div>
          </Link>
          <nav className="mt-8 flex flex-col gap-3">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: "exact" in n }}
                className="tile3d tone-violet flex items-center gap-3 px-3.5 py-3 text-sm font-semibold"
                activeProps={{ "data-active": "true" } as Record<string, string>}
              >
                <n.icon className="h-4 w-4" /> {n.label}
              </Link>
            ))}
          </nav>
          <button onClick={signOut} className="btn3d btn-ghost btn-sm mt-auto">
            <LogOut className="h-4 w-4" /> LOGOUT
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="mb-4 flex items-center justify-between lg:hidden">
          <Link to="/" className="flex items-center gap-2">
            <Logo size={32} />
            <span className="font-display font-extrabold">NEXORA</span>
            <span className="badge badge-admin">Admin</span>
          </Link>
          <button onClick={signOut} className="btn3d btn-ghost btn-icon" aria-label="Logout">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        <Outlet />
      </div>

      <nav className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-4 gap-2 rounded-2xl border bg-surface/95 p-2 shadow-2xl lg:hidden">
        {NAV.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            activeOptions={{ exact: "exact" in n }}
            className="tile3d tone-violet flex flex-col items-center gap-1 py-2 text-[11px] font-semibold"
            activeProps={{ "data-active": "true" } as Record<string, string>}
          >
            <n.icon className="h-4 w-4" /> {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
