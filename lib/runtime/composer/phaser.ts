/**
 * Phaser EngineComposer — turns a GameSpec into a Phaser 3 scene (FASE 2,
 * side_scroller tracer bullet). The SAME GameSpec the Godot composer renders,
 * proving the EngineComposer port abstracts both engines (the anti-leak test).
 *
 * Emits the file tree the browser EngineAdapter.build() expects
 * (/project/src/main.js bundled by esbuild + /project/dist/index.html), so it
 * slots into the existing browser build/smoke path.
 *
 * Robust by construction: the scene is built from colored arcade-physics
 * rectangles (placeholders that always render — no asset 404 in the headless
 * smoke), with a sky background (never a void), and publishes
 * window.__GAME_STATE__ every frame for the playable gate.
 */
import type {
    ComposedScene,
    EngineComposer,
    SceneInit,
} from "../../contracts/engine-composer.contract.js";
import type {
    AssetSlot,
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

/** A loadable image URL for a slot's bound asset (catalog/user/generative). */
function slotUrl(slot: AssetSlot | undefined): string | null {
    const b = slot?.binding;
    if (!b) return null;
    if (b.source === "generative") return b.output_url;
    return b.download_url; // catalog | user_prepared
}

interface EntityPlacement {
    x: number;
    y: number;
    color: number;
    kind: string;
}

const GROUND_THICKNESS = 64;

export class PhaserComposer implements EngineComposer {
    private gravity = 1200;
    private moveSpeed = 300;
    private jumpVelocity = 450;
    private tilePx = 16;
    private worldW = 960;
    private worldH = 384;
    private viewW = 640;
    private viewH = 360;
    private spawnX = 64;
    private spawnY = 64;
    private hitboxW = 28;
    private hitboxH = 38;
    private goalX = 0;
    private goalY = 0;
    private zoom = 1;
    private clamp = true;
    private hudText = "Reach the goal!";
    private solidTiles: number[][] | null = null;
    private slots = new Map<string, AssetSlot>();
    private playerTextureUrl: string | null = null;
    private playerFrame: FrameMeta | null = null;
    private pixelArt = false;
    private entities: EntityPlacement[] = [];
    private warnings: string[] = [];

    beginScene(init: SceneInit): void {
        this.gravity = init.gravity;
        this.viewW = init.viewport.width;
        this.viewH = init.viewport.height;
        this.pixelArt = init.pixelArt;
        for (const s of init.assetSlots) this.slots.set(s.slot, s);
    }

    addBackground(_bg: BackgroundSpec): void {
        // Sky color is set on the camera in the template (never a void).
    }

    addParallax(layers: ParallaxLayer[]): void {
        if (layers.length > 0) {
            this.warnings.push(`parallax (${layers.length} layers) not yet rendered in Phaser tracer bullet`);
        }
    }

    addTileMap(world: WorldSpec): void {
        this.tilePx = world.tile_px;
        this.worldW = world.width_tiles * world.tile_px;
        this.worldH = world.height_tiles * world.tile_px;
        this.solidTiles = world.solid_tiles ?? null;
    }

    addPlayer(player: PlayerSpec, physics: PhysicsSpec, _mechanics: MechanicsSpec): void {
        this.moveSpeed = physics.move_speed;
        this.jumpVelocity = physics.jump_velocity;
        this.gravity = physics.gravity;
        this.spawnX = player.spawn_tile.x * this.tilePx;
        this.spawnY = player.spawn_tile.y * this.tilePx;
        this.hitboxW = player.hitbox_px.w;
        this.hitboxH = player.hitbox_px.h;
        const ps = this.slots.get(player.asset_slot);
        this.playerTextureUrl = slotUrl(ps);
        this.playerFrame = ps?.frame ?? null; // a sheet → load one frame, not the whole image
    }

    addEntity(entity: EntitySpec): void {
        const color = entity.kind === "pickup" ? 0xf2d933 : entity.kind === "hazard" ? 0xd13b3b : 0x8a5cf2;
        this.entities.push({ x: entity.tile.x * this.tilePx, y: entity.tile.y * this.tilePx, color, kind: entity.kind });
    }

    addCamera(camera: CameraSpec, world: WorldSpec): void {
        this.zoom = camera.zoom;
        this.clamp = camera.clamp_to_world;
        this.worldW = world.width_tiles * world.tile_px;
        this.worldH = world.height_tiles * world.tile_px;
    }

    addHud(hud: HudSpec): void {
        this.hudText = hud.elements.find((e) => e.text)?.text ?? "Reach the goal!";
    }

    addGoal(goal: GoalSpec): void {
        this.goalX = (goal.exit_tile?.x ?? 0) * this.tilePx;
        this.goalY = (goal.exit_tile?.y ?? 0) * this.tilePx;
    }

    finalize(): ComposedScene {
        return {
            engine: "phaser",
            entry_scene: "index.html",
            files: [
                { path: "/project/src/main.js", content: this.buildScene(), encoding: "utf-8" },
                { path: "/project/dist/index.html", content: BROWSER_INDEX_HTML, encoding: "utf-8" },
            ],
            warnings: this.warnings,
        };
    }

    private buildScene(): string {
        const ents = this.entities
            .map((e) => `    const e = this.add.rectangle(${e.x}, ${e.y}, 24, 24, ${e.color}); this.physics.add.existing(e, true);`)
            .join("\n");

        // Level: a real tile layer from solid_tiles (platformer collision: solid
        // tiles to stand on, air to fall through), or a flat-floor fallback.
        // Tiles map solid→0 / air→-1; setCollisionByExclusion([-1]) makes every
        // solid tile stand-on.
        let levelConst = "";
        let level: string;
        if (this.solidTiles) {
            const data = this.solidTiles.map((row) => row.map((c) => (c === 1 ? 0 : -1)));
            levelConst = `const TILE = ${this.tilePx};\nconst SOLID = ${JSON.stringify(data)};\n`;
            level = `    const g = this.add.graphics(); g.fillStyle(0x4d6b47, 1).fillRect(0, 0, TILE, TILE); g.lineStyle(1, 0x3a5238, 1).strokeRect(0, 0, TILE, TILE); g.generateTexture("tile", TILE, TILE); g.destroy();
    const map = this.make.tilemap({ data: SOLID, tileWidth: TILE, tileHeight: TILE });
    const layer = map.createLayer(0, map.addTilesetImage("tile"), 0, 0);
    layer.setCollisionByExclusion([-1]);
    this.physics.add.collider(this.player, layer);`;
        } else {
            level = `    this.ground = this.add.rectangle(WORLD_W / 2, WORLD_H - THICK / 2, WORLD_W, THICK, 0x4d6b47);
    this.physics.add.existing(this.ground, true);
    this.physics.add.collider(this.player, this.ground);`;
        }

        // Player: a real sprite when the slot has a bound (transparent) asset,
        // else a placeholder rectangle. Aspect preserved, scaled to hitbox height.
        let preloadBlock = "";
        let walkUpdate = "";
        let playerCreate = `    this.player = this.add.rectangle(SPAWN_X, SPAWN_Y, HBW, HBH, 0xe54d4d);
    this.physics.add.existing(this.player);`;
        if (this.playerTextureUrl) {
            // Pixel art scales to an INTEGER factor (crisp, no shimmer); smooth
            // art fits the hitbox height exactly.
            const scaleExpr = this.pixelArt ? "Math.max(1, Math.round(HBH / this.player.height))" : "HBH / this.player.height";
            const url = JSON.stringify(this.playerTextureUrl);
            // A sheet → load ONE frame (no scramble); a single image → load whole.
            const loadCall = this.playerFrame
                ? `this.load.spritesheet("player", ${url}, { frameWidth: ${this.playerFrame.w}, frameHeight: ${this.playerFrame.h} })`
                : `this.load.image("player", ${url})`;
            const spriteCall = this.playerFrame
                ? `this.physics.add.sprite(SPAWN_X, SPAWN_Y, "player", 0)`
                : `this.physics.add.sprite(SPAWN_X, SPAWN_Y, "player")`;
            preloadBlock = `  preload() { ${loadCall}; }\n`;
            playerCreate = `    this.player = ${spriteCall};
    if (this.player.height > 0) this.player.setScale(${scaleExpr});`;
            if (this.playerFrame) {
                // Walk = cycle frames 0..cols-1 (the first row); play it when
                // moving, freeze frame 0 idle, flip by facing.
                const walkEnd = (this.playerFrame.cols ?? this.playerFrame.count) - 1;
                playerCreate += `\n    this.anims.create({ key: "walk", frames: this.anims.generateFrameNumbers("player", { start: 0, end: ${walkEnd} }), frameRate: ${this.playerFrame.fps}, repeat: -1 });`;
                walkUpdate = `    const _vx = this.player.body.velocity.x;
    if (_vx !== 0) { this.player.anims.play("walk", true); this.player.setFlipX(_vx < 0); } else { this.player.anims.stop(); this.player.setFrame(0); }
`;
            }
        }

        return `import Phaser from "phaser";

const WORLD_W = ${this.worldW}, WORLD_H = ${this.worldH}, THICK = ${GROUND_THICKNESS};
const GRAVITY = ${this.gravity}, MOVE_SPEED = ${this.moveSpeed}, JUMP_VELOCITY = ${this.jumpVelocity};
const SPAWN_X = ${this.spawnX}, SPAWN_Y = ${this.spawnY};
const HBW = ${this.hitboxW}, HBH = ${this.hitboxH};
const GOAL_X = ${this.goalX}, GOAL_Y = ${this.goalY};
${levelConst}
class MainScene extends Phaser.Scene {
  constructor() { super("main"); this.won = false; this.t = 0; }
${preloadBlock}  create() {
    this.cameras.main.setBackgroundColor("#6aa0db"); // sky — never a void
${playerCreate}
${level}
    this.goal = this.add.rectangle(GOAL_X, GOAL_Y, 36, 50, 0xf2d933);
    this.physics.add.existing(this.goal, true);
    this.physics.add.overlap(this.player, this.goal, () => { this.won = true; this.status.setText("You win!"); });
${ents}
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H + 2000);
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(${this.zoom});
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys("W,A,D,SPACE");
    this.status = this.add.text(16, 12, ${JSON.stringify(this.hudText)}, { color: "#fff", fontFamily: "monospace", fontSize: "14px" }).setScrollFactor(0);
    window.__GAME_STATE__ = { player_alive: true, player_on_screen: true, player_x: SPAWN_X, player_y: SPAWN_Y, score: 0, goal_reached: false, game_over: false, elapsed_seconds: 0 };
  }
  update(time, delta) {
    const b = this.player.body;
    const left = this.cursors.left.isDown || this.keys.A.isDown;
    const right = this.cursors.right.isDown || this.keys.D.isDown;
    b.setVelocityX(((right ? 1 : 0) - (left ? 1 : 0)) * MOVE_SPEED);
${walkUpdate}    const up = this.cursors.up.isDown || this.keys.W.isDown || this.keys.SPACE.isDown;
    if (up && b.blocked.down) b.setVelocityY(-JUMP_VELOCITY);
    if (this.player.y > WORLD_H + 400) { this.player.setPosition(SPAWN_X, SPAWN_Y); b.setVelocity(0, 0); }
    this.t += delta / 1000;
    window.__GAME_STATE__ = { player_alive: true, player_on_screen: this.player.x >= -100, player_x: this.player.x, player_y: this.player.y, score: 0, goal_reached: this.won, game_over: false, elapsed_seconds: this.t };
    console.log("__GS__ x=" + Math.round(this.player.x) + " y=" + Math.round(this.player.y) + " won=" + this.won);
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: ${this.viewW},
  height: ${this.viewH},
  parent: "game",
  pixelArt: ${this.pixelArt},
  physics: { default: "arcade", arcade: { gravity: { y: GRAVITY } } },
  scene: MainScene,
});
`;
    }
}

const BROWSER_INDEX_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>GameSmith</title>
<style>html,body{margin:0;height:100%;background:#0E0F12;overflow:hidden}canvas{display:block;margin:0 auto}</style>
</head>
<body>
<div id="game"></div>
<script src="./bundle.js"></script>
</body>
</html>
`;

export function makePhaserComposer(): PhaserComposer {
    return new PhaserComposer();
}
