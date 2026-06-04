import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-5xl font-bold tracking-tight">
        Game Studio <span className="text-[#7C3AED]">AI</span>
      </h1>
      <p className="max-w-lg text-center text-lg text-gray-400">
        Describe your game. We build it. Play it in seconds.
      </p>
      <div className="flex gap-4">
        <Link
          href="/sign-up"
          className="rounded-lg bg-[#7C3AED] px-6 py-3 font-semibold text-white hover:bg-[#6D28D9]"
        >
          Start for free
        </Link>
        <Link
          href="/sign-in"
          className="rounded-lg border border-white/20 px-6 py-3 font-semibold text-white hover:border-white/40"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
