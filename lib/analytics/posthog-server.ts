import { PostHog } from "posthog-node";

let _ph: PostHog | null = null;

/** Lazy singleton — server-side PostHog client. Never import in browser code. */
export function getPostHogServer(): PostHog {
  if (_ph) return _ph;
  const key = process.env.POSTHOG_KEY;
  const host = process.env.POSTHOG_HOST ?? "https://eu.i.posthog.com";
  if (!key) throw new Error("Missing POSTHOG_KEY");
  _ph = new PostHog(key, { host, flushAt: 1, flushInterval: 0 });
  return _ph;
}
