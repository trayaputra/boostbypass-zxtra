import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminLogin } from "@/lib/admin.functions";
import { Logo } from "@/components/ProviderIcon";

export const Route = createFileRoute("/admin_/login")({
  head: () => ({
    meta: [
      { title: "Admin Login — NEXORA" },
      { name: "description", content: "Secure sign-in for NEXORA administrators." },
      { property: "og:title", content: "Admin Login — NEXORA" },
      { property: "og:description", content: "Secure sign-in for NEXORA administrators." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const login = useServerFn(adminLogin);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Masukkan email yang valid.");
    if (!password) return setError("Masukkan password.");
    setLoading(true);
    try {
      const res = await login({ data: { email: email.trim(), password } });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      const { error: se } = await supabase.auth.setSession({ access_token: res.access_token, refresh_token: res.refresh_token });
      if (se) throw se;
      navigate({ to: "/admin", replace: true });
    } catch {
      setError("Tidak dapat login saat ini. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <form onSubmit={submit} className="card3d card-glow pop-in w-full max-w-sm p-6 sm:p-8" noValidate>
        <div className="flex items-center gap-3">
          <Logo size={42} />
          <div>
            <div className="font-display text-xl font-extrabold">NEXORA</div>
            <span className="badge badge-admin mt-1"><Lock className="h-3 w-3" /> Admin</span>
          </div>
        </div>
        <h1 className="mt-6 text-2xl font-bold">Masuk ke panel admin</h1>
        <div className="mt-6 space-y-4">
          <div>
            <label className="label3d" htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="username" className="input3d mt-1.5" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label3d" htmlFor="pw">Password</label>
            <div className="relative mt-1.5">
              <input id="pw" type={show ? "text" : "password"} autoComplete="current-password" className="input3d pr-12" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-2 my-auto h-9 rounded-lg px-2 text-muted-foreground hover:text-foreground" aria-label={show ? "Sembunyikan password" : "Tampilkan password"}>
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
        {error && <p className="shake mt-4 rounded-lg border border-pink/30 bg-pink/10 p-3 text-sm text-pink" role="alert">{error}</p>}
        <button type="submit" className="btn3d btn-admin mt-6 w-full" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {loading ? "MEMPROSES..." : "MASUK"}
        </button>
        <Link to="/" className="mt-5 block text-center text-sm text-muted-foreground hover:text-foreground">← Kembali ke beranda</Link>
      </form>
    </div>
  );
}
