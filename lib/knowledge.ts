/**
 * Knowledge Base client for Game Studio AI.
 *
 * Every code-generating tool calls `getReferences()` (and optionally
 * `getReferenceParameters()`) before talking to an LLM. The retrieved
 * chunks are then formatted by `buildReferenceContext()` and injected
 * into the tool's prompt as grounding examples — see
 * `docs/SUPREME_RAG_BLUEPRINT.md` §04.
 *
 * Graceful degradation is non-negotiable: if Supabase or OpenAI fail,
 * these functions return `[]` rather than throwing so the calling tool
 * still produces output (unboosted) instead of crashing the whole flow.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";

import type {
  CodeReference,
  ParameterQuery,
  ParameterReference,
  ReferenceQuery,
} from "./types.js";

const EMBEDDING_MODEL = "text-embedding-3-small";
const DEFAULT_MIN_QUALITY = 3;
const DEFAULT_MIN_CONFIDENCE = 85;
const DEFAULT_MAX_RESULTS = 5;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

let cachedSupabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (cachedSupabase === null) {
    cachedSupabase = createClient(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );
  }
  return cachedSupabase;
}

let cachedOpenAI: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (cachedOpenAI === null) {
    cachedOpenAI = new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") });
  }
  return cachedOpenAI;
}

async function embedQuery(semanticQuery: string): Promise<number[] | null> {
  try {
    const response = await getOpenAI().embeddings.create({
      model: EMBEDDING_MODEL,
      input: semanticQuery,
    });
    const embedding = response.data[0]?.embedding;
    return embedding ?? null;
  } catch (error) {
    console.error({ context: "knowledge.embedQuery", semanticQuery, error });
    return null;
  }
}

export async function getReferences(
  query: ReferenceQuery,
): Promise<CodeReference[]> {
  let queryEmbedding: number[] | null = null;
  if (query.semanticQuery) {
    queryEmbedding = await embedQuery(query.semanticQuery);
    if (queryEmbedding === null) {
      // The embedding failed but we still proceed: search_code_knowledge
      // falls back to filter-only when p_query_embedding is null.
    }
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc("search_code_knowledge", {
      p_engine: query.engine,
      p_category: query.category ?? null,
      p_genres: query.genres ?? null,
      p_features: query.features ?? null,
      p_complexity: query.complexity ?? null,
      p_chunk_type: query.chunkType ?? null,
      p_min_quality: query.minQuality ?? DEFAULT_MIN_QUALITY,
      p_min_confidence: query.minConfidence ?? DEFAULT_MIN_CONFIDENCE,
      p_query_embedding: queryEmbedding ? `[${queryEmbedding.join(",")}]` : null,
      p_limit: query.maxResults ?? DEFAULT_MAX_RESULTS,
    });

    if (error) {
      console.error({ context: "knowledge.getReferences.rpc", query, error });
      return [];
    }

    const refs = (data ?? []) as CodeReference[];

    if (refs.length > 0) {
      const ids = refs.map((r) => r.id);
      void supabase
        .rpc("increment_retrieval_count", { p_ids: ids })
        .then(({ error: incError }) => {
          if (incError) {
            console.error({
              context: "knowledge.incrementRetrievalCount",
              ids,
              error: incError,
            });
          }
        });
    }

    return refs;
  } catch (error) {
    console.error({ context: "knowledge.getReferences", query, error });
    return [];
  }
}

export async function getReferenceParameters(
  query: ParameterQuery,
): Promise<ParameterReference[]> {
  try {
    const { data, error } = await getSupabase().rpc("get_reference_parameters", {
      p_engine: query.engine,
      p_genre: query.genre,
      p_parameter_group: query.parameterGroup,
      p_min_quality: query.minQuality ?? DEFAULT_MIN_QUALITY,
      p_limit: query.maxResults ?? DEFAULT_MAX_RESULTS,
    });

    if (error) {
      console.error({
        context: "knowledge.getReferenceParameters.rpc",
        query,
        error,
      });
      return [];
    }

    return (data ?? []) as ParameterReference[];
  } catch (error) {
    console.error({ context: "knowledge.getReferenceParameters", query, error });
    return [];
  }
}

export function buildReferenceContext(
  codeRefs: CodeReference[],
  paramRefs: ParameterReference[],
): string {
  const parts: string[] = [];

  if (codeRefs.length > 0) {
    parts.push("=== REFERENCE CODE FROM REAL GAMES ===\n");
    for (const ref of codeRefs) {
      const source = ref.source_repo ?? "unknown";
      const features = ref.key_features.length > 0
        ? ref.key_features.join(", ")
        : "none";
      parts.push(
        `--- Reference: ${ref.summary} ---\n` +
          `Source: ${source} | Quality: ${ref.quality_score}/5 | ` +
          `Features: ${features}\n` +
          "```\n" +
          ref.code +
          "\n```\n",
      );
    }
  }

  if (paramRefs.length > 0) {
    parts.push("=== REFERENCE PARAMETERS FROM REAL GAMES ===\n");
    parts.push(
      "These numerical values come from published, well-received games.\n" +
        "Use them as a starting point, not as absolute constraints.\n",
    );
    for (const ref of paramRefs) {
      const source = ref.source_repo ?? "unknown";
      parts.push(
        `Source: ${source} | Quality: ${ref.quality_score}/5\n` +
          `Parameters: ${JSON.stringify(ref.parameters, null, 2)}\n`,
      );
    }
  }

  return parts.join("\n");
}
