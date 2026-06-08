/**
 * Godot EngineComposer — turns a GameSpec into a DECLARATIVE Godot 4 scene
 * (FASE 2, side_scroller tracer bullet). The architecture pivot in action: the
 * scene tree lives in `main.tscn` (data, composed deterministically from the
 * GameSpec), and `main.gd` is reduced to the reusable "gold" controller +
 * guarded texture binding — no more LLM building nodes at runtime.
 *
 * Emits the exact file tree EngineAdapter.build() expects (project.godot +
 * main.tscn + main.gd + export_presets.cfg), so it slots into the existing
 * Godot build/smoke path as a drop-in for the scaffold's code branch.
 *
 * Robust by construction (mirrors _godot-fallback.ts): textures load guarded
 * (missing asset → colored placeholder, never a crash), and the controller
 * publishes window.__GAME_STATE__ + prints "__GS__" every frame — the signal
 * the smoke runner and playtester read for the playable gate.
 */
import type {
    ComposedScene,
    EngineComposer,
    SceneInit,
} from "../../contracts/engine-composer.contract.js";
import type {
    BackgroundSpec,
    CameraSpec,
    EntitySpec,
    FrameMeta,
    GoalSpec,
    HudSpec,
    MechanicsSpec,
    ParallaxLayer,
    PhysicsSpec,
    PlayerSpec,
    WorldSpec,
} from "../../contracts/game-spec.contract.js";

interface SubResource {
    id: string;
    type: string;
    props: Record<string, string>;
}
interface SceneNode {
    name: string;
    type: string;
    parent: string | null; // null = root; "." = child of root
    props: Record<string, string>;
}

/** Controller data threaded from the primitives into main.gd at finalize(). */
interface Controller {
    gravity: number;
    jumpVelocity: number;
    moveSpeed: number;
    spawnX: number;
    spawnY: number;
    worldW: number;
    worldH: number;
    thickness: number;
    hudText: string;
    bgPath: string;
    playerPath: string;
    tilesetPath: string;
    goalPath: string;
    hitboxW: number;
    hitboxH: number;
    /** Real level collision/visual grid (1=solid, 0=air). Null → flat floor. */
    solidTiles: number[][] | null;
    tilePx: number;
    /** Player sheet frame size (sheet → show one frame). Null → whole image. */
    playerFrameW: number | null;
    playerFrameH: number | null;
    /** Walk-cycle length + rate (cycle frames 0..cols-1 when moving). */
    playerCols: number;
    playerFps: number;
}

const GROUND_THICKNESS = 64;

export class GodotComposer implements EngineComposer {
    private nodes: SceneNode[] = [];
    private subres: SubResource[] = [];
    private slots = new Map<string, string>(); // slot id → res:// path
    private ctrl: Controller = {
        gravity: 1200, jumpVelocity: 450, moveSpeed: 300,
        spawnX: 64, spawnY: 64, worldW: 960, worldH: 384, thickness: GROUND_THICKNESS,
        hudText: "Reach the goal!", bgPath: "", playerPath: "", tilesetPath: "", goalPath: "",
        hitboxW: 28, hitboxH: 38,
        solidTiles: null, tilePx: 16,
        playerFrameW: null, playerFrameH: null,
        playerCols: 1, playerFps: 8,
    };
    private slotFrames = new Map<string, FrameMeta>();
    private warnings: string[] = [];
    private pixelArt = false;

    private resPath(slot: string): string {
        return this.slots.get(slot) ?? `res://assets/sprites/${slot}.png`;
    }

    beginScene(init: SceneInit): void {
        for (const s of init.assetSlots) {
            const sub = s.role === "audio" ? "audio" : "sprites";
            const ext = s.role === "audio" ? "mp3" : "png";
            this.slots.set(s.slot, `res://assets/${sub}/${s.slot}.${ext}`);
            if (s.frame) this.slotFrames.set(s.slot, s.frame);
        }
        this.pixelArt = init.pixelArt;
        this.ctrl.gravity = init.gravity;
        this.nodes.push({ name: "Main", type: "Node2D", parent: null, props: { script: 'ExtResource("1")' } });
    }

    addBackground(bg: BackgroundSpec): void {
        this.ctrl.bgPath = bg.asset_slot ? this.resPath(bg.asset_slot) : "";
        this.nodes.push({ name: "Background", type: "CanvasLayer", parent: ".", props: { layer: "-100" } });
        this.nodes.push({ name: "BgSprite", type: "Sprite2D", parent: "Background", props: {} });
    }

    addParallax(layers: ParallaxLayer[]): void {
        if (layers.length === 0) return;
        // Declarative ParallaxBackground; layers bound to textures in the script.
        this.nodes.push({ name: "Parallax", type: "ParallaxBackground", parent: ".", props: {} });
        layers.forEach((l, i) => {
            this.nodes.push({
                name: `Layer${i}`, type: "ParallaxLayer", parent: "Parallax",
                props: { motion_scale: `Vector2(${l.scroll_scale.x}, ${l.scroll_scale.y})` },
            });
        });
    }

    addTileMap(world: WorldSpec): void {
        this._tilePx = world.tile_px;
        this.ctrl.tilePx = world.tile_px;
        this.ctrl.worldW = world.width_tiles * world.tile_px;
        this.ctrl.worldH = world.height_tiles * world.tile_px;
        this.ctrl.tilesetPath = this.resPath(world.tileset_slot);
        if (world.solid_tiles) {
            // Real level: collision (merged solid runs) + tile visuals are built
            // procedurally in _ready from the grid — a platformer needs
            // solid-to-stand-on / air-to-fall-through, not a flat slab.
            this.ctrl.solidTiles = world.solid_tiles;
            return;
        }
        // Flat-floor fallback when no level is supplied — "solid land, not a void".
        const id = "GroundShape";
        this.subres.push({ id, type: "RectangleShape2D", props: { size: `Vector2(${this.ctrl.worldW}, ${this.ctrl.thickness})` } });
        const gy = this.ctrl.worldH - this.ctrl.thickness / 2;
        this.nodes.push({ name: "Ground", type: "StaticBody2D", parent: ".", props: { position: `Vector2(${this.ctrl.worldW / 2}, ${gy})` } });
        this.nodes.push({ name: "GroundCol", type: "CollisionShape2D", parent: "Ground", props: { shape: `SubResource("${id}")` } });
        this.nodes.push({ name: "GroundSprite", type: "Sprite2D", parent: "Ground", props: {} });
    }

    addPlayer(player: PlayerSpec, physics: PhysicsSpec, _mechanics: MechanicsSpec): void {
        const tile = this.tilePx();
        this.ctrl.moveSpeed = physics.move_speed;
        this.ctrl.jumpVelocity = physics.jump_velocity;
        this.ctrl.gravity = physics.gravity;
        this.ctrl.spawnX = player.spawn_tile.x * tile;
        this.ctrl.spawnY = player.spawn_tile.y * tile;
        this.ctrl.hitboxW = player.hitbox_px.w;
        this.ctrl.hitboxH = player.hitbox_px.h;
        this.ctrl.playerPath = this.resPath(player.asset_slot);
        const pf = this.slotFrames.get(player.asset_slot);
        if (pf) {
            this.ctrl.playerFrameW = pf.w;
            this.ctrl.playerFrameH = pf.h;
            this.ctrl.playerCols = pf.cols ?? pf.count;
            this.ctrl.playerFps = pf.fps;
        }

        const id = "PlayerShape";
        this.subres.push({ id, type: "RectangleShape2D", props: { size: `Vector2(${player.hitbox_px.w}, ${player.hitbox_px.h})` } });
        this.nodes.push({ name: "Player", type: "CharacterBody2D", parent: ".", props: { position: `Vector2(${this.ctrl.spawnX}, ${this.ctrl.spawnY})` } });
        this.nodes.push({ name: "PlayerCol", type: "CollisionShape2D", parent: "Player", props: { shape: `SubResource("${id}")` } });
        this.nodes.push({ name: "PlayerSprite", type: "Sprite2D", parent: "Player", props: {} });
        this.nodes.push({ name: "Camera", type: "Camera2D", parent: "Player", props: {} });
    }

    addEntity(entity: EntitySpec): void {
        const tile = this.tilePx();
        const x = entity.tile.x * tile;
        const y = entity.tile.y * tile;
        const safe = entity.id.replace(/[^A-Za-z0-9_]/g, "_");
        // Pickups/hazards/enemies render as a marker sprite; behavior is the
        // next refinement (this tracer bullet proves placement + composition).
        this.nodes.push({ name: `Ent_${safe}`, type: "Sprite2D", parent: ".", props: { position: `Vector2(${x}, ${y})` } });
        this.slots.set(`__ent_${safe}`, this.resPath(entity.asset_slot));
    }

    addCamera(camera: CameraSpec, world: WorldSpec): void {
        const node = this.nodes.find((n) => n.name === "Camera" && n.parent === "Player");
        if (!node) {
            this.warnings.push("addCamera: no Player camera (addPlayer must run first)");
            return;
        }
        node.props.zoom = `Vector2(${camera.zoom}, ${camera.zoom})`;
        node.props.position_smoothing_enabled = "true";
        if (camera.clamp_to_world) {
            node.props.limit_left = "0";
            node.props.limit_top = "0";
            node.props.limit_right = String(world.width_tiles * world.tile_px);
            node.props.limit_bottom = String(world.height_tiles * world.tile_px);
        }
    }

    addHud(hud: HudSpec): void {
        const label = hud.elements.find((e) => e.text)?.text;
        this.ctrl.hudText = label ?? "Reach the goal!";
        this.nodes.push({ name: "HUD", type: "CanvasLayer", parent: ".", props: {} });
        this.nodes.push({ name: "Status", type: "Label", parent: "HUD", props: { offset_left: "16", offset_top: "12" } });
    }

    addGoal(goal: GoalSpec): void {
        const tile = this.tilePx();
        const gx = (goal.exit_tile?.x ?? 0) * tile;
        const gy = (goal.exit_tile?.y ?? 0) * tile;
        this.ctrl.goalPath = this.resPath("goal");
        const id = "GoalShape";
        this.subres.push({ id, type: "RectangleShape2D", props: { size: "Vector2(36, 50)" } });
        this.nodes.push({ name: "Goal", type: "Area2D", parent: ".", props: { position: `Vector2(${gx}, ${gy})` } });
        this.nodes.push({ name: "GoalCol", type: "CollisionShape2D", parent: "Goal", props: { shape: `SubResource("${id}")` } });
        this.nodes.push({ name: "GoalSprite", type: "Sprite2D", parent: "Goal", props: {} });
    }

    finalize(): ComposedScene {
        const tscn = this.buildTscn();
        const gd = this.buildController();
        return {
            engine: "godot",
            entry_scene: "res://main.tscn",
            files: [
                { path: "/project/project.godot", content: this.buildProject(), encoding: "utf-8" },
                { path: "/project/main.tscn", content: tscn, encoding: "utf-8" },
                { path: "/project/main.gd", content: gd, encoding: "utf-8" },
                { path: "/project/export_presets.cfg", content: GODOT_EXPORT_PRESETS, encoding: "utf-8" },
            ],
            warnings: this.warnings,
        };
    }

    // tile_px is captured from world in addTileMap (which runs before the
    // tile-coordinate primitives in the driver order).
    private _tilePx = 16;
    private tilePx(): number {
        return this._tilePx;
    }

    /** project.godot, with nearest-neighbour canvas filtering for pixel art
     * (crisp, not blurry). 0 = Nearest in Godot's default_texture_filter. */
    private buildProject(): string {
        if (!this.pixelArt) return GODOT_PROJECT;
        return GODOT_PROJECT.replace(
            'renderer/rendering_method="gl_compatibility"',
            'renderer/rendering_method="gl_compatibility"\ntextures/canvas_textures/default_texture_filter=0',
        );
    }

    private buildTscn(): string {
        const loadSteps = this.subres.length + 1 /*script*/ + 1;
        const lines: string[] = [`[gd_scene load_steps=${loadSteps} format=3]`, "", `[ext_resource type="Script" path="res://main.gd" id="1"]`, ""];
        for (const s of this.subres) {
            lines.push(`[sub_resource type="${s.type}" id="${s.id}"]`);
            for (const [k, v] of Object.entries(s.props)) lines.push(`${k} = ${v}`);
            lines.push("");
        }
        for (const n of this.nodes) {
            const header = n.parent === null
                ? `[node name="${n.name}" type="${n.type}"]`
                : `[node name="${n.name}" type="${n.type}" parent="${n.parent}"]`;
            lines.push(header);
            for (const [k, v] of Object.entries(n.props)) lines.push(`${k} = ${v}`);
            lines.push("");
        }
        return lines.join("\n");
    }

    private buildController(): string {
        const c = this.ctrl;
        const hasLevel = c.solidTiles !== null;
        const levelConst = hasLevel ? `\nconst TILE := ${c.tilePx}\nconst SOLID := ${JSON.stringify(c.solidTiles)}` : "";
        const groundSetup = hasLevel
            ? "\t_build_level()"
            : `\t_stretch($Ground/GroundSprite, "${c.tilesetPath}", Vector2(${c.worldW}, ${c.thickness}), Color(0.30, 0.42, 0.28))`;
        const levelFuncs = hasLevel ? LEVEL_FUNCS : "";
        // Player: a sheet (frame metadata present) shows ONE frame via a region
        // rect — the Godot mirror of Phaser's load.spritesheet + frame 0, so a
        // sheet renders as one character, not the whole scrambled sheet.
        const fh = c.playerFrameH ?? c.hitboxH;
        const pScale = this.pixelArt ? `maxf(1.0, round(${c.hitboxH.toFixed(1)} / ${fh.toFixed(1)}))` : `(${c.hitboxH.toFixed(1)} / ${fh.toFixed(1)})`;
        const playerBlock = c.playerFrameW !== null && c.playerFrameH !== null
            ? `\tps.texture = _tex("${c.playerPath}", Vector2(${c.playerFrameW}, ${c.playerFrameH}), Color(0.90, 0.30, 0.30))
\tif ResourceLoader.exists("${c.playerPath}"):
\t\tps.region_enabled = true
\t\tps.region_rect = Rect2(0, 0, ${c.playerFrameW}, ${c.playerFrameH})
\tps.scale = Vector2.ONE * ${pScale}`
            : `\tps.texture = _tex("${c.playerPath}", Vector2(${c.hitboxW}, ${c.hitboxH}), Color(0.90, 0.30, 0.30))
\t_fit(ps, ${c.hitboxH.toFixed(1)})`;
        // Walk animation: cycle the region rect across frames 0..cols-1 of the
        // first row when moving, frame 0 idle, flip by facing.
        const animConsts = c.playerFrameW !== null
            ? `\nconst FRAME_W := ${c.playerFrameW}\nconst FRAME_H := ${c.playerFrameH}\nconst ANIM_COLS := ${c.playerCols}\nconst ANIM_FPS := ${c.playerFps.toFixed(1)}`
            : "";
        const animVar = c.playerFrameW !== null ? "\nvar _anim_t := 0.0" : "";
        const animUpdate = c.playerFrameW !== null
            ? `\tvar aps := $Player/PlayerSprite as Sprite2D
\tif absf(player.velocity.x) > 1.0:
\t\t_anim_t += delta
\t\taps.region_rect = Rect2((int(_anim_t * ANIM_FPS) % ANIM_COLS) * FRAME_W, 0, FRAME_W, FRAME_H)
\t\taps.flip_h = player.velocity.x < 0.0
\telse:
\t\taps.region_rect = Rect2(0, 0, FRAME_W, FRAME_H)
`
            : "";
        return `extends Node2D

const GRAVITY := ${c.gravity.toFixed(1)}
const JUMP_VELOCITY := ${(-c.jumpVelocity).toFixed(1)}
const MOVE_SPEED := ${c.moveSpeed.toFixed(1)}
const SPAWN := Vector2(${c.spawnX}, ${c.spawnY})
const WORLD_H := ${c.worldH.toFixed(1)}${levelConst}${animConsts}

@onready var player: CharacterBody2D = $Player
@onready var status_label: Label = $HUD/Status
var won := false
var _t := 0.0${animVar}

func _ready() -> void:
	var bg := $Background/BgSprite as Sprite2D
	bg.texture = _tex("${c.bgPath}", get_viewport_rect().size, Color(0.40, 0.62, 0.86))
	bg.centered = false
	var bs := bg.texture.get_size()
	if bs.x > 0.0 and bs.y > 0.0: bg.scale = get_viewport_rect().size / bs
${groundSetup}
	var ps := $Player/PlayerSprite as Sprite2D
${playerBlock}
	var qs := $Goal/GoalSprite as Sprite2D
	qs.texture = _tex("${c.goalPath}", Vector2(36, 50), Color(0.95, 0.85, 0.20))
	_fit(qs, 50.0)
	$Goal.body_entered.connect(_on_goal)
	status_label.text = ${JSON.stringify(c.hudText)}
${levelFuncs}
func _stretch(spr: Sprite2D, path: String, size: Vector2, fallback: Color) -> void:
	spr.texture = _tex(path, size, fallback)
	spr.centered = true
	var s := spr.texture.get_size()
	if s.x > 0.0 and s.y > 0.0: spr.scale = size / s

func _tex(path: String, size: Vector2, fallback: Color) -> Texture2D:
	if path != "" and ResourceLoader.exists(path):
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
	var dir := 0.0
	if Input.is_key_pressed(KEY_LEFT) or Input.is_key_pressed(KEY_A): dir -= 1.0
	if Input.is_key_pressed(KEY_RIGHT) or Input.is_key_pressed(KEY_D): dir += 1.0
	player.velocity.x = dir * MOVE_SPEED
	if (Input.is_key_pressed(KEY_SPACE) or Input.is_key_pressed(KEY_UP)) and player.is_on_floor():
		player.velocity.y = JUMP_VELOCITY
	player.move_and_slide()
${animUpdate}	if player.position.y > WORLD_H + 400.0:
		player.position = SPAWN
		player.velocity = Vector2.ZERO
	_t += delta
	var vp := get_viewport_rect().size
	var on := player.position.x >= -100.0 and player.position.y <= WORLD_H + 400.0
	print("__GS__ alive=%s on=%s y=%.0f t=%.1f" % [is_instance_valid(player), on, player.position.y, _t])
	if JavaScriptBridge.has_method("eval"):
		var st := {"player_alive": true, "player_on_screen": on, "player_x": player.position.x, "player_y": player.position.y, "score": 0, "goal_reached": won, "game_over": false, "elapsed_seconds": _t}
		JavaScriptBridge.eval("window.__GAME_STATE__ = " + JSON.stringify(st), true)
`;
    }
}

// Real-level builder, appended to main.gd when world.solid_tiles is present.
// Collision = merged horizontal runs of solid tiles (few StaticBody2D shapes,
// not one per tile); visuals = _draw of each solid tile. Tabs, to match the
// rest of the GDScript in the controller.
const LEVEL_FUNCS = `
func _build_level() -> void:
	var body := StaticBody2D.new()
	add_child(body)
	for y in SOLID.size():
		var row: Array = SOLID[y]
		var x := 0
		while x < row.size():
			if int(row[x]) == 1:
				var x0 := x
				while x < row.size() and int(row[x]) == 1:
					x += 1
				var run := x - x0
				var col := CollisionShape2D.new()
				var rect := RectangleShape2D.new()
				rect.size = Vector2(run * TILE, TILE)
				col.shape = rect
				col.position = Vector2((x0 + run / 2.0) * TILE, (y + 0.5) * TILE)
				body.add_child(col)
			else:
				x += 1
	queue_redraw()

func _draw() -> void:
	for y in SOLID.size():
		var row: Array = SOLID[y]
		for x in row.size():
			if int(row[x]) == 1:
				var r := Rect2(x * TILE, y * TILE, TILE, TILE)
				draw_rect(r, Color(0.30, 0.42, 0.28))
				draw_rect(r, Color(0.23, 0.33, 0.22), false, 1.0)
`;

const GODOT_PROJECT = `; Engine configuration, GameSmith composer.
config_version=5

[application]
config/name="GameSmith Game"
run/main_scene="res://main.tscn"
config/features=PackedStringArray("4.3", "GL Compatibility")

[rendering]
renderer/rendering_method="gl_compatibility"

[debug]

gdscript/warnings/treat_warnings_as_errors=false
gdscript/warnings/untyped_declaration=0
gdscript/warnings/inferred_declaration=0
`;

const GODOT_EXPORT_PRESETS = `[preset.0]

name="Web"
platform="Web"
runnable=true
export_filter="all_resources"
include_filter=""
exclude_filter=""
export_path="build/web/index.html"

[preset.0.options]

variant/extensions_support=false
variant/thread_support=false
html/export_icon=true
`;

export function makeGodotComposer(): GodotComposer {
    return new GodotComposer();
}
