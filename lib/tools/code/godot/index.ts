/** code_gen_godot_gdscript — RAG-grounded GDScript generation. */
import { makeCodeGenTool } from "../_codegen.js";

export default makeCodeGenTool({
    id: "code_gen_godot_gdscript",
    name: "Godot (GDScript)",
    kbEngine: "godot",
    language: "gdscript",
    // deepseek repeatedly emits Godot-3 / Python-style GDScript that won't parse
    // (proven via the self-heal traces: 3 retries, still broken). gpt-4.1-mini
    // (on Azure, no Claude deployment here) handles Godot 4 better; combined
    // with the validate+retry loop it's reliable. code_gen quality is the
    // whole product, so the per-call cost is worth it.
    model: "gpt-4.1-mini",
    // The scaffold mounts this script on the root Node2D scene (main.tscn).
    // The LLM keeps mixing Godot 3 APIs and assuming a scene tree that doesn't
    // exist ($Player), so we anchor it with a COMPLETE valid Godot 4.3 example
    // to imitate — far more reliable than abstract rules. The self-heal loop
    // (godot --check-only + doc-API + retry) catches whatever slips through.
    entrypointContract:
        "TARGET: Godot 4.3 GDScript ONLY. This is the root script of the main " +
        "scene — there are NO other nodes in the scene yet, so NEVER use " +
        "$NodePath / get_node(); CREATE every node in `_ready()` and keep " +
        "references in variables. Imitate the structure and API of this WORKING " +
        "Godot 4.3 example exactly:\n" +
        "```gdscript\n" +
        "extends Node2D\n\n" +
        "var player: CharacterBody2D\n" +
        "var speed := 300.0\n" +
        "var score := 0\n\n" +
        "func _ready() -> void:\n" +
        "\tplayer = CharacterBody2D.new()\n" +
        "\tplayer.position = Vector2(120, 200)\n" +
        "\tadd_child(player)\n" +
        "\tvar shape := CollisionShape2D.new()\n" +
        "\tvar rect := RectangleShape2D.new()\n" +
        "\trect.size = Vector2(24, 24)\n" +
        "\tshape.shape = rect\n" +
        "\tplayer.add_child(shape)\n" +
        "\tvar spr := ColorRect.new()\n" +
        "\tspr.size = Vector2(24, 24)\n" +
        "\tspr.color = Color.RED\n" +
        "\tplayer.add_child(spr)\n\n" +
        "func _physics_process(delta: float) -> void:\n" +
        "\tvar dir := Input.get_axis(\"ui_left\", \"ui_right\")\n" +
        "\tplayer.velocity = Vector2(dir * speed, player.velocity.y + 1200.0 * delta)\n" +
        "\tplayer.move_and_slide()\n" +
        "\t_publish_state()\n" +
        "```\n" +
        "MANDATORY — expose the game state for automated testing. Add this and " +
        "call _publish_state() every frame; keep player_alive/on_screen/" +
        "goal_reached/game_over/score accurate to YOUR game:\n" +
        "```gdscript\n" +
        "var _t := 0.0\n" +
        "func _publish_state() -> void:\n" +
        "\tif not JavaScriptBridge.has_method(\"eval\"): return\n" +
        "\tvar vp := get_viewport_rect().size\n" +
        "\tvar on := player.position.x >= -50 and player.position.x <= vp.x + 50 and player.position.y <= vp.y + 200\n" +
        "\tvar st := {\"player_alive\": is_instance_valid(player), \"player_on_screen\": on, " +
        "\"player_x\": player.position.x, \"player_y\": player.position.y, \"score\": score, " +
        "\"goal_reached\": false, \"game_over\": false, \"elapsed_seconds\": _t, \"status\": \"\"}\n" +
        "\tJavaScriptBridge.eval(\"window.__GAME_STATE__ = \" + JSON.stringify(st), true)\n" +
        "```\n" +
        "Custom signals in Godot 4 (define with `signal`, connect a Callable, " +
        "there is NO get_signal_sender — pass data as signal args):\n" +
        "```gdscript\n" +
        "signal coin_collected(amount: int)\n\n" +
        "func _ready() -> void:\n" +
        "\tcoin_collected.connect(_on_coin_collected)\n\n" +
        "func _on_coin_collected(amount: int) -> void:\n" +
        "\tscore += amount\n" +
        "```\n" +
        "INPUT: only these InputMap actions exist — use ONLY these: move_left, " +
        "move_right, move_up, move_down, jump, shoot, action, retry, restart, " +
        "pause (plus built-in ui_left/ui_right/ui_up/ui_down/ui_accept). Never " +
        "reference any other action name. PLAYABILITY: the player must START " +
        "standing ON a platform/ground (not in empty space) and must be able to " +
        "move and survive at least a few seconds; place the ground under the " +
        "player's start position. " +
        "Key Godot-4 rules shown above: CharacterBody2D (not KinematicBody2D), " +
        "`move_and_slide()` takes NO args and uses the `velocity` property, " +
        "`@onready`/`@export` need the @, Color.RED (uppercase), Sprite2D not " +
        "Sprite, node.position/size not rect_*. GDScript is NOT Python: never " +
        "break a line after `and`/`or`; tabs for indentation. Make something " +
        "visible on screen.",
});
