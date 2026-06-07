/** code_gen_godot_gdscript — RAG-grounded GDScript generation. */
import { makeCodeGenTool } from "../_codegen.js";

export default makeCodeGenTool({
    id: "code_gen_godot_gdscript",
    name: "Godot (GDScript)",
    kbEngine: "godot",
    language: "gdscript",
    // Generating a full game + a designed level is complex; gpt-4.1-mini made
    // too many errors at that size (5/5 retries failed, errors varied). Claude
    // Sonnet (via OpenRouter — not on Azure) handles complex GDScript far
    // better; with the self-heal + doc-API loop it's reliable. code_gen quality
    // is the whole product, so the cost is worth it.
    model: "claude-sonnet-4-7",
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
        "PHYSICS IS FIXED — use these EXACT constants (they match the generated " +
        "level's jump spacing; do NOT change them): gravity 1200.0, jump_velocity " +
        "-450.0, move_speed 300.0. Use this controller VERBATIM (add your mechanics " +
        "on top, don't rewrite the movement/jump):\n" +
        "```gdscript\n" +
        "extends Node2D\n\n" +
        "var player: CharacterBody2D\n" +
        "const GRAVITY := 1200.0\n" +
        "const JUMP_VELOCITY := -450.0\n" +
        "const MOVE_SPEED := 300.0\n" +
        "const COYOTE := 0.1\n" +
        "var score := 0\n" +
        "var _coyote := 0.0\n\n" +
        "func _ready() -> void:\n" +
        "\tplayer = CharacterBody2D.new()\n" +
        "\tplayer.position = Vector2(120, 200)\n" +
        "\tadd_child(player)\n" +
        "\tvar shape := CollisionShape2D.new()\n" +
        "\tvar rect := RectangleShape2D.new()\n" +
        "\trect.size = Vector2(24, 32)\n" +
        "\tshape.shape = rect\n" +
        "\tplayer.add_child(shape)\n" +
        "\tvar spr := Sprite2D.new()\n" +
        "\tspr.texture = _tex(\"res://assets/sprites/sprite_gen.png\", Vector2(32, 32), Color.RED)\n" +
        "\t_fit(spr, 40.0)  # scale to ~40px tall — a 1024px asset would be GIANT raw\n" +
        "\tplayer.add_child(spr)\n" +
        "\tvar cam := Camera2D.new()\n" +
        "\tplayer.add_child(cam)  # camera follows the player\n\n" +
        "# Texture helper — ALWAYS returns a texture, NEVER a ColorRect. Loads the\n" +
        "# asset if present, else makes a solid-color placeholder texture. Use this\n" +
        "# for EVERY visible thing (player, platforms, enemies, pickups, bg).\n" +
        "func _tex(path: String, size: Vector2, fallback: Color) -> Texture2D:\n" +
        "\t# MUST check existence first — load() on a missing res:// path throws\n" +
        "\t# 'No loader found' (fatal, grey screen), it does NOT return null.\n" +
        "\tif ResourceLoader.exists(path):\n" +
        "\t\tvar t: Texture2D = load(path)\n" +
        "\t\tif t: return t\n" +
        "\tvar img := Image.create(maxi(1, int(size.x)), maxi(1, int(size.y)), false, Image.FORMAT_RGBA8)\n" +
        "\timg.fill(fallback)\n" +
        "\treturn ImageTexture.create_from_image(img)\n\n" +
        "# Scale a Sprite2D to a target on-screen HEIGHT in px, whatever the source\n" +
        "# resolution. Catalog/FLUX assets vary wildly (16px tile .. 1024px render):\n" +
        "# raw they come out tiny or screen-filling. ALWAYS _fit() every gameplay\n" +
        "# sprite (player ~40, enemy ~36, pickup ~20). Backgrounds are handled\n" +
        "# separately (stretch to the viewport), not via _fit.\n" +
        "func _fit(spr: Sprite2D, target_h: float) -> void:\n" +
        "\tif spr.texture == null: return\n" +
        "\tvar th := spr.texture.get_height()\n" +
        "\tif th > 0: spr.scale = Vector2.ONE * (target_h / float(th))\n\n" +
        "func _physics_process(delta: float) -> void:\n" +
        "\tplayer.velocity.y += GRAVITY * delta\n" +
        "\tif player.is_on_floor():\n" +
        "\t\t_coyote = COYOTE\n" +
        "\telse:\n" +
        "\t\t_coyote -= delta\n" +
        "\tif Input.is_action_just_pressed(\"jump\") and _coyote > 0.0:\n" +
        "\t\tplayer.velocity.y = JUMP_VELOCITY\n" +
        "\t\t_coyote = 0.0\n" +
        "\tplayer.velocity.x = Input.get_axis(\"move_left\", \"move_right\") * MOVE_SPEED\n" +
        "\tplayer.move_and_slide()\n" +
        "\t_publish_state()\n" +
        "```\n" +
        "MANDATORY — expose the game state for automated testing. Add this and " +
        "call _publish_state() every frame; keep player_alive/on_screen/" +
        "goal_reached/game_over/score accurate to YOUR game:\n" +
        "```gdscript\n" +
        "var _t := 0.0\n" +
        "func _publish_state() -> void:\n" +
        "\t_t += get_process_delta_time()\n" +
        "\tvar vp := get_viewport_rect().size\n" +
        "\tvar on := player.position.x >= -50 and player.position.x <= vp.x + 50 and player.position.y >= -100 and player.position.y <= vp.y + 100\n" +
        "\t# Headless line the validator reads (no window there); keep it.\n" +
        "\tprint(\"__GS__ alive=%s on=%s y=%.0f t=%.1f\" % [is_instance_valid(player), on, player.position.y, _t])\n" +
        "\tif not JavaScriptBridge.has_method(\"eval\"): return\n" +
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
        "LEVEL DESIGN: design a COMPLETE, intentional level (this is a finished " +
        "game, not an empty room). Place MULTIPLE platforms at varied heights " +
        "forming a clear path from the start to a goal; space jumps so they're " +
        "reachable (gap <= ~120px horizontal, <= ~80px up). Add collectibles " +
        "and/or a few enemies along the path, and a visible GOAL (exit) the " +
        "player reaches to win. The level should be wider than the screen with a " +
        "Camera2D following the player. Don't leave the player on a single flat " +
        "floor with nothing to do. " +
        "Key Godot-4 rules shown above: CharacterBody2D (not KinematicBody2D), " +
        "`move_and_slide()` takes NO args and uses the `velocity` property, " +
        "`@onready`/`@export` need the @, Color.RED (uppercase), Sprite2D not " +
        "Sprite, node.position/size not rect_*. GDScript is NOT Python: never " +
        "break a line after `and`/`or`; tabs for indentation. Make something " +
        "visible on screen.",
});
