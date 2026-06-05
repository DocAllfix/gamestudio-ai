"use server";

import { auth } from "@clerk/nextjs/server";
import { getAdminClient } from "@/lib/supabase/admin";

export type StudioAssetType =
  | "sprite"
  | "tileset"
  | "model_3d"
  | "material"
  | "audio_bgm"
  | "audio_sfx"
  | "audio_voice"
  | "font"
  | "image";

export interface LibraryAsset {
  id: string;
  asset_type: StudioAssetType;
  url: string;
  style_pack_id: string | null;
  origin: string;
  license: string;
  favorite: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

async function resolveUserId(): Promise<{ db: ReturnType<typeof getAdminClient>; userId: string } | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const db = getAdminClient();
  const { data, error } = await db.from("users").select("id").eq("clerk_user_id", userId).single();
  if (error || !data) return null;
  return { db, userId: data.id };
}

/** List the current user's library, newest + favourites first. */
export async function listLibrary(assetType?: StudioAssetType): Promise<LibraryAsset[]> {
  const ctx = await resolveUserId();
  if (!ctx) return [];
  let q = ctx.db
    .from("project_assets")
    .select("id, asset_type, url, style_pack_id, origin, license, favorite, metadata, created_at")
    .eq("user_id", ctx.userId)
    .order("favorite", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (assetType) q = q.eq("asset_type", assetType);
  const { data, error } = await q;
  if (error || !data) return [];
  return data as LibraryAsset[];
}

export interface SaveAssetInput {
  asset_type: StudioAssetType;
  url: string;
  style_pack_id?: string;
  origin?: "studio" | "uploaded" | "extracted";
  metadata?: Record<string, unknown>;
  project_id?: string;
}

export type SaveResult = { ok: true; id: string } | { ok: false; error: string };

/** Save an asset the user generated/curated/extracted into their library. */
export async function saveToLibrary(input: SaveAssetInput): Promise<SaveResult> {
  const ctx = await resolveUserId();
  if (!ctx) return { ok: false, error: "Not authenticated" };
  const { data, error } = await ctx.db
    .from("project_assets")
    .insert({
      user_id: ctx.userId,
      project_id: input.project_id ?? null,
      asset_type: input.asset_type,
      url: input.url,
      style_pack_id: input.style_pack_id ?? null,
      origin: input.origin ?? "studio",
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not save asset" };
  return { ok: true, id: data.id };
}

/** Toggle the favourite flag (library curation). */
export async function toggleFavorite(assetId: string, favorite: boolean): Promise<{ ok: boolean }> {
  const ctx = await resolveUserId();
  if (!ctx) return { ok: false };
  const { error } = await ctx.db
    .from("project_assets")
    .update({ favorite })
    .eq("id", assetId)
    .eq("user_id", ctx.userId);
  return { ok: !error };
}
