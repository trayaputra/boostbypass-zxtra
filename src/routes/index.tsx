import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { getHealth, listProviders } from "@/lib/public.functions";
import { BypassFlow } from "@/components/BypassFlow";
import { Logo } from "@/components/ProviderIcon";

const providersQuery = queryOptions({ queryKey: ["providers"], queryFn: () => listProviders(), staleTime: 60_000 });

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NEXORA — One link. A thousand possibilities." },
      { name: "description", content: "Resolve your shortlinks and reach your destination with NEXORA's fast multi-provider link resolver." },
      { property: "og:title", content: "NEXORA — Link Bypass Platform" },
      { property: "og:description", content: "Resolve your shortlinks. Reach your destination." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(providersQuery),
  component: Home,
});

function StatusPill() {
  const { data, isLoading } = useQuery({ queryKey: ["health"], queryFn: () => getHealth(), refetchInterval: 60_000 });
  const s = data?.status;
  const tone = isLoading ? "var(--muted-foreground)" : s === "online" ? "var(--emerald)" : s === "degraded" ? "var(--orange)" : "var(--pink)";
  const label = isLoading ? "Memeriksa..." : s === "online" ? "API online" : s === "degraded" ? "Terbatas" : "Offline";
  return (
    <span className="inline-flex items-center gap-2 rounded-full border bg-surface px-3 py-1.5 text-xs font-semibold" style={{ ["--tone" as string]: tone }}>
      <span className="pulse-dot" data-live={s === "online"} />
      {label}
    </span>
  );
}

function Home() {
  const { data: providers } = useSuspenseQuery(providersQuery);
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <Logo />
          <span className="leading-tight">
            <span className="block font-display text-lg font-extrabold tracking-wide">NEXORA</span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">by ZxTraa</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <StatusPill />
          <Link to="/admin" className="btn3d btn-admin btn-icon sm:w-auto sm:px-4" aria-label="Admin login">
            <ShieldCheck className="h-4 w-4" />
            <span className="hidden sm:inline">ADMIN</span>
          </Link>
        </div>
      </header>

      <main className="px-4 pb-20 sm:px-6">
        <section className="relative mx-auto max-w-3xl pb-10 pt-8 text-center sm:pt-14">
          <div className="shape shape-cube float-a left-0 top-6 hidden sm:block" />
          <div className="shape shape-orb float-b -right-4 top-0 hidden sm:block" />
          <div className="shape shape-pill float-b bottom-0 left-6 hidden md:block" />
          <div className="shape shape-ring float-a right-10 bottom-4 hidden md:block" />
          <span className="badge badge-process fade-up">Multi-provider link resolver</span>
          <h1 className="fade-up mt-5 text-4xl font-extrabold leading-[1.05] sm:text-6xl">
            One link. <span className="grad-text">A thousand possibilities.</span>
          </h1>
          <p className="fade-up mx-auto mt-4 max-w-md text-base text-muted-foreground sm:text-lg" style={{ animationDelay: "80ms" }}>
            Resolve your shortlinks. Reach your destination.
          </p>
        </section>
        <BypassFlow providers={providers} />
        <p className="mx-auto mt-10 max-w-xl text-center text-xs text-muted-foreground">
          Gunakan hanya untuk link yang kamu berhak akses. NEXORA tidak menyimpan URL lengkap yang kamu proses.
        </p>
      </main>
    </div>
  );
}
