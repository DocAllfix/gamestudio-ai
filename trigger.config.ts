import { defineConfig } from "@trigger.dev/sdk";

/**
 * Trigger.dev config. The worker runs the long generation job (full Hermes loop
 * + E2B build) off Vercel's serverless time limit. Tasks live in ./trigger.
 * Project ref comes from TRIGGER_PROJECT_REF (also set in the dashboard).
 */
export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "proj_fztdwwxgpjuelyqqcxsh",
  dirs: ["./trigger"],
  maxDuration: 1800, // 30 min ceiling for a full generation run
});
