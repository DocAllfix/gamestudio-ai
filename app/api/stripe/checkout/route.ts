import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createCheckoutSession } from "@/lib/billing/checkout";
import { createTipJarSession, TIP_AMOUNTS_USD, type TipAmount } from "@/lib/billing/tip-jar";
import type { UserTier } from "@/lib/contracts/billing.contract";

export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const body = (await req.json()) as {
    mode: "upgrade" | "tip";
    tier?: UserTier;
    tipAmount?: number;
  };

  const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    if (body.mode === "upgrade") {
      if (!body.tier || body.tier === "free") {
        return Response.json({ error: "Invalid tier" }, { status: 400 });
      }
      const { url } = await createCheckoutSession(
        userId,
        body.tier as Exclude<UserTier, "free">,
        `${origin}/settings?upgraded=1`,
        `${origin}/settings`,
      );
      return Response.json({ url });
    }

    if (body.mode === "tip") {
      const amt = body.tipAmount as TipAmount;
      if (!(TIP_AMOUNTS_USD as readonly number[]).includes(amt)) {
        return Response.json({ error: "Invalid tip amount" }, { status: 400 });
      }
      const { url } = await createTipJarSession(
        amt,
        `${origin}/feed?tip=thanks`,
        `${origin}/feed`,
      );
      return Response.json({ url });
    }

    return Response.json({ error: "Unknown mode" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error({ msg: "checkout route error", err });
    return Response.json({ error: msg }, { status: 500 });
  }
}
