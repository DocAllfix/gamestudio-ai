import type { LucideIcon } from "lucide-react";
import { Gamepad2, Layers, BarChart2, Settings, Zap, Rss } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Crea", href: "/create", icon: Zap },
  { label: "Feed", href: "/feed", icon: Rss },
  { label: "Progetti", href: "/projects", icon: Gamepad2 },
  { label: "Asset", href: "/assets", icon: Layers },
  { label: "Analytics", href: "/analytics", icon: BarChart2 },
  { label: "Impostazioni", href: "/settings", icon: Settings },
];
