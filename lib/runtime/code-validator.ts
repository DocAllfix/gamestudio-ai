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
        // Run BOTH --check-only (syntax) and a short headless run (runtime),
        // unconditionally. --check-only's exit code can't gate the run because
        // it flags non-fatal warnings; we decide fatality from the text after
        // filtering warning noise. The run boots the scene → catches real
        // runtime crashes (bad signals, null refs).
        const res = await sandbox.runCommand(
            "cd /check && GODOT_SILENCE_ROOT_WARNING=1 godot --headless --path /check --check-only --script main.gd 2>&1; " +
            "GODOT_SILENCE_ROOT_WARNING=1 timeout 25 godot --headless --path /check --quit-after 90 2>&1; true",
        );
        const out = `${res.stdout}\n${res.stderr}`;
        // `--check-only --script` ignores the project's [debug] warnings config,
        // so it still prints WARNING-level "errors" the real build accepts.
        // Filter those out — they're not fatal (untyped var, inferred type,
        // unsafe access). Only keep genuine parse/runtime failures, so we don't
        // burn a retry on a warning the build would never reject.
        const WARNING_NOISE = /Cannot infer the type|doesn't have a set type|inferred to be|unsafe|narrowing conversion|standalone (expression|ternary)|return value .* discarded|never (used|assigned)|shadow/i;
        const errors = out
            .split("\n")
            .filter((l) => /SCRIPT ERROR|Parse Error|ERROR:.*main\.gd|error\(|USER ERROR|Cannot convert|can't be assigned|Null instance|nonexistent (function|signal)|Invalid (call|get index|set index)/i.test(l))
            .filter((l) => !WARNING_NOISE.test(l));
        if (errors.length > 0) return errors.slice(0, 8).join("\n");

        // Playability check IN the self-heal: read the headless __GS__ state
        // lines. If the player is off-screen/lost early and stays lost, fix it
        // here (one code_gen retry) instead of letting the playtest fail and
        // trigger a whole-DAG regeneration. Same signal the Playtester uses.
        const gs = out.split("\n")
            .map((l) => l.match(/__GS__ alive=(\w+) on=\w+ y=(-?[\d.]+) t=([\d.]+)/))
            .filter((m): m is RegExpMatchArray => m !== null);
        if (gs.length >= 8) {
            // Scale-free judgement (no magic y thresholds — those depend on
            // gravity/viewport/frame count and kept misfiring). A player on the
            // ground SETTLES: its y stops changing. A falling/launched player
            // NEVER settles — y keeps moving the same way the whole window. So:
            // "lost" = y is still moving monotonically (never came to rest) AND
            // it traveled a large distance from start.
            const ys = gs.map((m) => Number(m[2]));
            // Scale-free + time-robust: a player on solid ground SETTLES — its y
            // stops changing in the last third of the run (range ~0). A
            // falling/launched player is STILL moving at the end (range large).
            // The headless window is short, so use "did it come to rest", not
            // total travel (which depends on frame count). Verified: healthy
            // tailRange ~0; free-falling tailRange ~120.
            const tail = ys.slice(-Math.max(5, Math.floor(ys.length / 3)));
            const tailRange = Math.max(...tail) - Math.min(...tail);
            const allDead = gs.slice(-4).every((m) => m[1] === "False");
            if (allDead || tailRange > 60) {
                return "PLAYABILITY: the player never comes to rest — it keeps falling/moving and never lands on solid ground (no platform under the spawn). Create the ground/platform BEFORE the player, spawn the player directly ON it, and add a Camera2D that follows it.";
            }
        }
        return null;
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
