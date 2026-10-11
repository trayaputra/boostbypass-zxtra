import { Globe, Link2, Rocket, Shield, Sparkles, Zap } from "lucide-react";
import type { ThemeIcon } from "@/lib/url";

const MAP = { zap: Zap, link: Link2, shield: Shield, rocket: Rocket, sparkles: Sparkles, globe: Globe };

export function ProviderIcon({ icon, className }: { icon: ThemeIcon | string; className?: string }) {
  const Icon = MAP[icon as ThemeIcon] ?? Zap;
  return <Icon className={className} strokeWidth={2.4} />;
}

// ============================================================
// KONFIGURASI LOGO NEXORA — cukup ubah nilai di bawah ini
// mode: "letter" = huruf dengan warna gradien
//       "image"  = gambar/logo sendiri (isi imageUrl dengan URL https)
// ============================================================
export const LOGO_CONFIG = {
  mode: "letter" as "letter" | "image",
  letter: "Z",
  imageUrl: "", // contoh: "https://i.ibb.co/xxxx/logo.png" (kosongkan jika mode "letter")
  imageAlt: "Logo NEXORA",
  gradient: "linear-gradient(135deg, var(--cyan), var(--emerald))",
  textColor: "var(--ink, #10131D)",
  rounded: 12, // kelengkungan sudut dalam px
  shadow: "0 6px 14px oklch(0 0 0 / 0.4), inset 0 2px 0 oklch(1 0 0 / 0.35)",
};

export function Logo({ size = 36 }: { size?: number }) {
  if (LOGO_CONFIG.mode === "image" && LOGO_CONFIG.imageUrl) {
    return (
      <img
        src={LOGO_CONFIG.imageUrl}
        alt={LOGO_CONFIG.imageAlt}
        className="shrink-0 object-cover"
        style={{ width: size, height: size, borderRadius: LOGO_CONFIG.rounded }}
      />
    );
  }
  return (
    <span
      className="font-display font-extrabold inline-flex shrink-0 items-center justify-center"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.48,
        background: LOGO_CONFIG.gradient,
        color: LOGO_CONFIG.textColor,
        borderRadius: LOGO_CONFIG.rounded,
        boxShadow: LOGO_CONFIG.shadow,
      }}
      aria-hidden
    >
      {LOGO_CONFIG.letter}
    </span>
  );
}
