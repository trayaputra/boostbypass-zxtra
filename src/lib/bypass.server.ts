// Server-only: SSRF guard, response mapping, provider calls.
import { z } from "zod";
import { isSafeHttpUrl, type BypassErrorCode } from "./url";

export const MAX_RESPONSE_BYTES = 1_000_000;
const ALLOWED_PORTS = new Set(["", "443", "8443"]);
const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
  "instance-data",
]);

export const pathSchema = z
  .string()
  .max(120)
  .regex(/^[A-Za-z0-9_\-]+(\.[A-Za-z0-9_\-]+)*$/, "Path hanya boleh berisi huruf, angka, _ - dan titik");

export const mappingSchema = z.object({
  successPath: pathSchema.optional().or(z.literal("")),
  destinationPath: pathSchema,
  originalPath: pathSchema.optional().or(z.literal("")),
  creatorPath: pathSchema.optional().or(z.literal("")),
  executionTimePath: pathSchema.optional().or(z.literal("")),
  errorPath: pathSchema.optional().or(z.literal("")),
});
export type ResponseMapping = z.infer<typeof mappingSchema>;

const FORBIDDEN_HEADERS = new Set([
  "host", "content-length", "connection", "transfer-encoding", "cookie", "authorization", "proxy-authorization",
]);
export const headerNameSchema = z.string().min(1).max(64).regex(/^[A-Za-z0-9\-_]+$/);
export const headersSchema = z
  .record(z.string().max(500))
  .refine((h) => Object.keys(h).length <= 15, "Maksimal 15 header")
  .refine(
    (h) => Object.keys(h).every((k) => headerNameSchema.safeParse(k).success && !FORBIDDEN_HEADERS.has(k.toLowerCase())),
    "Nama header tidak valid atau tidak diizinkan",
  );

export function readPath(obj: unknown, path: string | undefined): unknown {
  if (!path) return undefined;
  let cur: unknown = obj;
  for (const part of path.split(".")) {
    if (part === "__proto__" || part === "constructor" || part === "prototype") return undefined;
    if (cur === null || typeof cur !== "object") return undefined;
    cur = Array.isArray(cur) && /^\d+$/.test(part) ? cur[Number(part)] : (cur as Record<string, unknown>)[part];
  }
  return cur;
}

// ---------- SSRF protection ----------
function ipv4ToInt(ip: string): number | null {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const p = m.slice(1).map(Number);
  if (p.some((n) => n > 255)) return null;
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
}
function inRange(ip: number, cidr: string): boolean {
  const [base, bits] = cidr.split("/");
  const b = ipv4ToInt(base)!;
  const mask = Number(bits) === 0 ? 0 : (~0 << (32 - Number(bits))) >>> 0;
  return (ip & mask) === (b & mask);
}
const PRIVATE_V4 = [
  "0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16", "172.16.0.0/12",
  "192.0.0.0/24", "192.0.2.0/24", "192.168.0.0/16", "198.18.0.0/15", "198.51.100.0/24",
  "203.0.113.0/24", "224.0.0.0/4", "240.0.0.0/4",
];
export function isPrivateIp(ip: string): boolean {
  const v4 = ipv4ToInt(ip);
  if (v4 !== null) return PRIVATE_V4.some((c) => inRange(v4, c));
  const v6 = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (!v6.includes(":")) return false;
  if (v6 === "::" || v6 === "::1") return true;
  if (v6.startsWith("fe8") || v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb")) return true;
  if (v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("ff")) return true;
  const mapped = v6.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIp(mapped[1]);
  if (v6.startsWith("::ffff:") || v6.startsWith("64:ff9b:") || v6.startsWith("2001:db8")) return true;
  return false;
}

/** Static validation of an admin-supplied endpoint URL. Returns error message or null. */
export function validateEndpointStatic(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return "URL endpoint tidak valid.";
  }
  if (u.protocol !== "https:") return "Endpoint wajib menggunakan HTTPS.";
  if (u.username || u.password) return "Endpoint tidak boleh berisi kredensial.";
  if (!ALLOWED_PORTS.has(u.port)) return "Port endpoint tidak diizinkan (hanya 443/8443).";
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal"))
    return "Hostname endpoint tidak diizinkan.";
  if (ipv4ToInt(host) !== null || host.includes(":")) {
    if (isPrivateIp(host)) return "Alamat IP privat/internal tidak diizinkan.";
  } else if (!host.includes(".")) return "Hostname endpoint tidak valid.";
  return null;
}

async function resolveDoh(host: string, type: "A" | "AAAA"): Promise<string[]> {
  const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`, {
    headers: { accept: "application/dns-json" },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error("dns");
  const j = (await res.json()) as { Answer?: { type: number; data: string }[] };
  const want = type === "A" ? 1 : 28;
  return (j.Answer ?? []).filter((a) => a.type === want).map((a) => a.data);
}

/** Full validation including DNS. Returns error message or null. */
export async function validateEndpoint(raw: string): Promise<string | null> {
  const s = validateEndpointStatic(raw);
  if (s) return s;
  const host = new URL(raw).hostname.replace(/^\[|\]$/g, "");
  if (ipv4ToInt(host) !== null || host.includes(":")) return null;
  try {
    const [a, aaaa] = await Promise.all([resolveDoh(host, "A"), resolveDoh(host, "AAAA").catch(() => [])]);
    const all = [...a, ...aaaa];
    if (all.length === 0) return "Hostname endpoint tidak dapat di-resolve.";
    if (all.some(isPrivateIp)) return "Hostname mengarah ke alamat internal dan diblokir.";
  } catch {
    return "Gagal memeriksa DNS endpoint.";
  }
  return null;
}

// ---------- Provider call ----------
export type ProviderConfig = {
  endpoint_url: string;
  method: string;
  headers_config: Record<string, string>;
  auth_mode: string;
  auth_header: string;
  input_parameter: string;
  response_mapping: ResponseMapping;
  timeout_ms: number;
};

export type CallOutcome =
  | { ok: true; destinationUrl: string; originalUrl: string | null; creator: string | null; executionTimeMs: number | null; httpStatus: number; elapsedMs: number }
  | { ok: false; code: BypassErrorCode; detail: string; httpStatus: number | null; elapsedMs: number };

async function readLimited(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("too_large");
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    buf.set(c, o);
    o += c.byteLength;
  }
  return new TextDecoder().decode(buf);
}

export async function callProvider(cfg: ProviderConfig, inputUrl: string): Promise<CallOutcome> {
  const started = Date.now();
  const fail = (code: BypassErrorCode, detail: string, httpStatus: number | null = null): CallOutcome => ({
    ok: false, code, detail, httpStatus, elapsedMs: Date.now() - started,
  });

  const apiKey = process.env["BYPASS_API_KEY"];
  if (cfg.auth_mode !== "none" && !apiKey) return fail("CONFIG_ERROR", "Global API key belum dikonfigurasi");

  const endpointErr = await validateEndpoint(cfg.endpoint_url);
  if (endpointErr) return fail("CONFIG_ERROR", endpointErr);

  const method = cfg.method === "POST" ? "POST" : "GET";
  const target = new URL(cfg.endpoint_url);
  const headers = new Headers({ accept: "application/json", "user-agent": "NEXORA/1.0" });
  for (const [k, v] of Object.entries(cfg.headers_config ?? {})) headers.set(k, v);
  if (cfg.auth_mode === "header") headers.set(cfg.auth_header || "x-apikey", apiKey!);
  else if (cfg.auth_mode === "bearer") headers.set("authorization", `Bearer ${apiKey}`);
  else if (cfg.auth_mode === "query") target.searchParams.set(cfg.auth_header || "apikey", apiKey!);

  let body: string | undefined;
  if (method === "GET") target.searchParams.set(cfg.input_parameter || "url", inputUrl);
  else {
    headers.set("content-type", "application/json");
    body = JSON.stringify({ [cfg.input_parameter || "url"]: inputUrl });
  }

  const timeout = Math.min(Math.max(cfg.timeout_ms || 20000, 2000), 60000);
  const signal = AbortSignal.timeout(timeout);
  let res: Response;
  let url = target.toString();
  try {
    for (let hop = 0; ; hop++) {
      res = await fetch(url, { method, headers, body, redirect: "manual", signal });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        if (hop >= 3) return fail("PROVIDER_ERROR", "Terlalu banyak redirect", res.status);
        const next = new URL(res.headers.get("location")!, url).toString();
        const err = await validateEndpoint(next);
        if (err) return fail("CONFIG_ERROR", `Redirect diblokir: ${err}`, res.status);
        // Never forward the key to a different host.
        if (new URL(next).host !== new URL(url).host) return fail("PROVIDER_ERROR", "Redirect ke host lain ditolak", res.status);
        url = next;
        continue;
      }
      break;
    }
  } catch (e) {
    const name = (e as Error)?.name;
    if (name === "TimeoutError" || name === "AbortError") return fail("TIMEOUT", "Request timeout");
    return fail("SERVER_UNAVAILABLE", "Endpoint tidak dapat dihubungi");
  }

  const status = res!.status;
  let text: string;
  try {
    text = await readLimited(res!);
  } catch (e) {
    if ((e as Error)?.message === "too_large") return fail("INVALID_RESPONSE", "Respons terlalu besar", status);
    const name = (e as Error)?.name;
    if (name === "TimeoutError" || name === "AbortError") return fail("TIMEOUT", "Request timeout", status);
    return fail("SERVER_UNAVAILABLE", "Gagal membaca respons", status);
  }

  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not json */
  }
  const m = cfg.response_mapping;
  const providerMsg = typeof readPath(json, m.errorPath) === "string" ? String(readPath(json, m.errorPath)).slice(0, 200) : "";

  if (status === 401 || status === 403) return fail("AUTH_FAILED", "Autentikasi ditolak provider", status);
  if (status === 429) return fail("RATE_LIMITED", "Provider membatasi request", status);
  if (status >= 500) return fail("SERVER_UNAVAILABLE", `Provider error HTTP ${status}`, status);
  if (json === null || typeof json !== "object") return fail("INVALID_RESPONSE", "Respons bukan JSON valid", status);
  if (status >= 400) return fail("PROVIDER_ERROR", providerMsg || `HTTP ${status}`, status);

  if (m.successPath) {
    const s = readPath(json, m.successPath);
    const okVal = s === true || s === "true" || s === "success" || s === 1 || s === "ok";
    if (!okVal) return fail("PROVIDER_ERROR", providerMsg || "Provider menyatakan gagal", status);
  }
  const dest = readPath(json, m.destinationPath);
  if (!isSafeHttpUrl(dest)) return fail("INVALID_RESPONSE", "URL tujuan tidak ditemukan atau tidak valid", status);
  const orig = readPath(json, m.originalPath);
  const creator = readPath(json, m.creatorPath);
  const exec = readPath(json, m.executionTimePath);
  return {
    ok: true,
    destinationUrl: dest,
    originalUrl: typeof orig === "string" ? orig : null,
    creator: typeof creator === "string" ? creator.slice(0, 80) : null,
    executionTimeMs: typeof exec === "number" && isFinite(exec) ? Math.round(exec) : null,
    httpStatus: status,
    elapsedMs: Date.now() - started,
  };
}

export function clientIp(req: Request | undefined): string {
  const h = req?.headers;
  return (
    h?.get("cf-connecting-ip") || h?.get("x-forwarded-for")?.split(",")[0]?.trim() || h?.get("x-real-ip") || "unknown"
  );
}
