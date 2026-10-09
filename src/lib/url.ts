// Isomorphic URL helpers shared by browser and server.
export const MAX_URL_LENGTH = 2048;

export type UrlCheck = { ok: true; url: string } | { ok: false; message: string };

export function checkUserUrl(raw: string): UrlCheck {
  const value = (raw ?? "").trim();
  if (!value) return { ok: false, message: "Masukkan link terlebih dahulu." };
  if (value.length > MAX_URL_LENGTH) return { ok: false, message: "Link terlalu panjang (maks. 2048 karakter)." };
  if (/\s/.test(value)) return { ok: false, message: "Link tidak boleh mengandung spasi." };
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return { ok: false, message: "Format link tidak valid. Contoh: https://example.com/abc" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:")
    return { ok: false, message: "Hanya link http:// atau https:// yang diizinkan." };
  if (!u.hostname || !u.hostname.includes(".")) return { ok: false, message: "Nama domain pada link tidak valid." };
  if (u.username || u.password) return { ok: false, message: "Link yang berisi kredensial tidak diizinkan." };
  return { ok: true, url: u.toString() };
}

/** Strict check for a destination URL before opening it. */
export function isSafeHttpUrl(raw: unknown): raw is string {
  if (typeof raw !== "string" || raw.length > 4096) return false;
  try {
    const u = new URL(raw);
    return (u.protocol === "http:" || u.protocol === "https:") && !!u.hostname;
  } catch {
    return false;
  }
}

export function hostOf(raw: string): string {
  try {
    return new URL(raw).hostname;
  } catch {
    return "";
  }
}

export const THEME_COLORS = ["cyan", "emerald", "blue", "violet", "pink", "orange"] as const;
export type ThemeColor = (typeof THEME_COLORS)[number];
export const THEME_ICONS = ["zap", "link", "shield", "rocket", "sparkles", "globe"] as const;
export type ThemeIcon = (typeof THEME_ICONS)[number];

export type PublicProvider = {
  slug: string;
  name: string;
  description: string;
  color: ThemeColor;
  icon: ThemeIcon;
};

export type BypassErrorCode =
  | "INVALID_URL"
  | "PROVIDER_INACTIVE"
  | "TIMEOUT"
  | "AUTH_FAILED"
  | "INVALID_RESPONSE"
  | "PROVIDER_ERROR"
  | "SERVER_UNAVAILABLE"
  | "RATE_LIMITED"
  | "CONFIG_ERROR";

export type BypassResult =
  | {
      success: true;
      provider: string;
      originalUrl: string;
      destinationUrl: string;
      executionTimeMs: number | null;
    }
  | { success: false; error: { code: BypassErrorCode; message: string } };

export const ERROR_MESSAGES: Record<BypassErrorCode, string> = {
  INVALID_URL: "Link yang dimasukkan tidak valid.",
  PROVIDER_INACTIVE: "Provider sedang tidak aktif. Pilih provider lain.",
  TIMEOUT: "Provider terlalu lama merespons. Coba lagi sebentar lagi.",
  AUTH_FAILED: "Layanan sedang bermasalah dengan autentikasi. Hubungi admin.",
  INVALID_RESPONSE: "Respons provider tidak sesuai format yang diharapkan.",
  PROVIDER_ERROR: "Provider gagal memproses link.",
  SERVER_UNAVAILABLE: "Server tidak tersedia. Periksa koneksi lalu coba lagi.",
  RATE_LIMITED: "Batas penggunaan tercapai. Tunggu sebentar lalu coba lagi.",
  CONFIG_ERROR: "Konfigurasi provider belum lengkap. Hubungi admin.",
};
