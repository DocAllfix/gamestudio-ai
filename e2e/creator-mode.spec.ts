/**
 * E2E test: Creator Mode progressive-disclosure flow with mocks.
 *
 * The rigid 5-step wizard was replaced by a single setup screen
 * (idea + proposed engine, Auto by default + collapsible Advanced) that, on
 * submit, drives plan → generating → output as phases.
 *
 * Prerequisites:
 *   - A running Next.js server (npm run start or npm run dev).
 *   - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY set to a real test key OR auth disabled.
 *
 * Run: npx playwright test e2e/creator-mode.spec.ts
 */
import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

test.describe("Creator Mode — progressive disclosure", () => {
  test("idea → plan → generating → output, with mock orchestrator", async ({ page }) => {
    // Enter via the invitation prompt (deep-link into the setup screen).
    await page.goto(
      `${BASE}/create?prompt=${encodeURIComponent("A hardcore platformer where the world flips every 10 seconds")}`,
    );

    if (page.url().includes("/sign-in")) {
      test.skip(true, "Clerk auth required — set real CLERK keys to run this test");
    }

    // --- Setup phase: prompt prefilled from the URL, engine defaults to Auto ---
    await expect(page.getByTestId("prompt-input")).toHaveValue(/world flips/);
    await page.getByTestId("forge-btn").click();

    // --- Plan phase ---
    await expect(page.getByTestId("step-plan-preview")).toBeVisible();
    await expect(page.getByTestId("dag-nodes")).toBeVisible({ timeout: 5000 });
    const dagNodes = page.getByTestId(/^dag-node-/);
    await expect(dagNodes.first()).toBeVisible();
    await page.getByTestId("generate-btn").click();

    // --- Generating phase ---
    await expect(page.getByTestId("step-generating")).toBeVisible();
    await expect(page.getByTestId("progress-bar")).toBeVisible();
    await expect(page.getByTestId("node-results")).toBeVisible();
    await expect(page.getByTestId("step-output")).toBeVisible({ timeout: 10_000 });

    // --- Output phase: verdict badges from final_report.verdicts ---
    await expect(page.getByTestId("verdict-badges")).toBeVisible();
    const badges = page.getByTestId(/^verdict-/);
    await expect(badges.first()).toBeVisible();
    // "Create another" resets to the setup screen
    await page.getByTestId("create-another-btn").click();
    await expect(page.getByTestId("forge-btn")).toBeVisible();
  });
});
