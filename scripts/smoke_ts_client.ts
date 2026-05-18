/**
 * Smoke test: certifies lib/knowledge.ts can reach the deployed schema.
 *
 * Loads .env (via dotenv), calls getReferences against an empty DB and
 * expects an empty array — proves the RPC signature matches the migration
 * and the service role can read.
 */
import "dotenv/config";
import { getReferences, getReferenceParameters } from "../lib/knowledge.js";

async function main(): Promise<void> {
  console.log("[smoke] getReferences({engine: 'godot'})...");
  const refs = await getReferences({ engine: "godot" });
  console.log("[smoke] result:", Array.isArray(refs) ? `[] (length ${refs.length})` : refs);

  console.log("[smoke] getReferenceParameters({engine:'godot',genre:'platformer',parameterGroup:'player_physics'})...");
  const params = await getReferenceParameters({
    engine: "godot",
    genre: "platformer",
    parameterGroup: "player_physics",
  });
  console.log("[smoke] result:", Array.isArray(params) ? `[] (length ${params.length})` : params);

  if (Array.isArray(refs) && Array.isArray(params) && refs.length === 0 && params.length === 0) {
    console.log("[smoke] PASS — KB client reaches Supabase, schema matches, RPCs return empty.");
  } else {
    console.error("[smoke] FAIL — unexpected results");
    process.exit(1);
  }
}

main().catch((e: unknown) => {
  console.error("[smoke] error:", e);
  process.exit(1);
});
