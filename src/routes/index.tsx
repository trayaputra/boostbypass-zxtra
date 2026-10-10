import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { 
  ShieldCheck, 
  Copy, 
  Sparkles, 
  ExternalLink, 
  Zap, 
  Shield, 
  Cpu, 
  ChevronDown, 
  CheckCircle2,
  Lock
} from "lucide-react";
import { getHealth, listProviders } from "@/lib/public.functions";
import { BypassFlow } from "@/components/BypassFlow";
import { Logo } from "@/components/ProviderIcon";

const providersQuery = queryOptions({ 
  queryKey: ["providers"], 
  queryFn: () => listProviders(), 
  staleTime: 60_000 
});

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

// Langkah penggunaan dengan efek 3D lift in-out
const STEPS = [
  {
    step: "01",
    title: "Salin Shortlink",
    desc: "Salin link pendek yang tertahan iklan, captcha, atau countdown dari browser kamu.",
    icon: Copy,
    color: "from-cyan-400 to-emerald-400",
    badge: "Input",
    tone: "cyan",
  },
  {
    step: "02",
    title: "Auto-Detect Provider",
    desc: "Tempel link ke NEXORA. Sistem backend mendeteksi provider dan memprosesnya secara instan.",
    icon: Cpu,
    color: "from-violet-400 to-blue-400",
    badge: "Proses",
    tone: "violet",
  },
  {
    step: "03",
    title: "Buka Link Asli",
    desc: "Dapatkan tujuan akhir yang bersih tanpa iklan mengganggu, siap dibuka atau disalin sekali klik.",
    icon: ExternalLink,
    color: "from-pink-400 to-orange-400",
    badge: "Selesai",
    tone: "pink",
  },
];

// Fitur unggulan
const FEATURES = [
  {
    icon: Zap,
    title: "Ultra Cepat",
    desc: "Resolusi link rata-rata di bawah 3 detik berkat proxy serverless yang dioptimalkan.",
    tone: "text-emerald-400",
  },
  {
    icon: Shield,
    title: "Bypass Aman",
    desc: "Dilengkapi SSRF Guard & IP filter untuk melindungi jaringan dan menjaga privasi pengguna.",
    tone: "text-cyan-400",
  },
  {
    icon: Lock,
    title: "Tanpa Jejak",
    desc: "NEXORA tidak pernah menyimpan URL lengkap atau parameter pribadi kamu ke dalam basis data.",
    tone: "text-violet-400",
  },
];

// Pertanyaan yang sering diajukan (FAQ)
const FAQS = [
  {
    q: "Apakah saya harus memilih provider sendiri?",
    a: "Tidak perlu. Sistem NEXORA kini memiliki auto-detection cerdas di sisi server yang otomatis mencocokkan URL kamu dengan provider yang aktif.",
  },
  {
    q: "Apakah link asli dijamin aman dari virus/iklan?",
    a: "NEXORA melewati halaman perantara iklan pihak ketiga dan langsung mengekstrak tautan tujuan akhir murni yang kamu tuju.",
  },
  {
    q: "Berapa lama link bisa diproses?",
    a: "Sebagian besar shortlink selesai diproses antara 1 hingga 5 detik tergantung antrean dan respons provider tujuan.",
  },
];

function Home() {
  const { data: providers } = useSuspenseQuery(providersQuery);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen">
      {/* HEADER */}
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

      {/* HERO SECTION */}
      <main className="px-4 pb-20 sm:px-6">
        <section className="relative mx-auto max-w-3xl pb-8 pt-8 text-center sm:pt-14">
          <div className="shape shape-cube float-a left-0 top-6 hidden sm:block" />
          <div className="shape shape-orb float-b -right-4 top-0 hidden sm:block" />
          <div className="shape shape-pill float-b bottom-0 left-6 hidden md:block" />
          <div className="shape shape-ring float-a right-10 bottom-4 hidden md:block" />
          
          <span className="badge badge-process fade-up">
            <Sparkles className="h-3 w-3 inline mr-1 text-cyan-400" /> Auto-detect Link Resolver
          </span>
          <h1 className="fade-up mt-5 text-4xl font-extrabold leading-[1.05] sm:text-6xl">
            One link. <span className="grad-text">A thousand possibilities.</span>
          </h1>
          <p className="fade-up mx-auto mt-4 max-w-md text-base text-muted-foreground sm:text-lg" style={{ animationDelay: "80ms" }}>
            Resolve your shortlinks. Reach your destination.
          </p>
        </section>

        {/* BYPASS FORM */}
        <BypassFlow providers={providers} />

        {/* SECTION 1: LANGKAH PENGGUNAAN (HOW IT WORKS) DENGAN EFEK HOVER/ACTIVE IN-OUT */}
        <section className="mx-auto mt-24 max-w-4xl">
          <div className="text-center">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-cyan-400">Mudah & Cepat</span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold">
              Cara Menggunakan <span className="grad-text-cool">NEXORA</span>
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Hanya butuh 3 langkah singkat tanpa perlu melewati perangkap iklan yang membingungkan.
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {STEPS.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.step}
                  className="tile3d group relative overflow-hidden rounded-2xl p-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_16px_30px_rgba(0,0,0,0.5)] active:translate-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-2xl font-black opacity-30 group-hover:opacity-60 transition-opacity">
                      {s.step}
                    </span>
                    <span className="rounded-full border border-white/10 bg-surface px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">
                      {s.badge}
                    </span>
                  </div>

                  <div className="mt-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-ink/70 border border-white/10 shadow-inner group-hover:scale-110 transition-transform duration-300">
                    <Icon className="h-6 w-6 text-cyan-400 group-hover:text-emerald-400 transition-colors" />
                  </div>

                  <h3 className="mt-4 text-base font-bold text-foreground group-hover:text-cyan-300 transition-colors">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {s.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 2: FITUR UNGGULAN (HIGHLIGHTS) */}
        <section className="mx-auto mt-20 max-w-4xl">
          <div className="card3d rounded-2xl p-6 sm:p-8">
            <div className="grid gap-6 sm:grid-cols-3">
              {FEATURES.map((f, i) => {
                const Icon = f.icon;
                return (
                  <div key={i} className="flex flex-col items-center sm:items-start text-center sm:text-left">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-ink/80 border border-white/10 mb-3">
                      <Icon className={`h-5 w-5 ${f.tone}`} />
                    </div>
                    <h4 className="text-sm font-extrabold">{f.title}</h4>
                    <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* SECTION 3: PERTANYAAN UMUM (FAQ ACCORDION DENGAN IN-OUT TRANSITION) */}
        <section className="mx-auto mt-20 max-w-2xl">
          <div className="text-center mb-8">
            <h2 className="text-xl sm:text-2xl font-extrabold">Pertanyaan Umum (FAQ)</h2>
            <p className="mt-1 text-xs text-muted-foreground">Hal-hal yang sering ditanyakan seputar layanan bypass.</p>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="tile3d rounded-xl overflow-hidden transition-all duration-200"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between p-4 text-left font-display text-sm font-bold text-foreground transition-colors hover:text-cyan-400"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 transition-transform duration-300 ${
                        isOpen ? "rotate-180 text-cyan-400" : "text-muted-foreground"
                      }`}
                    />
                  </button>
                  <div
                    className={`grid transition-all duration-300 ease-in-out ${
                      isOpen ? "grid-rows-[1fr] opacity-100 px-4 pb-4" : "grid-rows-[0fr] opacity-0 px-4 pb-0"
                    }`}
                  >
                    <div className="overflow-hidden text-xs leading-relaxed text-muted-foreground border-t border-white/5 pt-3">
                      {faq.a}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* FOOTER RAWAS */}
        <footer className="mx-auto mt-24 max-w-4xl border-t border-white/5 pt-8 text-center text-xs text-muted-foreground">
          <p className="flex items-center justify-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            Gunakan hanya untuk link yang kamu berhak akses. NEXORA tidak menyimpan data pengguna.
          </p>
          <p className="mt-2 text-[11px] opacity-60">
            © 2026 NEXORA by ZxTraa. Hak cipta dilindungi.
          </p>
        </footer>
      </main>
    </div>
  );
}
