"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { AnvilMark } from "@/components/brand/anvil-mark";
import { NAV_ITEMS } from "./nav-items";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-surface-2 bg-surface">
      {/* Brand — the pixel anvil mark + wordmark */}
      <Link href="/" className="flex h-14 items-center gap-2 border-b border-surface-2 px-4">
        <AnvilMark size={22} className="text-text" label={null} />
        <span className="font-display text-sm font-semibold text-text">
          Game<span className="text-forge">Smith</span>
        </span>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "mx-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-forge/12 font-medium text-forge"
                  : "text-text-muted hover:bg-surface-2 hover:text-text",
              )}
            >
              <Icon size={16} className={active ? "text-forge" : ""} />
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
