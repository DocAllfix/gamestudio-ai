/**
 * Code validators for the code_gen self-heal loop.
 *
 * Given generated source for an engine, run the engine's real parser/compiler
 * in an E2B sandbox and return the errors (or null when it's clean). The
 * code_gen tool feeds the errors back to the LLM and retries. This is the only
 * reliable guarantee that generated code targets the right engine version
 * (the LLM keeps mixing Godot 3/4, Python-isms, etc.).
 */
import { createRealDeps } from "./sandbox/real-clients.js";
import { bootSandbox } from "./sandbox/e2b.js";

/** Validate Godot 4 GDScript with `--check-only` (parses, doesn't run). Returns
 * the SCRIPT/parse errors, or null when the script is valid. Best-effort: on
 * any infrastructure error returns null (don't block generation on a flaky
 * sandbox — the build/smoke still gate later). */
async function validateGodot(rawCode: string): Promise<string | null> {
    // Validate the SAME sanitized code the scaffold will build, so the
    // self-heal loop sees the real post-sanitizer errors.
    const { sanitizeGodot4 } = await import("./assembler/scaffold.js");
    const code = sanitizeGodot4(rawCode);
    let sandbox;
    try {
        const deps = createRealDeps();
        sandbox = await bootSandbox(deps.e2b);
        // Minimal project so the script resolves as a Node2D scene script.
        await sandbox.writeFile("/check/project.godot", 'config_version=5\n[application]\nconfig/name="check"\n');
        await sandbox.writeFile("/check/main.gd", code);
        // 1. Syntax: --check-only (parses, doesn't run).
        const checkRes = await sandbox.runCommand(
            "cd /check && GODOT_SILENCE_ROOT_WARNING=1 godot --headless --path /check --check-only --script main.gd 2>&1; true",
        );
        const checkOut = `${checkRes.stdout}\n${checkRes.stderr}`;
        const parseErrors = checkOut
            .split("\n")
            .filter((l) => /SCRIPT ERROR|Parse Error|ERROR:.*main\.gd|error\(/i.test(l));
        if (parseErrors.length > 0) return parseErrors.join("\n");

        // 2. RUNTIME: actually run the scene headless for a moment. This is the
        // universal catch for "compiles but crashes" errors (bad signal
        // callbacks, null refs, wrong types, missing nodes) that --check-only
        // can't see — instead of letting them reach the smoke and trigger a full
        // regeneration, the self-heal sees the USER ERROR and retries here.
        // A main scene so _ready/_process/_physics_process and signal wiring run.
        await sandbox.writeFile(
            "/check/main.tscn",
            '[gd_scene load_steps=2 format=3]\n[ext_resource type="Script" path="res://main.gd" id="1"]\n[node name="Main" type="Node2D"]\nscript = ExtResource("1")\n',
        );
        await sandbox.writeFile(
            "/check/project.godot",
            'config_version=5\n[application]\nconfig/name="check"\nrun/main_scene="res://main.tscn"\n',
        );
        const runRes = await sandbox.runCommand(
            // Run a few frames then quit; --quit-after exits after N frames (4.x).
            "cd /check && GODOT_SILENCE_ROOT_WARNING=1 timeout 30 godot --headless --path /check --quit-after 120 2>&1; true",
        );
        const runOut = `${runRes.stdout}\n${runRes.stderr}`;
        const runtimeErrors = runOut
            .split("\n")
            .filter((l) => /USER ERROR|SCRIPT ERROR|Cannot convert|can't be assigned|Null instance|nonexistent (function|signal)|Invalid (call|get index|set index)/i.test(l));
        return runtimeErrors.length > 0 ? runtimeErrors.slice(0, 8).join("\n") : null;
    } catch (error) {
        console.error("validateGodot failed (skipping validation): " + (error instanceof Error ? error.message : String(error)));
        return null;
    } finally {
        await sandbox?.close().catch(() => {});
    }
}

/**
 * Dispatch a validator by engine. Returns null (no validation) for engines we
 * don't validate yet, so the loop runs once. Currently: Godot.
 */
export async function validateCode(args: { engine: string; code: string }): Promise<string | null> {
    if (args.engine === "godot") return validateGodot(args.code);
    return null;
}

/** Identifiers worth looking up (PascalCase classes, snake_case methods),
 * skipping common keywords so we query the API docs, not noise. */
const SYMBOL_RE = /\b([A-Z][A-Za-z0-9]{2,}|[a-z_][a-z0-9_]{2,})\b/g;
const SKIP = new Set([
    "Parse", "Error", "SCRIPT", "USER", "Function", "Cannot", "find", "the",
    "current", "scope", "argument", "should", "but", "Expected", "after",
    "operator", "expression", "statement", "found", "instead", "base", "self",
    "Failed", "load", "script", "with", "error", "res", "main", "Did", "you",
    "mean", "use", "not", "previously", "declared", "same", "name", "has",
]);

/**
 * Pull candidate API symbols out of a compiler error, then fetch their exact
 * official docs (signatures, constants) so the fix is grounded in the real API
 * — the root cause of the version-mismatch errors. Returns formatted doc text,
 * or "" on no hits / failure (best-effort).
 */
export async function lookupApiDocsForError(engine: string, errorText: string): Promise<string> {
    try {
        const symbols = [...new Set(
            [...errorText.matchAll(SYMBOL_RE)].map((m) => m[1]).filter((s) => !SKIP.has(s)),
        )].slice(0, 12);
        if (symbols.length === 0) return "";

        const { getAdminClient } = await import("../supabase/admin.js");
        const db = getAdminClient();
        const { data, error } = await db.rpc("lookup_api_symbols", {
            p_engine: engine,
            p_symbols: symbols,
        });
        const rows = (data ?? []) as Array<{ class_name: string; symbol: string; kind: string; signature: string; content: string }>;
        const found = new Set(rows.map((d) => d.symbol));
        const docs = rows
            .map((d) => `- ${d.kind} ${d.class_name}.${d.symbol}: ${d.signature}\n  ${(d.content || "").slice(0, 240)}`)
            .join("\n");
        // Symbols named in the error but absent from the API docs are likely
        // hallucinated/Godot-3 methods (e.g. get_signal_sender) — tell the LLM
        // explicitly so it removes them instead of retrying the same call.
        const missing = symbols.filter(
            (s) => !found.has(s) && /^[a-z_][a-z0-9_]+$/.test(s) && s.includes("_"),
        );
        const missingNote = missing.length
            ? `\nThese symbols do NOT exist in Godot 4 — remove or replace them: ${missing.join(", ")}.`
            : "";
        if (!docs && !missingNote) return "";
        return docs + missingNote;
    } catch (e) {
        console.error("lookupApiDocsForError failed: " + (e instanceof Error ? e.message : String(e)));
        return "";
    }
}
