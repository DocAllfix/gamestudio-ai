"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-white/10 bg-[#0F0F0F]">
      {/* Brand */}
      <div className="flex h-14 items-center gap-2 border-b border-white/10 px-4">
        <span className="text-[#7C3AED] font-bold text-lg">GS</span>
        <span className="font-semibold text-sm text-white/90">Game Studio AI</span>
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
                  ? "bg-[#7C3AED]/20 text-[#A78BFA] font-medium"
                  : "text-white/50 hover:bg-white/5 hover:text-white/80",
              )}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="flex items-center gap-3 border-t border-white/10 px-4 py-3">
        <UserButton />
        <span className="text-xs text-white/40">Account</span>
      </div>
    </aside>
  );
}
