import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { WebhookEvent } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { upsertUser } from "@/lib/auth/upsert-user";

export async function POST(req: NextRequest): Promise<Response> {
  let event: WebhookEvent;
  try {
    event = await verifyWebhook(req);
  } catch {
    return new Response("Invalid webhook signature", { status: 400 });
  }

  const db = getAdminClient();

  if (event.type === "user.created" || event.type === "user.updated") {
    const user = event.data;
    // Prefer the primary email, fall back to the first one, then a placeholder.
    // Never 400 here: a missing/odd email (OAuth, passkey, Clerk's test payload)
    // must not block user creation — the account still needs a row.
    const email =
      user.email_addresses.find((e) => e.id === user.primary_email_address_id)?.email_address ??
      user.email_addresses[0]?.email_address ??
      `${user.id}@placeholder.local`;

    const displayName =
      [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || null;

    await upsertUser(db, {
      clerk_user_id: user.id,
      email,
      display_name: displayName,
    });
  }

  return new Response(null, { status: 200 });
}
