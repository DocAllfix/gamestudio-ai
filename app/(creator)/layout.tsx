export default function CreatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <div className="border-b border-white/10 px-6 py-3">
        <span className="text-sm font-semibold">
          Game Studio <span className="text-[#7C3AED]">AI</span>
        </span>
      </div>
      <div className="px-6 py-4">{children}</div>
    </div>
  );
}
