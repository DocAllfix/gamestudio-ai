/**
 * Shared platformer physics profile — the SINGLE source of truth for jump reach.
 *
 * The same numbers drive BOTH the level generator (to space platforms within a
 * jump) AND the player controller the code_gen builds on (FASE 2), so "what the
 * level assumes" always equals "what the code actually does". This is the core
 * of the structure-guaranteed-playable approach: the LLM never invents jump
 * distances; the generator places gaps the controller can clear.
 *
 * Jump-arc math (Perplexity jump-difficulty toolbox, projectile motion):
 *   apex height      h = v² / (2g)
 *   time to apex     t_up = v / g
 *   total air time   t_air ≈ 2·v/g  (symmetric, land at spawn height)
 *   max horizontal   dx = move_speed · t_air
 * Values are in PIXELS (Godot world units); helpers convert to grid CELLS.
 */

/** Physics constants (px, px/s, px/s²). Match these in the Godot controller. */
export interface PhysicsProfile {
    gravity: number;       // px/s²  (downward accel)
    jump_velocity: number; // px/s   (upward, positive magnitude)
    move_speed: number;    // px/s   (horizontal)
}

/** Default profile — sane, forgiving platformer feel. Mirrored in the Godot
 * controller gold (FASE 2): gravity 1200, jump 450, speed 300. */
export const DEFAULT_PLATFORMER_PHYSICS: PhysicsProfile = {
    gravity: 1200,
    jump_velocity: 450,
    move_speed: 300,
};

/** Max jump apex height in pixels: v² / (2g). */
export function maxJumpHeightPx(p: PhysicsProfile): number {
    return (p.jump_velocity * p.jump_velocity) / (2 * p.gravity);
}

/** Max horizontal jump distance in pixels: move_speed · (2v/g). */
export function maxJumpDistancePx(p: PhysicsProfile): number {
    return p.move_speed * (2 * p.jump_velocity / p.gravity);
}

/** Conservative reach in CELLS (apply a safety margin so generated gaps are
 * comfortably clearable, not at the theoretical limit). */
export function jumpReachCells(
    p: PhysicsProfile,
    tilePx: number,
    margin = 0.7,
): { maxGapX: number; maxRiseY: number } {
    const gapPx = maxJumpDistancePx(p) * margin;
    const risePx = maxJumpHeightPx(p) * margin;
    return {
        maxGapX: Math.max(1, Math.floor(gapPx / tilePx)),
        maxRiseY: Math.max(1, Math.floor(risePx / tilePx)),
    };
}
