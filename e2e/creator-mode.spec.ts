/**
 * E2E test: Creator Mode 5-step flow with mocks.
 *
 * Prerequisites:
 *   - A running Next.js server (npm run start or npm run dev).
 *   - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY set to a real test key OR
 *     auth disabled (E2E_SKIP_AUTH=1 env var).
 *
 * Run: npx playwright test e2e/creator-mode.spec.ts
 */
import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

test.describe("Creator Mode 5-step flow", () => {
  test("step 1 → 5 completes with mock orchestrator", async ({ page }) => {
    await page.goto(`${BASE}/create`);

    // If Clerk redirected to sign-in, skip — auth is not set up in CI.
    if (page.url().includes("/sign-in")) {
      test.skip(true, "Clerk auth required — set real CLERK keys to run this test");
    }

    // --- Step 1: Welcome ---
    await expect(page.getByTestId("step-welcome")).toBeVisible();
    await page.getByTestId("prompt-input").fill(
      "A hardcore platformer where the world flips every 10 seconds",
    );
    await page.getByTestId("next-step-1").click();

    // --- Step 2: Engine picker ---
    await expect(page.getByTestId("step-engine-picker")).toBeVisible();
    // Click Godot (recommended engine)
    await page.getByTestId("engine-godot").click();

    // --- Step 3: Plan preview ---
    await expect(page.getByTestId("step-plan-preview")).toBeVisible();
    // Wait for the mock plan to load (async call)
    await expect(page.getByTestId("dag-nodes")).toBeVisible({ timeout: 5000 });
    // At least one DAG node must be visible — bound to execution_dag fields
    const dagNodes = page.getByTestId(/^dag-node-/);
    await expect(dagNodes.first()).toBeVisible();
    // Generate
    await page.getByTestId("generate-btn").click();

    // --- Step 4: Generating ---
    await expect(page.getByTestId("step-generating")).toBeVisible();
    // Progress bar must exist and node-results must render
    await expect(page.getByTestId("progress-bar")).toBeVisible();
    await expect(page.getByTestId("node-results")).toBeVisible();
    // Wait for auto-advance to step 5 (generation animation ~2s)
    await expect(page.getByTestId("step-output")).toBeVisible({ timeout: 10_000 });

    // --- Step 5: Output ---
    // Verdict badges must render from final_report.verdicts
    await expect(page.getByTestId("verdict-badges")).toBeVisible();
    const badges = page.getByTestId(/^verdict-/);
    await expect(badges.first()).toBeVisible();
    // "Create another" resets to step 1
    await page.getByTestId("create-another-btn").click();
    await expect(page.getByTestId("step-welcome")).toBeVisible();
  });
});
