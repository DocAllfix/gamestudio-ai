/**
 * Shared types for the Game Studio AI Knowledge Base client.
 *
 * Mirrors the RPC return shapes defined in
 * `supabase/migrations/001_knowledge_base.sql` and the query shapes
 * documented in `docs/SUPREME_RAG_BLUEPRINT.md` §04.2.
 *
 * Every tool in `lib/tools/` will import from here before calling the
 * KB — there is no other source of truth for these shapes.
 */

export type ChunkType = "full_recipe" | "single_mechanic" | "structural_pattern";

export type Complexity = "basic" | "intermediate" | "advanced";

export interface CodeReference {
  id: string;
  engine: string;
  primary_category: string;
  subcategories: string[];
  chunk_type: ChunkType;
  genre_tags: string[];
  key_features: string[];
  complexity: Complexity;
  quality_score: number;
  reusability_score: number;
  confidence_score: number;
  summary: string;
  code: string;
  source_repo: string | null;
  source_license: string | null;
  similarity: number;
}

export interface ParameterReference {
  id: string;
  source_repo: string | null;
  parameters: Record<string, unknown>;
  context: string | null;
  quality_score: number;
}

export interface ReferenceQuery {
  engine: string;
  category?: string;
  genres?: string[];
  features?: string[];
  complexity?: Complexity;
  chunkType?: ChunkType;
  minQuality?: number;
  minConfidence?: number;
  semanticQuery?: string;
  maxResults?: number;
}

export interface ParameterQuery {
  engine: string;
  genre: string;
  parameterGroup: string;
  minQuality?: number;
  maxResults?: number;
}
