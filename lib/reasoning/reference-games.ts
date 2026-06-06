/**
 * Reference-game retrieval for the Game Designer (D.1).
 *
 * The KB holds 80 shipped games with a Claude-Vision `visual_analysis`
 * (mood, art_direction, lighting, palette, UI pattern, notable elements).
 * Anchoring the design to *real* games — instead of letting the LLM invent
 * a generic "energetic and colorful" mood — is the data moat: grounded,
 * recognizable direction a generic prompt-enhancer can't produce.
 *
 * We fetch a few references whose genre_tags overlap the chosen genre and
 * distill them into a compact text block injected into the designer prompt.
 * Best-effort: any failure returns "" so the designer still runs (graceful
 * degradation, like lib/knowledge.ts).
 */
import type { Genre } from "../contracts/game-plan.contract.js";

interface VisualAnalysis {
    mood?: string;
    art_direction?: string;
    lighting_style?: string;
    dominant_palette?: string | string[];
    ui_layout_pattern?: string;
    notable_visual_elements?: string[];
}

interface ReferenceGameRow {
    title: string;
    genre_tags: string[] | null;
    notable_features: string[] | null;
    visual_analysis: VisualAnalysis | null;
}

export interface ReferenceGamesDeps {
    fetchByGenre(genre: string, limit: number): Promise<ReferenceGameRow[]>;
}

async function defaultFetchByGenre(genre: string, limit: number): Promise<ReferenceGameRow[]> {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return [];
    try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(url, key);
        // genre_tags is a text[]; `contains` matches rows tagged with this genre.
        const { data, error } = await supabase
            .from("reference_games")
            .select("title, genre_tags, notable_features, visual_analysis")
            .contains("genre_tags", [genre])
            .not("visual_analysis", "is", null)
            .limit(limit);
        if (error) {
            console.error({ context: "reference_games.fetchByGenre", genre, error: error.message });
            return [];
        }
        return (data ?? []) as ReferenceGameRow[];
    } catch (error) {
        console.error({ context: "reference_games.fetchByGenre", genre, error });
        return [];
    }
}

function palette(p: VisualAnalysis["dominant_palette"]): string {
    if (Array.isArray(p)) return p.slice(0, 5).join(", ");
    return typeof p === "string" ? p : "";
}

/** One compact line per reference game for the designer prompt. */
function summarize(row: ReferenceGameRow): string | null {
    const v = row.visual_analysis;
    if (!v) return null;
    const parts = [
        v.mood && `mood: ${v.mood}`,
        v.art_direction && `art: ${v.art_direction}`,
        palette(v.dominant_palette) && `palette: ${palette(v.dominant_palette)}`,
        v.notable_visual_elements?.length && `notable: ${v.notable_visual_elements.slice(0, 3).join(", ")}`,
    ].filter(Boolean);
    return parts.length > 0 ? `- ${row.title} — ${parts.join("; ")}` : null;
}

/**
 * Build a grounding block of real reference games for a genre, or "" when
 * none are found. Capped at `limit` games.
 */
export async function referenceGroundingFor(
    genre: Genre,
    deps: ReferenceGamesDeps = { fetchByGenre: defaultFetchByGenre },
    limit = 3,
): Promise<string> {
    let rows: ReferenceGameRow[];
    try {
        rows = await deps.fetchByGenre(genre, limit);
    } catch (error) {
        // Never let reference retrieval break the design step.
        console.error({ context: "reference_games.referenceGroundingFor", genre, error });
        return "";
    }
    const lines = rows.map(summarize).filter((l): l is string => l !== null);
    if (lines.length === 0) return "";
    return [
        `Real shipped ${genre} games to anchor your visual + design direction`,
        "(borrow their feel, don't copy):",
        ...lines,
    ].join("\n");
}
