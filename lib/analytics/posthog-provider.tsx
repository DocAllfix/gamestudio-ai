"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { useUser } from "@clerk/nextjs";

/**
 * Initialises posthog-js once on mount and identifies the Clerk user.
 * Drop this in root layout (inside ClerkProvider, client-side only).
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host =
      process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";
    if (!key) return;

    posthog.init(key, {
      api_host: host,
      capture_pageview: true,
      persistence: "localStorage",
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    posthog.identify(user.id, {
      email: user.primaryEmailAddress?.emailAddress,
      name: user.fullName,
    });
  }, [user]);

  return <>{children}</>;
}
