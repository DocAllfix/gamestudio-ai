import Link from "next/link";
import { AnvilMark } from "@/components/brand/anvil-mark";

export default function CreatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-ink text-text">
      {/* Minimal top nav — brand mark only, no distractions in creator flow */}
      <div className="flex items-center border-b border-surface-2 px-6 py-3">
        <Link href="/" className="flex items-center gap-2">
          <AnvilMark size={20} className="text-text" label={null} />
          <span className="font-display text-sm font-bold">
            Game<span className="text-forge">Smith</span>
          </span>
        </Link>
      </div>
      <div className="px-6 py-4">{children}</div>
    </div>
  );
}
