import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getBranding, DEFAULT_BRANDING } from "@/lib/public.functions";
import { Globe, Link2, Rocket, Shield, Sparkles, Zap } from "lucide-react";
import type { ThemeIcon } from "@/lib/url";

const MAP = { zap: Zap, link: Link2, shield: Shield, rocket: Rocket, sparkles: Sparkles, globe: Globe };

export function ProviderIcon({ icon, className }: { icon: ThemeIcon | string; className?: string }) {
  const Icon = MAP[icon as ThemeIcon] ?? Zap;
  return <Icon className={className} strokeWidth={2.4} />;
}

export function Logo({ size = 36 }: { size?: number }) {
  const fn = useServerFn(getBranding);
  const { data } = useQuery({ queryKey: ["branding"], queryFn: () => fn(), staleTime: 60_000 });
  const b = data ?? DEFAULT_BRANDING;
  if (b.mode === "image" && b.imageUrl) {
    return (
      <img src={b.imageUrl} alt="Logo" className="shrink-0 object-cover"
        style={{ width: size, height: size, borderRadius: 12 }} />
    );
  }
  return (
    <span
      className="font-display font-extrabold inline-flex shrink-0 items-center justify-center text-ink"
      style={{
        width: size, height: size, fontSize: size * 0.48, borderRadius: 12,
        background: `linear-gradient(135deg, ${b.from}, ${b.to})`,
        boxShadow: "0 6px 14px oklch(0 0 0 / 0.4), inset 0 2px 0 oklch(1 0 0 / 0.35)",
      }}
      aria-hidden
    >
      {b.letter}
    </span>
  );
}
