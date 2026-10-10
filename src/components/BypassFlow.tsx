import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardPaste,
  Copy,
  ExternalLink,
  Loader2,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { runBypass } from "@/lib/public.functions";
import {
  checkUserUrl,
  ERROR_MESSAGES,
  hostOf,
  isSafeHttpUrl,
  type BypassErrorCode,
  type PublicProvider,
} from "@/lib/url";

type Phase = "idle" | "validating" | "detecting" | "connecting" | "processing" | "success" | "failed" | "timeout";
type Done = { originalUrl: string; destinationUrl: string; executionTimeMs: number | null; providerName: string };

const CLIENT_TIMEOUT_MS = 65000;

function stageText(p: number) {
  if (p >= 100) return "Link berhasil ditemukan!";
  if (p >= 90) return "Menunggu hasil final...";
  if (p >= 70) return "Memproses respons...";
  if (p >= 50) return "Mencari URL tujuan...";
  if (p >= 25) return "Mencari provider yang sesuai...";
  if (p >= 10) return "Menganalisis link...";
  return "Menyiapkan permintaan...";
}

export function BypassFlow({ providers }: { providers: PublicProvider[] }) {
  const [url, setUrl] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<Done | null>(null);
  const [error, setError] = useState<{ code: BypassErrorCode; message: string } | null>(null);
  const [canPaste, setCanPaste] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const timerRef = useRef<number | null>(null);
  const runIdRef = useRef(0);
  const bypass = useServerFn(runBypass);

  useEffect(() => {
    setCanPaste(typeof navigator !== "undefined" && !!navigator.clipboard?.readText);
  }, []);

  const stopTimer = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  };
  useEffect(() => stopTimer, []);

  const reset = () => {
    runIdRef.current++;
    stopTimer();
    setPhase("idle");
    setProgress(0);
    setResult(null);
    setError(null);
  };

  const fail = (code: BypassErrorCode, message?: string) => {
    stopTimer();
    setError({ code, message: message ?? ERROR_MESSAGES[code] });
    setPhase(code === "TIMEOUT" ? "timeout" : "failed");
  };

  const start = useCallback(async () => {
    const check = checkUserUrl(url);
    if (!check.ok) {
      setInputError(check.message);
      return;
    }
    setInputError(null);
    const runId = ++runIdRef.current;
    setUrl(check.url);
    setResult(null);
    setError(null);
    setPhase("validating");
    setProgress(5);
    setStartedAt(Date.now());

    // Simulasi progress yang mencakup pencarian provider
    stopTimer();
    timerRef.current = window.setInterval(() => {
      setProgress((p) => {
        const cap = 93;
        if (p >= cap) return p;
        const step = p < 25 ? 2.5 : p < 50 ? 1.8 : p < 75 ? 1.2 : p < 90 ? 0.6 : 0.15;
        return Math.min(cap, p + step * (0.5 + Math.random()));
      });
    }, 160);

    window.setTimeout(() => runIdRef.current === runId && setPhase("detecting"), 300);
    window.setTimeout(() => runIdRef.current === runId && setPhase("connecting"), 1000);
    window.setTimeout(() => runIdRef.current === runId && setPhase((ph) => (ph === "connecting" ? "processing" : ph)), 2000);

    const timeout = new Promise<"timeout">((r) => window.setTimeout(() => r("timeout"), CLIENT_TIMEOUT_MS));
    let res: Awaited<ReturnType<typeof bypass>> | "timeout";
    try {
      res = await Promise.race([bypass({ data: { url: check.url } }), timeout]);
    } catch {
      if (runIdRef.current === runId) fail("SERVER_UNAVAILABLE");
      return;
    }
    if (runIdRef.current !== runId) return;
    if (res === "timeout") return fail("TIMEOUT");
    if (!res.success) return fail(res.error.code, res.error.message);
    if (!isSafeHttpUrl(res.destinationUrl)) return fail("INVALID_RESPONSE");

    stopTimer();
    const from = await new Promise<number>((r) => setProgress((p) => (r(p), p)));
    const t0 = performance.now();
    await new Promise<void>((done) => {
      const tick = (t: number) => {
        if (runIdRef.current !== runId) return done();
        const k = Math.min(1, (t - t0) / 450);
        setProgress(from + (100 - from) * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(tick);
        else done();
      };
      requestAnimationFrame(tick);
    });
    if (runIdRef.current !== runId) return;
    setPhase("success");
    await new Promise((r) => window.setTimeout(r, 400));
    if (runIdRef.current !== runId) return;
    setResult({
      originalUrl: res.originalUrl,
      destinationUrl: res.destinationUrl,
      executionTimeMs: res.executionTimeMs,
      providerName: res.provider,
    });
  }, [url, bypass]);

  const busy = phase === "validating" || phase === "detecting" || phase === "connecting" || phase === "processing" || (phase === "success" && !result);

  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) {
        setUrl(t.trim());
        setInputError(null);
      }
    } catch {
      toast.error("Izin clipboard ditolak. Tempel link secara manual.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      {/* Input card */}
      {!result && (phase === "idle" || phase === "failed" || phase === "timeout") && (
        <form
          className="card3d p-5 sm:p-7"
          onSubmit={(e) => {
            e.preventDefault();
            void start();
          }}
          noValidate
        >
          <div className="mb-3 flex items-center justify-between">
            <label htmlFor="link" className="label3d">Paste your link</label>
            <span className="badge badge-success">
              <Sparkles className="h-3 w-3 text-cyan" /> Auto-Detect Provider
            </span>
          </div>
          <div className="relative">
            <input
              id="link"
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              className={`input3d pr-24 ${inputError ? "shake" : ""}`}
              placeholder="https://example.com/shortlink"
              value={url}
              aria-invalid={!!inputError}
              aria-describedby="link-msg"
              onChange={(e) => {
                setUrl(e.target.value);
                if (inputError) setInputError(null);
              }}
            />
            <div className="absolute inset-y-0 right-2 flex items-center gap-1">
              {url && (
                <button type="button" className="rounded-lg p-2 text-muted-foreground hover:text-foreground" onClick={() => setUrl("")} aria-label="Hapus input">
                  <X className="h-4 w-4" />
                </button>
              )}
              {canPaste && (
                <button type="button" className="rounded-lg p-2 text-cyan hover:brightness-125" onClick={paste} aria-label="Tempel dari clipboard">
                  <ClipboardPaste className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <p id="link-msg" className={`mt-2 min-h-5 text-sm ${inputError ? "text-pink" : "text-muted-foreground"}`}>
            {inputError ?? "Mendukung shortlink http:// dan https:// (otomatis memilih provider)"}
          </p>
          <button type="submit" className="btn3d mt-3 w-full" disabled={busy}>
            BYPASS LINK
          </button>
        </form>
      )}

      {/* Processing card */}
      {(busy || ((phase === "failed" || phase === "timeout") && progress > 0)) && !result && (
        <ProcessingCard
          progress={progress}
          phase={phase}
          startedAt={startedAt}
          onCancel={() => {
            reset();
            toast("Proses dibatalkan.");
          }}
        />
      )}

      {/* Error card */}
      {error && (phase === "failed" || phase === "timeout") && (
        <div className="card3d fade-up border-pink/30 p-5 sm:p-6" role="alert">
          <div className="flex items-start gap-4">
            <span className="tone-pink tone-icon h-12 w-12 shrink-0">
              <AlertTriangle className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <span className={`badge ${error.code === "RATE_LIMITED" || error.code === "TIMEOUT" ? "badge-warn" : "badge-error"}`}>
                {error.code.replace(/_/g, " ")}
              </span>
              <h3 className="mt-2 text-lg font-bold">Gagal memproses link</h3>
              <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" className="btn3d btn-sm" onClick={() => void start()}>
                  <RotateCcw className="h-4 w-4" /> COBA LAGI
                </button>
                <button type="button" className="btn3d btn-ghost btn-sm" onClick={reset}>TUTUP</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {result && (
        <ResultCard
          result={result}
          onAgain={() => {
            reset();
            setUrl("");
          }}
        />
      )}
    </div>
  );
}

function ProcessingCard({
  progress, phase, startedAt, onCancel,
}: { progress: number; phase: Phase; startedAt: number; onCancel: () => void }) {
  const [elapsed, setElapsed] = useState(0);
  const running = phase === "validating" || phase === "detecting" || phase === "connecting" || phase === "processing";
  
  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setElapsed(Date.now() - startedAt), 100);
    return () => window.clearInterval(t);
  }, [running, startedAt]);

  const pct = Math.floor(progress);
  const stopped = phase === "failed" || phase === "timeout";
  
  const statusBadge = stopped ? (
    <span className="badge badge-error">Dihentikan</span>
  ) : phase === "success" ? (
    <span className="badge badge-success">Selesai</span>
  ) : (
    <span className="badge badge-process">
      <Loader2 className="h-3 w-3 animate-spin text-cyan" /> MEMPROSES
    </span>
  );

  return (
    <div className="card3d card-glow pop-in p-5 sm:p-7" aria-live="polite">
      {/* Header kartu proses dengan ikon 3D */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="tone-cyan tone-icon h-11 w-11 shrink-0 animate-pulse">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <div className="font-display font-bold leading-tight">RESOLVING LINK</div>
            <div className="text-xs text-muted-foreground">{(elapsed / 1000).toFixed(1)} dtk berjalan</div>
          </div>
        </div>
        {statusBadge}
      </div>

      {/* Angka persentase besar 3D + teks tahapan */}
      <div className="mt-6 flex items-end justify-between gap-4">
        <div className="font-display text-5xl font-extrabold tabular-nums tracking-tight sm:text-6xl">
          <span className={stopped ? "text-muted-foreground" : "grad-text-cool"}>{pct}</span>
          <span className="text-2xl text-muted-foreground">%</span>
        </div>
        <p className="pb-1.5 text-right text-xs font-semibold text-muted-foreground sm:text-sm">
          {stopped ? "Proses gagal" : stageText(progress)}
        </p>
      </div>

      {/* Batang progress bar gradasi neon yang bergerak */}
      <div className="progress-track mt-4" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div 
          className="progress-fill" 
          style={{ width: `${pct}%` }} 
          data-running={running} 
        />
      </div>

      {running && (
        <button type="button" className="btn3d btn-ghost btn-sm mt-5" onClick={onCancel}>
          <X className="h-4 w-4" /> BATALKAN
        </button>
      )}
    </div>
  );
}


function ResultCard({ result, onAgain }: { result: Done; onAgain: () => void }) {
  const [copied, setCopied] = useState(false);
  const domain = hostOf(result.destinationUrl);
  const open = () => {
    if (!isSafeHttpUrl(result.destinationUrl)) {
      toast.error("URL tujuan tidak valid.");
      return;
    }
    const w = window.open(result.destinationUrl, "_blank", "noopener,noreferrer");
    if (w) w.opener = null;
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.destinationUrl);
      setCopied(true);
      toast.success("Link tujuan disalin!");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Gagal menyalin. Salin secara manual.");
    }
  };
  return (
    <div className="card3d card-glow fade-up p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="badge badge-success"><CheckCircle2 className="h-3.5 w-3.5" /> Successfully resolved</span>
        {result.executionTimeMs != null && (
          <span className="text-xs text-muted-foreground">{(result.executionTimeMs / 1000).toFixed(2)} dtk</span>
        )}
      </div>
      <div className="mt-5 flex items-center gap-3">
        <span className="tone-cyan tone-icon h-12 w-12 shrink-0">
          <Sparkles className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">Resolved via {result.providerName}</div>
          <div className="font-display text-xl font-bold break-all sm:text-2xl">{domain}</div>
        </div>
      </div>
      <div className="mt-5 space-y-3">
        <div className="rounded-xl bg-ink p-3.5">
          <div className="label3d mb-1">Original link</div>
          <div className="url-text text-muted-foreground">{result.originalUrl}</div>
        </div>
        <div className="rounded-xl border border-emerald/30 bg-ink p-3.5">
          <div className="label3d mb-1 text-emerald">Destination link</div>
          <div className="url-text">{result.destinationUrl}</div>
        </div>
      </div>
      <button type="button" className="btn3d btn-open mt-6 w-full" onClick={open}>
        BUKA LINK  <ExternalLink className="sr-only" />
      </button>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button type="button" className="btn3d btn-copy btn-sm" onClick={copy}>
          {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "TERSALIN" : "SALIN LINK"}
        </button>
        <button type="button" className="btn3d btn-ghost btn-sm" onClick={onAgain}>
          <RotateCcw className="h-4 w-4" /> PROSES LINK LAIN
        </button>
      </div>
    </div>
  );
}
