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
// One sandbox reused for the whole self-heal loop (booting E2B is ~15-20s; doing
// it per attempt was the dominant cost). Booted lazily on first validate, closed
// by closeValidatorSandbox() after the loop.
let sharedSandbox: Awaited<ReturnType<typeof bootSandbox>> | null = null;
async function getValidatorSandbox() {
    if (sharedSandbox) return sharedSandbox;
    const deps = createRealDeps();
    sharedSandbox = await bootSandbox(deps.e2b);
    // Project + scene written once; only main.gd changes per attempt. Include
    // the SAME warnings-as-errors-off [debug] block the real build uses, so the
    // validator doesn't reject valid-but-warned code the build would accept.
    const { GODOT_DEBUG_GDSCRIPT } = await import("./assembler/scaffold.js");
    await sharedSandbox.writeFile(
        "/check/project.godot",
        'config_version=5\n[application]\nconfig/name="check"\nrun/main_scene="res://main.tscn"\n\n' + GODOT_DEBUG_GDSCRIPT,
    );
    await sharedSandbox.writeFile(
        "/check/main.tscn",
        '[gd_scene load_steps=2 format=3]\n[ext_resource type="Script" path="res://main.gd" id="1"]\n[node name="Main" type="Node2D"]\nscript = ExtResource("1")\n',
    );
    return sharedSandbox;
}

/** Close the reused validator sandbox. Call after the self-heal loop. */
export async function closeValidatorSandbox(): Promise<void> {
    await sharedSandbox?.close().catch(() => {});
    sharedSandbox = null;
}

async function validateGodot(rawCode: string): Promise<string | null> {
    const { sanitizeGodot4 } = await import("./assembler/scaffold.js");
    const code = sanitizeGodot4(rawCode);
    try {
        const sandbox = await getValidatorSandbox();
        await sandbox.writeFile("/check/main.gd", code);
        // ONE command: --check-only (syntax) and, only if it parses, a short
        // headless RUN (catches "compiles but crashes" — bad signals, null refs,
        // wrong types). Single round-trip, single reused sandbox → fast + severe.
        const res = await sandbox.runCommand(
            "cd /check && GODOT_SILENCE_ROOT_WARNING=1 godot --headless --path /check --check-only --script main.gd 2>&1; " +
            "if [ $? -eq 0 ]; then GODOT_SILENCE_ROOT_WARNING=1 timeout 25 godot --headless --path /check --quit-after 90 2>&1; fi; true",
        );
        const out = `${res.stdout}\n${res.stderr}`;
        const errors = out
            .split("\n")
            .filter((l) => /SCRIPT ERROR|Parse Error|ERROR:.*main\.gd|error\(|USER ERROR|Cannot convert|can't be assigned|Null instance|nonexistent (function|signal)|Invalid (call|get index|set index)/i.test(l));
        return errors.length > 0 ? errors.slice(0, 8).join("\n") : null;
    } catch (error) {
        console.error("validateGodot failed (skipping validation): " + (error instanceof Error ? error.message : String(error)));
        return null;
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
