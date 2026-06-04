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
    const primaryEmail = user.email_addresses.find(
      (e) => e.id === user.primary_email_address_id,
    );
    if (!primaryEmail) {
      return new Response("No primary email", { status: 400 });
    }

    const displayName =
      [user.first_name, user.last_name].filter(Boolean).join(" ") || null;

    await upsertUser(db, {
      clerk_user_id: user.id,
      email: primaryEmail.email_address,
      display_name: displayName,
    });
  }

  return new Response(null, { status: 200 });
}
