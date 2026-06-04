export default function CreatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-ink text-text">
      {/* Minimal top nav — brand mark only, no distractions in creator flow */}
      <div className="border-b border-surface-2 px-6 py-3">
        <span className="font-display text-sm font-bold">
          Game<span className="text-forge">Smith</span>
        </span>
      </div>
      <div className="px-6 py-4">{children}</div>
    </div>
  );
}
