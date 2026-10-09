import { Globe, Link2, Rocket, Shield, Sparkles, Zap } from "lucide-react";
import type { ThemeIcon } from "@/lib/url";

const MAP = { zap: Zap, link: Link2, shield: Shield, rocket: Rocket, sparkles: Sparkles, globe: Globe };

export function ProviderIcon({ icon, className }: { icon: ThemeIcon | string; className?: string }) {
  const Icon = MAP[icon as ThemeIcon] ?? Zap;
  return <Icon className={className} strokeWidth={2.4} />;
}

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <span
      className="tone-cyan tone-icon font-display font-extrabold"
      style={{ width: size, height: size, fontSize: size * 0.48 }}
      aria-hidden
    >
      Z
    </span>
  );
}
