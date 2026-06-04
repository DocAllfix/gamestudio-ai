"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-surface-2 bg-surface">
      {/* Brand */}
      <div className="flex h-14 items-center gap-2 border-b border-surface-2 px-4">
        {/* Pixel-art forge accent — the GameSmith signature mark */}
        <span className="text-forge font-display font-bold text-lg leading-none">GS</span>
        <span className="font-display font-semibold text-sm text-text">GameSmith</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                active
                  ? "bg-forge/10 text-forge font-medium border-r-2 border-forge"
                  : "text-text-muted hover:bg-surface-2 hover:text-text",
              )}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="flex items-center gap-3 border-t border-surface-2 px-4 py-3">
        <UserButton />
        <span className="text-xs text-text-muted">Account</span>
      </div>
    </aside>
  );
}
