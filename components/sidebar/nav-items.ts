import type { LucideIcon } from "lucide-react";
import { Gamepad2, Layers, BarChart2, Settings, Zap, Rss, Hammer } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Create", href: "/create", icon: Zap },
  { label: "Studio", href: "/studio", icon: Hammer },
  { label: "Feed", href: "/feed", icon: Rss },
  { label: "Projects", href: "/projects", icon: Gamepad2 },
  { label: "Assets", href: "/assets", icon: Layers },
  { label: "Analytics", href: "/analytics", icon: BarChart2 },
  { label: "Settings", href: "/settings", icon: Settings },
];
