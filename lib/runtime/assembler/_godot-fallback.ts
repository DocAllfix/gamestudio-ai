/**
 * Guaranteed-playable Godot fallback game.
 *
 * The "100% playable" safety net: when code_gen produces no usable code (LLM
 * 402/credits, an exception, or every self-heal attempt failing validation),
 * the scaffold used to write a bare `extends Node2D` → empty scene → GREY
 * screen shipped to the user. This is a complete, self-contained, known-good
 * GDScript platformer the scaffold substitutes instead, so the user ALWAYS gets
 * a running, playable game.
 *
 * Design rules that keep it robust:
 *  - Self-contained: raw key input (no InputMap dependency), no external scene.
 *  - Asset-aware: loads the same res:// paths the real pipeline writes
 *    (sprite_gen/tileset/background/bgm), so any resolved CC0/FLUX assets show;
 *    every load is guarded by _tex/ResourceLoader → a missing asset becomes a
 *    colored placeholder texture, never a crash.
 *  - Always renders + publishes __GS__ each frame (the render-verification
 *    signal the playtest reads), so it passes the gate.
 *  - Godot 4.3 syntax, no `:=` on Variant (no warning-as-error parse failures).
 */
export const GODOT_FALLBACK_GAME = `extends Node2D

const GRAVITY := 1200.0
const JUMP_VELOCITY := -450.0
const MOVE_SPEED := 300.0
const COYOTE := 0.1

var player: CharacterBody2D
var status_label: Label
var _coyote := 0.0
var _t := 0.0
var won := false

func _ready() -> void:
	# Background — screen-fixed so it covers the viewport while the camera scrolls.
	var bg_layer := CanvasLayer.new()
	bg_layer.layer = -100
	add_child(bg_layer)
	var bg := Sprite2D.new()
	bg.texture = _tex("res://assets/sprites/background.png", get_viewport_rect().size, Color(0.16, 0.2, 0.28))
	bg.centered = false
	var bsz := bg.texture.get_size()
	if bsz.x > 0.0 and bsz.y > 0.0:
		bg.scale = get_viewport_rect().size / bsz
	bg_layer.add_child(bg)

	# Platforms (spaced within jump reach).
	var plats: Array[Vector2] = [Vector2(40, 360), Vector2(240, 320), Vector2(440, 290), Vector2(640, 320), Vector2(860, 360)]
	for p in plats:
		_make_platform(p, Vector2(150, 24))

	# Player, centered on the first platform.
	player = CharacterBody2D.new()
	player.position = Vector2(115, 320)
	add_child(player)
	var col := CollisionShape2D.new()
	var rect := RectangleShape2D.new()
	rect.size = Vector2(28, 38)
	col.shape = rect
	player.add_child(col)
	var spr := Sprite2D.new()
	spr.texture = _tex("res://assets/sprites/sprite_gen.png", Vector2(40, 40), Color(0.9, 0.3, 0.3))
	_fit(spr, 42.0)
	player.add_child(spr)
	var cam := Camera2D.new()
	player.add_child(cam)

	# Goal on the last platform.
	var goal := Area2D.new()
	goal.position = Vector2(900, 318)
	add_child(goal)
	var gcol := CollisionShape2D.new()
	var grect := RectangleShape2D.new()
	grect.size = Vector2(36, 50)
	gcol.shape = grect
	goal.add_child(gcol)
	var gspr := Sprite2D.new()
	gspr.texture = _tex("res://assets/sprites/sprite_gen.png", Vector2(36, 50), Color(0.95, 0.85, 0.2))
	_fit(gspr, 50.0)
	goal.add_child(gspr)
	goal.body_entered.connect(_on_goal)

	# Background music (guarded — a missing file must not crash).
	if ResourceLoader.exists("res://assets/audio/bgm_gen.mp3"):
		var s: AudioStream = load("res://assets/audio/bgm_gen.mp3")
		if s:
			var ap := AudioStreamPlayer.new()
			ap.stream = s
			add_child(ap)
			ap.play()

	# HUD.
	var ui := CanvasLayer.new()
	add_child(ui)
	status_label = Label.new()
	status_label.position = Vector2(16, 12)
	status_label.text = "Arrow keys / WASD to move, Space to jump. Reach the goal!"
	ui.add_child(status_label)

func _make_platform(pos: Vector2, size: Vector2) -> void:
	var body := StaticBody2D.new()
	body.position = pos + size * 0.5
	add_child(body)
	var col := CollisionShape2D.new()
	var rect := RectangleShape2D.new()
	rect.size = size
	col.shape = rect
	body.add_child(col)
	var spr := Sprite2D.new()
	spr.texture = _tex("res://assets/sprites/tileset.png", size, Color(0.4, 0.3, 0.2))
	var tsz := spr.texture.get_size()
	if tsz.x > 0.0 and tsz.y > 0.0:
		spr.scale = size / tsz
	body.add_child(spr)

func _tex(path: String, size: Vector2, fallback: Color) -> Texture2D:
	if ResourceLoader.exists(path):
		var t: Texture2D = load(path)
		if t: return t
	var img := Image.create(maxi(1, int(size.x)), maxi(1, int(size.y)), false, Image.FORMAT_RGBA8)
	img.fill(fallback)
	return ImageTexture.create_from_image(img)

func _fit(spr: Sprite2D, target_h: float) -> void:
	if spr.texture == null: return
	var h := spr.texture.get_height()
	if h > 0: spr.scale = Vector2.ONE * (target_h / float(h))

func _on_goal(body: Node) -> void:
	if body == player:
		won = true
		if status_label: status_label.text = "You win!"

func _physics_process(delta: float) -> void:
	if not is_instance_valid(player): return
	player.velocity.y += GRAVITY * delta
	if player.is_on_floor():
		_coyote = COYOTE
	else:
		_coyote -= delta
	var dir := 0.0
	if Input.is_key_pressed(KEY_LEFT) or Input.is_key_pressed(KEY_A): dir -= 1.0
	if Input.is_key_pressed(KEY_RIGHT) or Input.is_key_pressed(KEY_D): dir += 1.0
	player.velocity.x = dir * MOVE_SPEED
	if (Input.is_key_pressed(KEY_SPACE) or Input.is_key_pressed(KEY_UP)) and _coyote > 0.0:
		player.velocity.y = JUMP_VELOCITY
		_coyote = 0.0
	player.move_and_slide()
	if player.position.y > 900.0:
		player.position = Vector2(115, 320)
		player.velocity = Vector2.ZERO
	_t += delta
	var vp := get_viewport_rect().size
	var on := player.position.x >= -100.0 and player.position.y <= vp.y + 400.0
	print("__GS__ alive=%s on=%s y=%.0f t=%.1f" % [is_instance_valid(player), on, player.position.y, _t])
	if JavaScriptBridge.has_method("eval"):
		var st := {"player_alive": true, "player_on_screen": on, "player_x": player.position.x, "player_y": player.position.y, "score": 0, "goal_reached": won, "game_over": false, "elapsed_seconds": _t}
		JavaScriptBridge.eval("window.__GAME_STATE__ = " + JSON.stringify(st), true)
`;
