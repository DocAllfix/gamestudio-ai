"use server";

import { getAdminClient } from "@/lib/supabase/admin";

/** The public, shareable view of a forged game. Only what the /play page
 * needs — never the owner's identity or internal run state. */
export interface PublicGame {
    project_id: string;
    title: string;
    engine: string;
    genre: string;
    iframe_url: string;
}

/**
 * Load a finished game's playable build by project id. Returns null when the
 * project doesn't exist, isn't done, or has no web export — the page renders
 * a "not playable" state rather than 500ing. Reads the validated
 * HermesPlanResponse stored in generation_runs.response.
 */
export async function getPublicGame(projectId: string): Promise<PublicGame | null> {
    try {
        const db = getAdminClient();
        const { data, error } = await db
            .from("generation_runs")
            .select("response, status")
            .eq("project_id", projectId)
            .eq("status", "done")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error("getPublicGame query failed", { projectId, error: error.message });
            return null;
        }
        if (!data?.response) return null;

        const r = data.response as {
            iframe_url?: string | null;
            final_plan?: { meta?: { title?: string; engine?: string; genre?: string } };
        };
        if (!r.iframe_url) return null;

        return {
            project_id: projectId,
            title: r.final_plan?.meta?.title ?? "Untitled game",
            engine: r.final_plan?.meta?.engine ?? "",
            genre: (r.final_plan?.meta?.genre ?? "").replace(/_/g, " "),
            iframe_url: r.iframe_url,
        };
    } catch (error) {
        console.error("getPublicGame failed", {
            projectId,
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}
