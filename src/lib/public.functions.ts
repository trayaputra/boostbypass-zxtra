import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { callProvider, clientIp, type ProviderConfig } from "./bypass.server";
import {
  checkUserUrl,
  ERROR_MESSAGES,
  hostOf,
  THEME_COLORS,
  THEME_ICONS,
  type BypassErrorCode,
  type BypassResult,
  type PublicProvider,
} from "./url";

function toPublic(p: { slug: string; name: string; description: string; theme_config: unknown }): PublicProvider {
  const t = (p.theme_config ?? {}) as { color?: string; icon?: string };
  return {
    slug: p.slug,
    name: p.name,
    description: p.description,
    color: (THEME_COLORS as readonly string[]).includes(t.color ?? "") ? (t.color as PublicProvider["color"]) : "cyan",
    icon: (THEME_ICONS as readonly string[]).includes(t.icon ?? "") ? (t.icon as PublicProvider["icon"]) : "zap",
  };
}

export const listProviders = createServerFn({ method: "GET" }).handler(async (): Promise<PublicProvider[]> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("providers")
    .select("slug, name, description, theme_config")
    .eq("enabled", true)
    .order("sort_order", { ascending: true });
  if (error) {
    console.error("listProviders failed");
    return [];
  }
  return (data ?? []).map(toPublic);
});

export const getHealth = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ status: "online" | "degraded" | "offline"; checkedAt: string }> => {
    const checkedAt = new Date().toISOString();
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { count, error } = await supabaseAdmin
        .from("providers")
        .select("id", { count: "exact", head: true })
        .eq("enabled", true);
      if (error) return { status: "offline", checkedAt };
      const keyOk = !!process.env["BYPASS_API_KEY"];
      return { status: keyOk && (count ?? 0) > 0 ? "online" : "degraded", checkedAt };
    } catch {
      return { status: "offline", checkedAt };
    }
  },
);

const bypassInput = z.object({
  provider: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/).optional(),
  url: z.string().max(4096),
});

export const runBypass = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => bypassInput.parse(d))
  .handler(async ({ data }): Promise<BypassResult> => {
    const err = (code: BypassErrorCode): BypassResult => ({
      success: false,
      error: { code, message: ERROR_MESSAGES[code] },
    });
    const check = checkUserUrl(data.url);
    if (!check.ok) return { success: false, error: { code: "INVALID_URL", message: check.message } };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ip = clientIp(getRequest());
    const { data: allowed } = await supabaseAdmin.rpc("hit_rate_limit", {
      _key: `bypass:${ip}`,
      _window_seconds: 60,
      _max: 15,
    });
    if (allowed === false) return err("RATE_LIMITED");

    // Otomatis cari provider dari backend
    const { data: providers } = await supabaseAdmin
      .from("providers")
      .select("*")
      .eq("enabled", true)
      .order("sort_order", { ascending: true });

    if (!providers || providers.length === 0) return err("PROVIDER_INACTIVE");

    let p: (typeof providers)[number] | undefined;

    if (data.provider) {
      p = providers.find((item) => item.slug === data.provider);
    } else {
      // Cocokkan host URL dengan slug atau deskripsi provider
      const host = hostOf(check.url).toLowerCase();
      p = providers.find((item) => {
        const slug = item.slug.toLowerCase();
        return host.includes(slug) || (item.description ?? "").toLowerCase().includes(host);
      });
      // Fallback: gunakan provider aktif pertama jika tidak ada kecocokan khusus
      if (!p) p = providers[0];
    }

    if (!p) return err("PROVIDER_INACTIVE");

    const outcome = await callProvider(p as unknown as ProviderConfig, check.url);
    await supabaseAdmin.from("bypass_logs").insert({
      provider_id: p.id,
      provider_slug: p.slug,
      status: outcome.ok ? "success" : "failed",
      execution_time_ms: outcome.elapsedMs,
      error_code: outcome.ok ? null : outcome.code,
      input_host: hostOf(check.url).slice(0, 255),
    });
    if (!outcome.ok) {
      console.warn(`bypass failed provider=${p.slug} code=${outcome.code}`);
      return err(outcome.code);
    }
    return {
      success: true,
      provider: p.name || p.slug,
      originalUrl: check.url,
      destinationUrl: outcome.destinationUrl,
      executionTimeMs: outcome.executionTimeMs ?? outcome.elapsedMs,
    };
  });
