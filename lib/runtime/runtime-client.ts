/**
 * Turbopack-safe adapter for the W3 runtime mock.
 *
 * lib/_mocks/runtime.mock.ts uses .js ESM imports that Turbopack cannot
 * resolve. This file re-exposes only what the feed needs (a list of mock
 * WebBuildArtifact entries) with clean imports.
 *
 * Replace at W3 merge: swap the mock list for a real Supabase query on
 * the game_plan_versions / build_artifacts table (W3-owned).
 */

export interface FeedBuild {
  project_id: string;
  title: string;
  engine: string;
  genre: string;
  iframe_url: string;
  bundle_size_bytes: number;
  target: "browser" | "pwa";
  /** Static cover image (shown by default + as the hover-preview fallback). */
  cover_url?: string;
  /** Muted, short, low-res gameplay clip for viewport-aware hover preview.
   * Produced by the runtime during the smoke-test (W3, future). When absent
   * the card just shows cover_url. */
  preview_clip_url?: string;
  /** Display name of the creator (for the "by X" credit, Higgsfield-style). */
  author?: string;
}

/** Returns a short list of mock builds for the feed while W3 is unbuilt. */
export function getMockFeedBuilds(): FeedBuild[] {
  return [
    {
      project_id: "00000000-0000-0000-0000-000000000001",
      title: "Neon Platformer",
      engine: "godot",
      genre: "platformer",
      iframe_url: "https://mock-r2.example.com/games/neon-platformer/index.html",
      bundle_size_bytes: 4 * 1024 * 1024,
      target: "browser",
    },
    {
      project_id: "00000000-0000-0000-0000-000000000002",
      title: "Pixel Dungeon",
      engine: "phaser",
      genre: "roguelike",
      iframe_url: "https://mock-r2.example.com/games/pixel-dungeon/index.html",
      bundle_size_bytes: 2 * 1024 * 1024,
      target: "pwa",
    },
    {
      project_id: "00000000-0000-0000-0000-000000000003",
      title: "Visual Novel Demo",
      engine: "renpy",
      genre: "visual_novel",
      iframe_url: "https://mock-r2.example.com/games/vn-demo/index.html",
      bundle_size_bytes: 8 * 1024 * 1024,
      target: "browser",
    },
  ];
}
