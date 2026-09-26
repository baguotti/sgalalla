/**
 * Combat for the simulation: light and charged heavy attacks, ground pound,
 * recovery, hitboxes and hits. Items are not simulated yet.
 */

import { AttackDirection, AttackPhase, AttackRegistry, AttackType, attackKey } from './AttackData.js';
import { SIM_STEP_MS } from './FixedStepClock.js';
import { changeState, consumeBuffered, isBuffered, type FighterState, type GhostHitbox } from './FighterState.js';
import { pushPhysicsSounds, type MatchEvent } from './MatchEvents.js';
import { PhysicsConfig } from './PhysicsConfig.js';
import { endChaseDodge, gravityCancel, interruptMovement, startRecovery, type PhysicsEvent } from './PhysicsSimulation.js';

/** Hurtbox, also used for blast zones: narrower and shorter than the physics body. */
export const HURTBOX_WIDTH = 46;
export const HURTBOX_HEIGHT = PhysicsConfig.PLAYER_HEIGHT - 10;

/** Every character's ghost sprite frame is 256×256; the hitbox is a scaled square. */
const GHOST_HITBOX_SIZE = 256 * PhysicsConfig.GHOST_HITBOX_SCALE;
export const GHOST_TRAVEL_MS = 300;
export const GHOST_FADE_MS = 200;

/**
 * cos/sin of each knockback angle as V8 computes them. Hard-coded so every
 * browser engine produces identical knockback (Math.cos/sin may differ in the last bit).
 */
export const KNOCKBACK_DIRECTIONS: Readonly<Record<number, readonly [number, number]>> = {
    4: [0.9975640502598242, 0.0697564737441253],
    20: [0.9396926207859084, 0.3420201433256687],
    30: [0.8660254037844387, 0.49999999999999994],
    45: [0.7071067811865476, 0.7071067811865475],
    50: [0.6427876096865394, 0.766044443118978],
    80: [0.17364817766693041, 0.984807753012208],
    85: [0.08715574274765814, 0.9961946980917455],
    90: [6.123233995736766e-17, 1],
    270: [-1.8369701987210297e-16, -1],
};

export const RECOVERY_KNOCKBACK_ANGLE = 80;

const recoveryEvents: PhysicsEvent[] = [];

// ─── Per-step update ───

/** Charge, attack phases and the hitbox. */
export function updateCombat(f: FighterState, events: MatchEvent[]): void {
    const c = f.combat;

    if (c.attackCooldownTimer > 0) {
        c.attackCooldownTimer -= SIM_STEP_MS;
        if (c.attackCooldownTimer <= 0) c.isGroundPoundLanding = false;
    }

    if (c.chaseDodgeTimer > 0) c.chaseDodgeTimer -= SIM_STEP_MS;

    if (c.ghost) {
        c.ghost.age += SIM_STEP_MS;
        if (c.ghost.age >= c.ghost.lifetime) c.ghost = null;
    }

    if (c.isCharging) updateCharge(f, events);

    if (f.isAttacking || c.isGroundPounding) {
        updateAttack(f, events);
    } else if (f.body.isRecovering) {
        setHitbox(f, f.body.x, f.body.y, PhysicsConfig.RECOVERY_HITBOX_SIZE, PhysicsConfig.RECOVERY_HITBOX_SIZE);
    } else {
        c.hitbox.active = false;
    }
}

function updateCharge(f: FighterState, events: MatchEvent[]): void {
    const c = f.combat;
    c.chargeTime += SIM_STEP_MS;
    if (c.chargeTime >= PhysicsConfig.CHARGE_MAX_TIME) {
        executeChargedAttack(f, events);
        return;
    }
    // A ground pound charge hangs in the air
    if (c.chargeDirection === AttackDirection.DOWN && !f.body.isGrounded) {
        f.body.vx = 0;
        f.body.vy = 0;
    }
}

function updateAttack(f: FighterState, events: MatchEvent[]): void {
    const c = f.combat;
    const b = f.body;
    const attack = c.attack;
    if (!attack) {
        endAttack(f);
        return;
    }

    if (c.isGroundPounding) {
        if (c.groundPoundStartupTimer > 0) {
            c.groundPoundStartupTimer -= SIM_STEP_MS;
            b.vx = 0;
            b.vy = 0;
            return;
        }
        if (b.isGrounded) {
            endGroundPound(f, events);
            return;
        }
        updateHitbox(f);
        b.vy = PhysicsConfig.MAX_FALL_SPEED * 1.5;
        return;
    }

    const complete = advanceAttack(f);

    if (attack.phase === AttackPhase.ACTIVE) {
        updateHitbox(f);
    } else {
        c.hitbox.active = false;
    }

    if (spawnsGhost(f)) {
        spawnGhost(f, events);
    } else {
        clearGhost(f);
    }

    if (complete) {
        endAttack(f);
    } else {
        const data = AttackRegistry[attack.key];
        if (data.type === AttackType.LIGHT && data.direction === AttackDirection.DOWN && !data.isAerial) {
            b.vx *= PhysicsConfig.SLIDE_ATTACK_DECELERATION;
        }
    }
}

/** Advances the attack's phase timer; returns true when the attack is over. */
function advanceAttack(f: FighterState): boolean {
    const attack = f.combat.attack!;
    const data = AttackRegistry[attack.key];
    attack.phaseTimer += SIM_STEP_MS;
    switch (attack.phase) {
        case AttackPhase.STARTUP:
            if (attack.phaseTimer >= data.startupDuration) {
                attack.phase = AttackPhase.ACTIVE;
                attack.phaseTimer = 0;
            }
            break;
        case AttackPhase.ACTIVE:
            if (attack.phaseTimer >= data.activeDuration) {
                attack.phase = AttackPhase.RECOVERY;
                attack.phaseTimer = 0;
            }
            break;
        case AttackPhase.RECOVERY:
            if (attack.phaseTimer >= data.recoveryDuration) {
                attack.phase = AttackPhase.NONE;
                return true;
            }
            break;
    }
    return false;
}

// ─── Input ───

/** Starts attacks, charges and recovery from buffered presses. */
export function handleCombatInput(f: FighterState, events: MatchEvent[]): void {
    const c = f.combat;
    const b = f.body;

    if (c.isGroundPounding) return;

    if (c.isCharging && c.chargeDirection === AttackDirection.DOWN && !b.isGrounded) {
        b.vx = 0;
        b.vy = 0;
    }

    if (c.attackCooldownTimer > 0) return;
    if (f.isHitStunned || f.isAttacking) return;

    const lightRequested = isBuffered(f, 'lightAttack');
    const heavyRequested = isBuffered(f, 'heavyAttack') && !c.isCharging;
    const fromChaseDodge = f.isDodging && b.isChaseDodging;
    if (f.isDodging) {
        // An attack cancels a chase dodge, or gravity cancels an aerial spot dodge
        const gravityCancels = b.isSpotDodging && !b.isGrounded;
        if (!(lightRequested || heavyRequested) || !(b.isChaseDodging || gravityCancels)) return;
        if (b.isChaseDodging) {
            endChaseDodge(b);
        } else {
            gravityCancel(b);
            c.gravityCancel = true;
        }
        f.isDodging = false;
    }
    // A gravity cancel uses the grounded moves in the air
    const isAerial = !b.isGrounded && !c.gravityCancel;

    if (lightRequested) {
        consumeBuffered(f, 'lightAttack');
        const direction = inputDirection(f);
        // Out of a chase dodge it's the aimed attack, not the running one
        const isRunSpeed = Math.abs(b.vx) > PhysicsConfig.MAX_SPEED * 0.8;
        if ((b.isRunning || isRunSpeed) && b.isGrounded && direction !== AttackDirection.DOWN && !fromChaseDodge) {
            startAttack(f, 'light_run_grounded', events);
        } else {
            startAttack(f, attackKey(AttackType.LIGHT, direction, isAerial), events);
        }
        return;
    }

    if (heavyRequested) {
        consumeBuffered(f, 'heavyAttack');
        const direction = inputDirection(f);

        // Up or neutral heavy in the air is the recovery move
        if ((direction === AttackDirection.UP || direction === AttackDirection.NEUTRAL) && isAerial) {
            c.hitTargets = 0;
            recoveryEvents.length = 0;
            if (startRecovery(b, recoveryEvents)) {
                changeState(f, 'Recovery');
                pushPhysicsSounds(events, f.id, recoveryEvents);
            }
            return;
        }

        c.isCharging = true;
        changeState(f, 'Charging');
        c.chargeTime = 0;
        // A grounded down heavy charges the side signature
        c.chargeDirection = direction === AttackDirection.DOWN && !isAerial ? AttackDirection.SIDE : direction;
        return;
    }

    if (c.isCharging && !f.input.heavyAttackHeld) {
        executeChargedAttack(f, events);
    }
}

function inputDirection(f: FighterState): AttackDirection {
    const input = f.input;
    if (input.aimUp && !input.aimDown) return AttackDirection.UP;
    if (input.aimDown && !input.aimUp) return AttackDirection.DOWN;
    if ((input.aimLeft || input.aimRight) && !input.aimUp && !input.aimDown) return AttackDirection.SIDE;
    return AttackDirection.NEUTRAL;
}

// ─── Starting and ending moves ───

function beginAttack(f: FighterState, key: string): void {
    const c = f.combat;
    clearGhost(f);
    c.attack = { key, phase: AttackPhase.STARTUP, phaseTimer: 0, facing: f.body.facingDirection };
    f.isAttacking = true;
    changeState(f, 'Attack');
    c.hitTargets = 0;
}

function startAttack(f: FighterState, key: string, events: MatchEvent[]): void {
    const c = f.combat;
    const facing = f.body.facingDirection;
    if (c.isCharging) clearCharge(f);

    beginAttack(f, key);
    events.push({ type: 'attack', fighter: f.id, key, charged: false });

    if (AttackRegistry[key].type === AttackType.LIGHT) {
        c.lightAttackVariant = (c.lightAttackVariant + 1) % 2;
    }

    if (key === 'light_down_grounded') {
        f.body.vx = facing * PhysicsConfig.SLIDE_ATTACK_SPEED;
    } else if (key === 'light_run_grounded') {
        f.body.vx = facing * (PhysicsConfig.SLIDE_ATTACK_SPEED * 1.2);
    }

    if (spawnsGhost(f)) spawnGhost(f, events);
}

function startChargedAttack(f: FighterState, key: string, events: MatchEvent[]): void {
    beginAttack(f, key);
    events.push({ type: 'attack', fighter: f.id, key, charged: true });
    if (spawnsGhost(f)) spawnGhost(f, events);
    f.combat.attackCooldownTimer = AttackRegistry[key].recoveryDuration;
}

function executeChargedAttack(f: FighterState, events: MatchEvent[]): void {
    const c = f.combat;
    const direction = c.chargeDirection;
    const isAerial = !f.body.isGrounded && !c.gravityCancel;
    const chargePercent = Math.min(c.chargeTime / PhysicsConfig.CHARGE_MAX_TIME, 1);
    c.lastChargeTime = c.chargeTime;

    if (direction === AttackDirection.DOWN && isAerial) {
        clearCharge(f);
        startGroundPound(f, chargePercent);
        return;
    }

    startChargedAttack(f, attackKey(AttackType.HEAVY, direction, isAerial), events);
    clearCharge(f);
}

function startGroundPound(f: FighterState, chargePercent: number): void {
    const c = f.combat;
    c.isGroundPounding = true;
    c.groundPoundChargeRatio = chargePercent;
    c.groundPoundStartupTimer = PhysicsConfig.GROUND_POUND_STARTUP;
    f.body.vx = 0;
    f.body.vy = 0;

    c.attack = {
        key: attackKey(AttackType.HEAVY, AttackDirection.DOWN, true),
        phase: AttackPhase.STARTUP,
        phaseTimer: 0,
        facing: f.body.facingDirection,
    };
    f.isAttacking = true;
    changeState(f, 'GroundPound');
    c.hitTargets = 0;
}

function endAttack(f: FighterState): void {
    const c = f.combat;
    f.isAttacking = false;
    c.isGroundPounding = false;
    c.attack = null;
    c.hitbox.active = false;
    c.gravityCancel = false;
    clearGhost(f);
    clearCharge(f);

    // Fok's charged side signature leaves a longer, punishable recovery
    if (f.character === 'fok' && c.lastChargeTime > 0) {
        const chargeRatio = Math.min(c.lastChargeTime / PhysicsConfig.CHARGE_MAX_TIME, 1);
        c.attackCooldownTimer = 100 + (chargeRatio * 600);
    } else {
        c.attackCooldownTimer = 100;
    }
    c.lastChargeTime = 0;
}

function endGroundPound(f: FighterState, events: MatchEvent[]): void {
    const c = f.combat;
    if (c.hitTargets === 0) events.push({ type: 'groundPoundMiss', fighter: f.id });
    f.isAttacking = false;
    c.isGroundPounding = false;
    c.isGroundPoundLanding = true;
    c.attack = null;
    c.hitbox.active = false;
    c.gravityCancel = false;
    c.attackCooldownTimer = PhysicsConfig.GROUND_POUND_STARTUP;
    if (f.body.isGrounded) f.body.vx *= 0.5;
}

function clearCharge(f: FighterState): void {
    f.combat.isCharging = false;
    f.combat.chargeTime = 0;
}

/** A chase dodge cuts the attack that hit short, leaving no cooldown so it can go straight into the next. */
export function cancelAttackForChaseDodge(f: FighterState): void {
    const c = f.combat;
    f.isAttacking = false;
    c.isGroundPounding = false;
    // The cooldown that would end the ground pound's landing pose is gone too
    c.isGroundPoundLanding = false;
    c.attack = null;
    c.hitbox.active = false;
    c.gravityCancel = false;
    c.attackCooldownTimer = 0;
    c.lastChargeTime = 0;
    c.chaseDodgeTimer = 0;
    clearGhost(f);
}

// ─── Hitboxes ───

function setHitbox(f: FighterState, x: number, y: number, w: number, h: number): void {
    const hitbox = f.combat.hitbox;
    hitbox.active = true;
    hitbox.x = x;
    hitbox.y = y;
    hitbox.w = w;
    hitbox.h = h;
}

function updateHitbox(f: FighterState): void {
    const c = f.combat;
    const b = f.body;
    const attack = c.attack!;
    const data = AttackRegistry[attack.key];

    let offsetX = data.hitboxOffsetX * attack.facing;
    let offsetY = data.hitboxOffsetY;
    let width = data.hitboxWidth;
    let height = data.hitboxHeight;

    if (data.type === AttackType.HEAVY && data.direction === AttackDirection.DOWN) {
        // Centred under the feet
        offsetX = 0;
        offsetY = PhysicsConfig.PLAYER_HEIGHT / 2;
        width = 127;
        height = 30;
    }
    if (data.type === AttackType.HEAVY && (data.direction === AttackDirection.UP || data.direction === AttackDirection.NEUTRAL)) {
        // Flat and wide above the head
        offsetX = 0;
        offsetY = -PhysicsConfig.PLAYER_HEIGHT / 2;
        width = PhysicsConfig.UP_SIG_HITBOX_WIDTH;
        height = PhysicsConfig.UP_SIG_HITBOX_HEIGHT;
    }
    if (data.type === AttackType.LIGHT &&
        (data.direction === AttackDirection.SIDE || data.direction === AttackDirection.NEUTRAL || data.direction === AttackDirection.UP)) {
        width = PhysicsConfig.SIDE_LIGHT_HITBOX_WIDTH;
        offsetX += b.facingDirection * PhysicsConfig.SIDE_LIGHT_OFFSET_EXTRA;
    }

    let x = b.x + offsetX;
    let y = b.y + offsetY;

    if (spawnsGhost(f)) {
        if (c.ghost) {
            [x, y] = ghostPosition(c.ghost);
            width = GHOST_HITBOX_SIZE;
            height = GHOST_HITBOX_SIZE;
        } else if (c.hasSpawnedGhost) {
            // The ghost has faded: the move no longer hits
            c.hitbox.active = false;
            return;
        }
    }

    setHitbox(f, x, y, width, height);
}

// ─── Signature ghosts ───

/** Heavy side, up and neutral attacks throw a ghost the hitbox follows. */
function spawnsGhost(f: FighterState): boolean {
    const attack = f.combat.attack;
    if (!attack) return false;
    const data = AttackRegistry[attack.key];
    return data.type === AttackType.HEAVY && data.direction !== AttackDirection.DOWN;
}

function spawnGhost(f: FighterState, events: MatchEvent[]): void {
    const c = f.combat;
    if (c.hasSpawnedGhost) return;

    const b = f.body;
    const facing = b.facingDirection;
    const direction = AttackRegistry[c.attack!.key].direction;
    const vertical = direction === AttackDirection.UP || direction === AttackDirection.NEUTRAL;
    const baseOffset = f.character === 'nock' ? 35 : 25;

    let startX = b.x + (baseOffset * facing);
    let startY = b.y;
    if (vertical) {
        startY -= 15;
    } else {
        startX += (15 * facing);
    }

    const chargeRatio = Math.min(c.lastChargeTime / PhysicsConfig.CHARGE_MAX_TIME, 1);
    c.ghost = {
        age: 0,
        lifetime: 100 + (chargeRatio * 600) + GHOST_FADE_MS,
        startX,
        startY,
        travel: 110 + (chargeRatio * 35),
        facing,
        vertical,
    };
    c.hasSpawnedGhost = true;
    events.push({ type: 'ghost', fighter: f.id, ghost: { ...c.ghost } });
}

function clearGhost(f: FighterState): void {
    f.combat.hasSpawnedGhost = false;
    f.combat.ghost = null;
}

/** Ghost position: travels forward (or up) with a cubic ease-out. */
function ghostPosition(g: GhostHitbox): [number, number] {
    const v = Math.min(g.age / GHOST_TRAVEL_MS, 1) - 1;
    const eased = v * v * v + 1;
    if (g.vertical) {
        const endY = g.startY - g.travel;
        return [g.startX, g.startY + (endY - g.startY) * eased];
    }
    const endX = g.startX + (g.travel * g.facing);
    return [g.startX + (endX - g.startX) * eased, g.startY];
}

// ─── Hits ───

/** Attacker's hitbox against the target's hurtbox. */
export function checkHit(attacker: FighterState, target: FighterState, events: MatchEvent[]): void {
    const c = attacker.combat;
    const targetBit = 1 << target.id;
    if (c.hitTargets & targetBit) return;
    if (!c.attack && !attacker.body.isRecovering) return;

    const hitbox = c.hitbox;
    if (!hitbox.active) return;

    // Inclusive overlap, as Phaser's RectangleToRectangle
    const left = hitbox.x - hitbox.w / 2;
    const top = hitbox.y - hitbox.h / 2;
    const targetLeft = target.body.x - HURTBOX_WIDTH / 2;
    const targetTop = target.body.y - HURTBOX_HEIGHT / 2;
    if (hitbox.w <= 0 || hitbox.h <= 0) return;
    if (left + hitbox.w < targetLeft || top + hitbox.h < targetTop ||
        left > targetLeft + HURTBOX_WIDTH || top > targetTop + HURTBOX_HEIGHT) return;

    c.hitTargets |= targetBit;
    if (target.body.isInvincible || target.isInvulnerable) return;

    applyHit(attacker, target, events);
}

/** Damage the fighter's current move deals. */
export function currentDamage(f: FighterState): number {
    const c = f.combat;
    if (!c.attack) return f.body.isRecovering ? PhysicsConfig.RECOVERY_DAMAGE : 0;

    let damage = AttackRegistry[c.attack.key].damage;
    if (spawnsGhost(f)) {
        // Signature damage scales with charge
        const chargeRatio = Math.min(c.lastChargeTime / PhysicsConfig.CHARGE_MAX_TIME, 1);
        damage = PhysicsConfig.SIDE_SIG_MIN_DAMAGE + (chargeRatio * (PhysicsConfig.SIDE_SIG_MAX_DAMAGE - PhysicsConfig.SIDE_SIG_MIN_DAMAGE));
    }
    if (c.isGroundPounding) {
        damage = 4 + (c.groundPoundChargeRatio * (12 - 4));
    }
    return Math.floor(damage);
}

function applyHit(attacker: FighterState, target: FighterState, events: MatchEvent[]): void {
    const c = attacker.combat;
    let damage: number;
    let baseKnockback: number;
    let knockbackGrowth: number;
    let angle: number;

    if (c.attack) {
        const data = AttackRegistry[c.attack.key];
        damage = currentDamage(attacker);
        baseKnockback = data.baseKnockback || 150;
        knockbackGrowth = data.knockbackGrowth || 5;
        angle = data.knockbackAngle;

        if (data.type === AttackType.HEAVY && data.direction === AttackDirection.SIDE) {
            // A fully charged side signature knocks back harder
            const chargeRatio = Math.min(c.lastChargeTime / PhysicsConfig.CHARGE_MAX_TIME, 1);
            baseKnockback = baseKnockback * (1.0 + (chargeRatio * 0.5));
            knockbackGrowth = knockbackGrowth * (1.0 + (chargeRatio * 0.3));
        }
        if (c.isGroundPounding) {
            baseKnockback = baseKnockback * (1.0 + (c.groundPoundChargeRatio * 0.8));
            knockbackGrowth = knockbackGrowth * (1.0 + (c.groundPoundChargeRatio * 0.5));
        }
    } else {
        damage = PhysicsConfig.RECOVERY_DAMAGE;
        baseKnockback = 250;
        knockbackGrowth = 8;
        angle = RECOVERY_KNOCKBACK_ANGLE;
    }

    const knockback = baseKnockback + knockbackGrowth * PhysicsConfig.GLOBAL_KNOCKBACK_SCALING * (target.damagePercent + damage);
    const [cos, sin] = KNOCKBACK_DIRECTIONS[angle];
    const knockbackX = cos * knockback * attacker.body.facingDirection;
    let knockbackY = -sin * knockback;

    const tb = target.body;
    // Spiking a grounded target bounces it up
    if (tb.isGrounded && knockbackY > 0) {
        knockbackY *= -0.8;
        tb.y -= 10;
    }

    target.damagePercent = Math.min(target.damagePercent + damage, PhysicsConfig.MAX_DAMAGE);
    interruptMovement(tb);
    tb.vx = knockbackX;
    tb.vy = knockbackY;
    target.isHitStunned = true;
    target.hitStunTimer = PhysicsConfig.HIT_STUN_DURATION;
    changeState(target, 'HitStun');

    // Hitting or being hit restarts the wall slip count; a target out of jumps gets one back
    tb.airActionCounter = 0;
    attacker.body.airActionCounter = 0;
    if (tb.jumpsRemaining === 0) tb.jumpsRemaining = 1;

    // The attacker can chase: a directional dodge until a moment after this attack ends
    c.chaseDodgeTimer = remainingAttackTime(attacker) + PhysicsConfig.CHASE_DODGE_WINDOW;

    events.push({ type: 'hit', attacker: attacker.id, target: target.id, attackKey: c.attack?.key ?? null });
}

/** Time left in the fighter's current move, in ms. */
function remainingAttackTime(f: FighterState): number {
    const attack = f.combat.attack;
    if (!attack) return f.body.isRecovering ? f.body.recoveryTimer : 0;
    const data = AttackRegistry[attack.key];
    switch (attack.phase) {
        case AttackPhase.STARTUP: return data.startupDuration - attack.phaseTimer + data.activeDuration + data.recoveryDuration;
        case AttackPhase.ACTIVE: return data.activeDuration - attack.phaseTimer + data.recoveryDuration;
        case AttackPhase.RECOVERY: return data.recoveryDuration - attack.phaseTimer;
        default: return 0;
    }
}

