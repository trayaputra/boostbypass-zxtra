import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { requireAdmin } from "./admin-middleware";
import {
  callProvider,
  clientIp,
  headerNameSchema,
  headersSchema,
  mappingSchema,
  validateEndpoint,
  type ProviderConfig,
} from "./bypass.server";
import { checkUserUrl, THEME_COLORS, THEME_ICONS } from "./url";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function publicClient() {
  const key = (process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["SUPABASE_ANON_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || "").trim();
  const url = (process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || "").trim();
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// ---------- Login (rate-limited, with one-time bootstrap) ----------
const loginInput = z.object({ email: z.string().trim().email().max(200), password: z.string().min(1).max(200) });

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => loginInput.parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();
    const ip = clientIp(getRequest());
    const { data: ok } = await sb.rpc("hit_rate_limit", { _key: `login:${ip}`, _window_seconds: 900, _max: 8 });
    if (ok === false)
      return { ok: false as const, message: "Terlalu banyak percobaan login. Coba lagi dalam 15 menit." };

    const email = data.email.toLowerCase();
    // One-time bootstrap: only while no admin exists.
    const { count } = await sb.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) === 0) {
      const bEmail = (process.env["ADMIN_BOOTSTRAP_EMAIL"] ?? "").trim().toLowerCase();
      const bPass = process.env["ADMIN_BOOTSTRAP_PASSWORD"] ?? "";
      if (bEmail && bPass.length >= 10 && safeEqual(email, bEmail) && safeEqual(data.password, bPass)) {
        const created = await sb.auth.admin.createUser({ email, password: bPass, email_confirm: true });
        let userId = created.data.user?.id;
        if (!userId) {
          const list = await sb.auth.admin.listUsers({ perPage: 1000 });
          userId = list.data.users.find((u) => u.email?.toLowerCase() === email)?.id;
          if (userId) await sb.auth.admin.updateUserById(userId, { password: bPass, email_confirm: true });
        }
        if (userId) await sb.from("user_roles").insert({ user_id: userId, role: "admin" });
      }
    }

    const pub = publicClient();
    let { data: auth, error } = await pub.auth.signInWithPassword({ email, password: data.password });

    // Repair path: if the typed credentials match the configured admin env values,
    // reset that account's password/confirmation via the admin API and grant the role
    // (fixes accounts created by hand in SQL with bad hashes or NULL token columns).
    if (error || !auth.session) {
      const bEmail = (process.env["ADMIN_BOOTSTRAP_EMAIL"] ?? "").trim().toLowerCase();
      const bPass = process.env["ADMIN_BOOTSTRAP_PASSWORD"] ?? "";
      if (bEmail && bPass.length >= 10 && safeEqual(email, bEmail) && safeEqual(data.password, bPass)) {
        let userId: string | undefined;
        const list = await sb.auth.admin.listUsers({ perPage: 1000 });
        userId = list.data?.users.find((u) => u.email?.toLowerCase() === email)?.id;
        if (userId) {
          await sb.auth.admin.updateUserById(userId, { password: bPass, email_confirm: true });
        } else {
          const created = await sb.auth.admin.createUser({ email, password: bPass, email_confirm: true });
          userId = created.data.user?.id;
        }
        if (userId) {
          await sb.from("user_roles").upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
          ({ data: auth, error } = await pub.auth.signInWithPassword({ email, password: data.password }));
        }
      }
    }

    if (error || !auth.session) {
      console.error("[adminLogin] sign-in failed:", error?.status, error?.message);
      const msg = (error?.message ?? "").toLowerCase();
      if (msg.includes("not confirmed")) return { ok: false as const, message: "Email belum dikonfirmasi." };
      if ((error?.status ?? 0) >= 500 || msg.includes("database error"))
        return { ok: false as const, message: "Akun rusak di database (dibuat manual via SQL). Hapus akun itu lalu login dengan email/password dari pengaturan server." };
      if (msg.includes("invalid api key") || (error?.status ?? 0) === 401)
        return { ok: false as const, message: "Kunci server tidak cocok dengan database. Periksa SUPABASE_URL & SUPABASE_PUBLISHABLE_KEY." };
      return { ok: false as const, message: "Email atau password salah." };
    }
    const { data: roleRow } = await sb
      .from("user_roles")
      .select("id")
      .eq("user_id", auth.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return { ok: false as const, message: "Akun ini tidak memiliki akses admin." };
    await sb.from("user_roles").update({ last_login_at: new Date().toISOString() }).eq("id", roleRow.id);
    return {
      ok: true as const,
      access_token: auth.session.access_token,
      refresh_token: auth.session.refresh_token,
    };
  });

export const checkAdmin = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => ({ ok: true, userId: context.userId }));

// ---------- Providers ----------
const providerInput = z.object({
  name: z.string().trim().min(1).max(60),
  slug: z.string().trim().min(1).max(40).regex(/^[a-z0-9-]+$/, "Slug hanya huruf kecil, angka, dan -"),
  description: z.string().trim().max(200).default(""),
  endpoint_url: z.string().trim().url().max(500),
  method: z.enum(["GET", "POST"]),
  headers_config: headersSchema.default({}),
  auth_mode: z.enum(["header", "bearer", "query", "none"]),
  auth_header: z.union([headerNameSchema, z.literal("")]).default("x-apikey"),
  input_parameter: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9_\-]+$/),
  response_mapping: mappingSchema,
  timeout_ms: z.number().int().min(2000).max(60000),
  enabled: z.boolean(),
  theme_config: z.object({ color: z.enum(THEME_COLORS), icon: z.enum(THEME_ICONS) }),
});
export type ProviderInput = z.infer<typeof providerInput>;

export const adminListProviders = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const sb = await admin();
    const { data, error } = await sb.from("providers").select("*").order("sort_order").order("created_at");
    if (error) throw new Error("Gagal memuat provider");
    return data ?? [];
  });

export const adminSaveProvider = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid().optional(), provider: providerInput }).parse(d))
  .handler(async ({ data }) => {
    const err = await validateEndpoint(data.provider.endpoint_url);
    if (err) return { ok: false as const, message: err };
    const sb = await admin();
    const row = { ...data.provider, updated_at: new Date().toISOString() };
    if (data.id) {
      const { error } = await sb.from("providers").update(row).eq("id", data.id);
      if (error) return { ok: false as const, message: error.code === "23505" ? "Slug sudah dipakai." : "Gagal menyimpan." };
    } else {
      const { data: last } = await sb.from("providers").select("sort_order").order("sort_order", { ascending: false }).limit(1);
      const { error } = await sb.from("providers").insert({ ...row, sort_order: (last?.[0]?.sort_order ?? -1) + 1 });
      if (error) return { ok: false as const, message: error.code === "23505" ? "Slug sudah dipakai." : "Gagal menyimpan." };
    }
    return { ok: true as const };
  });

export const adminToggleProvider = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();
    await sb.from("providers").update({ enabled: data.enabled, updated_at: new Date().toISOString() }).eq("id", data.id);
    return { ok: true };
  });

export const adminDeleteProvider = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();
    await sb.from("providers").delete().eq("id", data.id);
    return { ok: true };
  });

export const adminMoveProvider = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), direction: z.enum(["up", "down"]) }).parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();
    const { data: list } = await sb.from("providers").select("id, sort_order").order("sort_order").order("created_at");
    const arr = list ?? [];
    const i = arr.findIndex((p) => p.id === data.id);
    const j = data.direction === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= arr.length) return { ok: true };
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
    await Promise.all(arr.map((p, idx) => sb.from("providers").update({ sort_order: idx }).eq("id", p.id)));
    return { ok: true };
  });

const TEST_LABEL: Record<string, string> = {
  AUTH_FAILED: "Authentication failed",
  INVALID_RESPONSE: "Invalid response",
  TIMEOUT: "Timeout",
  SERVER_UNAVAILABLE: "Endpoint unavailable",
  CONFIG_ERROR: "Configuration error",
  PROVIDER_ERROR: "Invalid response",
  RATE_LIMITED: "Endpoint unavailable",
};

export const adminTestProvider = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid().optional(), provider: providerInput, testUrl: z.string().max(2048) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const { data: allowed } = await sb.rpc("hit_rate_limit", {
      _key: `test:${context.userId}`,
      _window_seconds: 60,
      _max: 10,
    });
    if (allowed === false)
      return { ok: false, status: "Configuration error", detail: "Terlalu banyak test. Tunggu 1 menit.", httpStatus: null, elapsedMs: 0, destinationUrl: null };
    const u = checkUserUrl(data.testUrl);
    if (!u.ok)
      return { ok: false, status: "Configuration error", detail: `URL uji: ${u.message}`, httpStatus: null, elapsedMs: 0, destinationUrl: null };
    const out = await callProvider(data.provider as unknown as ProviderConfig, u.url);
    const status = out.ok ? "Connection successful" : TEST_LABEL[out.code] ?? "Configuration error";
    if (data.id) {
      await sb
        .from("providers")
        .update({
          last_test_at: new Date().toISOString(),
          last_test_status: status,
          last_test_error: out.ok ? null : out.detail.slice(0, 200),
        })
        .eq("id", data.id);
    }
    return {
      ok: out.ok,
      status,
      detail: out.ok ? "Response mapping valid." : out.detail,
      httpStatus: out.httpStatus,
      elapsedMs: out.elapsedMs,
      destinationUrl: out.ok ? out.destinationUrl : null,
    };
  });

// ---------- Stats & logs ----------
export const adminStats = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const sb = await admin();
    const since = new Date(Date.now() - 13 * 86400000);
    since.setUTCHours(0, 0, 0, 0);
    const [prov, total, success, failed, recent, windowRows] = await Promise.all([
      sb.from("providers").select("enabled"),
      sb.from("bypass_logs").select("id", { count: "exact", head: true }),
      sb.from("bypass_logs").select("id", { count: "exact", head: true }).eq("status", "success"),
      sb.from("bypass_logs").select("id", { count: "exact", head: true }).eq("status", "failed"),
      sb.from("bypass_logs").select("id, provider_slug, status, execution_time_ms, error_code, created_at").order("created_at", { ascending: false }).limit(8),
      sb.from("bypass_logs").select("status, execution_time_ms, created_at").gte("created_at", since.toISOString()).limit(20000),
    ]);
    const rows = windowRows.data ?? [];
    const days: { date: string; success: number; failed: number }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(since.getTime() + i * 86400000);
      days.push({ date: d.toISOString().slice(0, 10), success: 0, failed: 0 });
    }
    let sum = 0, n = 0;
    for (const r of rows) {
      const day = days.find((x) => x.date === r.created_at.slice(0, 10));
      if (day) r.status === "success" ? day.success++ : day.failed++;
      if (typeof r.execution_time_ms === "number") { sum += r.execution_time_ms; n++; }
    }
    const providers = prov.data ?? [];
    return {
      totalProviders: providers.length,
      activeProviders: providers.filter((p) => p.enabled).length,
      totalRequests: total.count ?? 0,
      successRequests: success.count ?? 0,
      failedRequests: failed.count ?? 0,
      avgResponseMs: n ? Math.round(sum / n) : 0,
      recent: recent.data ?? [],
      daily: days,
    };
  });

const logsInput = z.object({
  page: z.number().int().min(1).max(10000).default(1),
  provider: z.string().max(60).optional(),
  status: z.enum(["success", "failed"]).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export const adminLogs = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => logsInput.parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();
    const size = 20;
    let q = sb
      .from("bypass_logs")
      .select("id, provider_slug, status, execution_time_ms, error_code, input_host, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((data.page - 1) * size, data.page * size - 1);
    if (data.provider) q = q.eq("provider_slug", data.provider);
    if (data.status) q = q.eq("status", data.status);
    if (data.from) q = q.gte("created_at", `${data.from}T00:00:00Z`);
    if (data.to) q = q.lte("created_at", `${data.to}T23:59:59Z`);
    const { data: rows, count } = await q;
    return { rows: rows ?? [], total: count ?? 0, pageSize: size };
  });

export const adminClearLogs = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ olderThanDays: z.number().int().min(0).max(3650) }).parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();
    const cutoff = new Date(Date.now() - data.olderThanDays * 86400000).toISOString();
    const { count } = await sb.from("bypass_logs").delete({ count: "exact" }).lt("created_at", cutoff);
    return { deleted: count ?? 0 };
  });

export const adminKeyStatus = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const key = process.env["BYPASS_API_KEY"];
    return { configured: !!key && key.length > 0 };
  });
