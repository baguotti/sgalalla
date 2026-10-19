/**
 * Combat for the simulation: light and charged heavy attacks, ground pound,
 * recovery, hitboxes and hits. Items are not simulated yet.
 */

import { AttackDirection, AttackPhase, AttackRegistry, AttackType, attackKey } from './AttackData.js';
import { countDown, SIM_STEP_MS } from './FixedStepClock.js';
import { changeState, consumeBuffered, isBuffered, type FighterState, type GhostHitbox } from './FighterState.js';
import { pushPhysicsSounds, type MatchEvent } from './MatchEvents.js';
import { PhysicsConfig } from './PhysicsConfig.js';
import { endChaseDodge, gravityCancel, interruptMovement, startRecovery, type PhysicsEvent } from './PhysicsSimulation.js';

/** Every character's ghost sprite frame is 256×256; the hitbox is a scaled square. */
const GHOST_FRAME_SIZE = 256;

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

const recoveryEvents: PhysicsEvent[] = [];

// ─── Per-step update ───

/** Charge, attack phases and the hitbox. */
export function updateCombat(f: FighterState, events: MatchEvent[]): void {
    const c = f.combat;

    if (c.attackCooldownTimer > 0) {
        c.attackCooldownTimer = countDown(c.attackCooldownTimer);
        // The ground pound's landing pose lasts as long as its cooldown
        if (c.attackCooldownTimer <= 0) c.isGroundPoundLanding = false;
    }

    if (c.chaseDodgeTimer > 0) c.chaseDodgeTimer = countDown(c.chaseDodgeTimer);

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
    // A ground pound's charge hangs in the air
    if (isGroundPoundCharge(f)) {
        f.body.vx = 0;
        f.body.vy = 0;
    }
}

/** Charging a ground pound: a down heavy charging in the air (it hangs there). */
export function isGroundPoundCharge(f: FighterState): boolean {
    const c = f.combat;
    return c.isCharging && c.chargeDirection === AttackDirection.DOWN && !f.body.isGrounded && !c.gravityCancel;
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
        // It hangs through its startup, then falls until it lands
        if (attack.phase === AttackPhase.STARTUP) {
            advanceAttack(f);
            b.vx = 0;
            b.vy = 0;
            return;
        }
        if (b.isGrounded) {
            endGroundPound(f, events);
            return;
        }
        updateHitbox(f);
        b.vy = PhysicsConfig.MAX_FALL_SPEED * PhysicsConfig.GROUND_POUND_FALL_MULT;
        return;
    }

    const complete = advanceAttack(f);
    // The side light lunges as it punches (its startup holds still, as in Brawlhalla)
    if (attack.key === 'light_side_grounded' && attack.phase === AttackPhase.ACTIVE && attack.phaseTimer === 0 && b.isGrounded) {
        b.vx = attack.facing * PhysicsConfig.SIDE_LIGHT_LUNGE_SPEED;
    }

    // A signature's ghost comes out with the punch, and hits where it is
    if (spawnsGhost(f)) {
        if (attack.phase === AttackPhase.ACTIVE) spawnGhost(f, events);
    } else {
        clearGhost(f);
    }

    if (attack.phase === AttackPhase.ACTIVE) {
        updateHitbox(f);
    } else {
        c.hitbox.active = false;
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

/** Advances the attack's phase timer (in frames); returns true when the attack is over. */
function advanceAttack(f: FighterState): boolean {
    const attack = f.combat.attack!;
    const data = AttackRegistry[attack.key];
    attack.phaseTimer++;
    switch (attack.phase) {
        case AttackPhase.STARTUP:
            if (attack.phaseTimer >= data.startup) {
                attack.phase = AttackPhase.ACTIVE;
                attack.phaseTimer = 0;
            }
            break;
        case AttackPhase.ACTIVE:
            if (attack.phaseTimer >= data.active) {
                attack.phase = AttackPhase.RECOVERY;
                attack.phaseTimer = 0;
            }
            break;
        case AttackPhase.RECOVERY:
            if (attack.phaseTimer >= data.recovery) {
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

    if (c.isGroundPounding) {
        // A ground pound over nothing can be saved: a jump, an air dodge or the recovery cuts it short
        if (!canCancelGroundPound(f)) return;
        cancelAttack(f);
    }
    if (isGroundPoundCharge(f)) {
        b.vx = 0;
        b.vy = 0;
    }
    // Every move ends with a short cooldown before the next one
    if (c.attackCooldownTimer > 0 || b.landingLagSteps > 0) return;
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
        const direction = inputDirection(f);
        // Out of a chase dodge it's the aimed attack, not the running one
        const isRunSpeed = Math.abs(b.vx) > PhysicsConfig.RUN_SPEED * PhysicsConfig.RUN_ATTACK_MIN_SPEED;
        const key = (b.isRunning || isRunSpeed) && b.isGrounded && direction !== AttackDirection.DOWN && !fromChaseDodge
            ? 'light_run_grounded'
            : attackKey(AttackType.LIGHT, direction, isAerial);
        consumeBuffered(f, 'lightAttack');
        startAttack(f, key, events);
        return;
    }

    if (heavyRequested) {
        const direction = inputDirection(f);
        consumeBuffered(f, 'heavyAttack');

        // Up or neutral heavy in the air is the recovery move
        if (isAerial && (direction === AttackDirection.UP || direction === AttackDirection.NEUTRAL)) {
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
        // The charge faces the way the fighter points as it presses, and keeps that way
        const input = f.input;
        const point = (input.aimRight || input.moveRight ? 1 : 0) - (input.aimLeft || input.moveLeft ? 1 : 0);
        if (point !== 0) b.facingDirection = point;
        // A grounded down heavy charges the side signature; in the air it charges the ground pound
        c.chargeDirection = direction === AttackDirection.DOWN && !isAerial ? AttackDirection.SIDE : direction;
        return;
    }

    if (c.isCharging && !f.input.heavyAttackHeld) {
        executeChargedAttack(f, events);
    }
}

/** A jump, air dodge or recovery is pressed, and the fighter has one left. */
function canCancelGroundPound(f: FighterState): boolean {
    const b = f.body;
    const recovery = isBuffered(f, 'heavyAttack') && f.input.aimUp && (b.recoveryAvailable || b.jumpsRemaining > 0);
    return recovery || (isBuffered(f, 'jump') && b.jumpsRemaining > 0) || (isBuffered(f, 'dodge') && b.dodgeCooldownTimer <= 0);
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
        f.body.vx = facing * (PhysicsConfig.SLIDE_ATTACK_SPEED * PhysicsConfig.RUN_ATTACK_SPEED_MULT);
    }
}

function executeChargedAttack(f: FighterState, events: MatchEvent[]): void {
    const c = f.combat;
    const isAerial = !f.body.isGrounded && !c.gravityCancel;
    const groundPound = isGroundPoundCharge(f);
    // Side is the only heavy with its own aerial move; up and neutral in the air are the recovery
    // (a ground pound charge that somehow touched down is the side signature)
    const direction = c.chargeDirection === AttackDirection.DOWN && !groundPound ? AttackDirection.SIDE : c.chargeDirection;
    const key = attackKey(AttackType.HEAVY, direction, isAerial && (groundPound || direction === AttackDirection.SIDE));
    c.lastChargeTime = c.chargeTime;
    clearCharge(f);
    if (groundPound) {
        startGroundPound(f, key);
        return;
    }
    beginAttack(f, key);
    events.push({ type: 'attack', fighter: f.id, key, charged: true });
}

function startGroundPound(f: FighterState, key: string): void {
    const c = f.combat;
    c.isGroundPounding = true;
    f.body.vx = 0;
    f.body.vy = 0;
    c.attack = { key, phase: AttackPhase.STARTUP, phaseTimer: 0, facing: f.body.facingDirection };
    f.isAttacking = true;
    changeState(f, 'GroundPound');
    c.hitTargets = 0;
}

/** Landing ends the ground pound: its landing pose lasts its recovery, as a cooldown. */
function endGroundPound(f: FighterState, events: MatchEvent[]): void {
    const c = f.combat;
    if (c.hitTargets === 0) events.push({ type: 'groundPoundMiss', fighter: f.id });
    const recovery = AttackRegistry[c.attack!.key].recovery;
    endAttack(f);
    c.isGroundPoundLanding = true;
    c.attackCooldownTimer = recovery * SIM_STEP_MS;
    f.body.vx *= PhysicsConfig.GROUND_POUND_LANDING_SPEED_KEPT;
}

function endAttack(f: FighterState): void {
    const c = f.combat;
    c.attackCooldownTimer = PhysicsConfig.ATTACK_END_COOLDOWN;
    f.isAttacking = false;
    c.isGroundPounding = false;
    c.isGroundPoundLanding = false;
    c.attack = null;
    c.hitbox.active = false;
    c.gravityCancel = false;
    clearGhost(f);
    clearCharge(f);
    c.lastChargeTime = 0;
}

/** A heavy's charge, 0 to 1. */
function chargeRatio(f: FighterState): number {
    return Math.min(f.combat.lastChargeTime / PhysicsConfig.CHARGE_MAX_TIME, 1);
}

function clearCharge(f: FighterState): void {
    f.combat.isCharging = false;
    f.combat.chargeTime = 0;
}

/**
 * Cuts the current attack short, leaving no cooldown so the fighter can go straight into
 * the next thing: a chase dodge after a hit, or a jump, dodge or recovery out of a ground pound.
 */
export function cancelAttack(f: FighterState): void {
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

    // Signatures hit where their ghost is, until it has faded
    if (spawnsGhost(f)) {
        if (c.ghost) {
            const [x, y] = ghostPosition(c.ghost);
            const size = GHOST_FRAME_SIZE * PhysicsConfig.GHOST_HITBOX_SCALE;
            setHitbox(f, x, y, size, size);
        } else {
            c.hitbox.active = false;
        }
        return;
    }

    setHitbox(f, b.x + data.hitboxOffsetX * attack.facing, b.y + data.hitboxOffsetY, data.hitboxWidth, data.hitboxHeight);
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
    const baseOffset = f.character === 'nock' ? PhysicsConfig.NOCK_GHOST_OFFSET : PhysicsConfig.GHOST_OFFSET;

    let startX = b.x + (baseOffset * facing);
    let startY = b.y;
    if (vertical) {
        startY -= PhysicsConfig.GHOST_LIFT;
    } else {
        startX += (PhysicsConfig.GHOST_FORWARD * facing);
    }

    const charge = chargeRatio(f);
    c.ghost = {
        age: 0,
        lifetime: PhysicsConfig.GHOST_LIFETIME + (charge * PhysicsConfig.GHOST_LIFETIME_PER_CHARGE) + PhysicsConfig.GHOST_FADE_MS,
        startX,
        startY,
        travel: PhysicsConfig.GHOST_TRAVEL + (charge * PhysicsConfig.GHOST_TRAVEL_PER_CHARGE),
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
    const v = Math.min(g.age / PhysicsConfig.GHOST_TRAVEL_MS, 1) - 1;
    const eased = v * v * v + 1;
    if (g.vertical) {
        const endY = g.startY - g.travel;
        return [g.startX, g.startY + (endY - g.startY) * eased];
    }
    const endX = g.startX + (g.travel * g.facing);
    return [g.startX + (endX - g.startX) * eased, g.startY];
}

// ─── Hits ───

/** A hit found this step: everything it does, worked out before any hit of the step lands. */
export interface Hit {
    attacker: FighterState;
    target: FighterState;
    attackKey: string | null;
    damage: number;
    knockbackX: number;
    knockbackY: number;
    stun: number;
    hitstop: number;
    /** A spike on a grounded target, turned into a pop-up: the target is lifted off the floor. */
    popUp: boolean;
    /** Where it landed: the hitbox's middle, within the target's hurtbox. */
    x: number;
    y: number;
}

/**
 * The attacker's hitbox against the target's hurtbox: the hit, or null. Every
 * hit of a step is found first and applied after (applyHit), so two fighters
 * hitting each other on the same step both get hit, whatever their slots.
 */
export function findHit(attacker: FighterState, target: FighterState): Hit | null {
    const c = attacker.combat;
    const targetBit = 1 << target.id;
    if (c.hitTargets & targetBit) return null;
    if (!c.attack && !attacker.body.isRecovering) return null;

    const hitbox = c.hitbox;
    if (!hitbox.active || hitbox.w <= 0 || hitbox.h <= 0) return null;

    // Inclusive overlap, as Phaser's RectangleToRectangle
    const left = hitbox.x - hitbox.w / 2;
    const top = hitbox.y - hitbox.h / 2;
    const hurtW = PhysicsConfig.HURTBOX_WIDTH;
    const hurtH = PhysicsConfig.HURTBOX_HEIGHT;
    const tb = target.body;
    const targetLeft = tb.x - hurtW / 2;
    const targetTop = tb.y - hurtH / 2;
    if (left + hitbox.w < targetLeft || top + hitbox.h < targetTop ||
        left > targetLeft + hurtW || top > targetTop + hurtH) return null;

    c.hitTargets |= targetBit;
    if (tb.isInvincible || target.isInvulnerable) return null;

    let fixedForce: number;
    let variableForce: number;
    let angle: number;
    let stun: number;
    if (c.attack) {
        const data = AttackRegistry[c.attack.key];
        fixedForce = data.fixedForce;
        variableForce = data.variableForce * chargeBonus(attacker);
        angle = data.knockbackAngle;
        stun = data.stun;
    } else {
        fixedForce = PhysicsConfig.RECOVERY_FIXED_FORCE;
        variableForce = PhysicsConfig.RECOVERY_VARIABLE_FORCE;
        angle = PhysicsConfig.RECOVERY_KNOCKBACK_ANGLE;
        stun = PhysicsConfig.RECOVERY_STUN;
    }
    const damage = currentDamage(attacker);

    const knockback = knockbackSpeed(fixedForce, variableForce, target.damagePercent + damage);
    const [cos, sin] = KNOCKBACK_DIRECTIONS[angle];
    let knockbackY = liftAtHighDamage(-sin * knockback, target.damagePercent + damage);
    // Spiking a grounded target pops it up
    const popUp = tb.isGrounded && knockbackY > 0;
    if (popUp) knockbackY *= -PhysicsConfig.GROUNDED_SPIKE_BOUNCE;

    return {
        attacker, target, attackKey: c.attack?.key ?? null, damage,
        knockbackX: cos * knockback * attacker.body.facingDirection, knockbackY, stun, popUp,
        hitstop: hitstopFor(knockback),
        x: Math.min(Math.max(hitbox.x, targetLeft), targetLeft + hurtW),
        y: Math.min(Math.max(hitbox.y, targetTop), targetTop + hurtH),
    };
}

/** Brawlhalla's force, in px/s: the variable part grows with the target's damage after the hit, steeply past red. */
export function knockbackSpeed(fixedForce: number, variableForce: number, damageAfter: number): number {
    const d = Math.min(damageAfter, PhysicsConfig.MAX_DAMAGE);
    return (fixedForce + variableForce * (d / 100 + (d * d) / 20000)) * PhysicsConfig.FORCE_SCALE;
}

/**
 * A launch's upward speed, raised once the target is red (HIGH_DAMAGE_FROM): up to HIGH_DAMAGE_LIFT more
 * over the next HIGH_DAMAGE_RANGE of damage, so damaged fighters fly up and out of the top.
 */
export function liftAtHighDamage(knockbackY: number, damageAfter: number): number {
    if (knockbackY >= 0) return knockbackY;
    const past = Math.min(Math.max(damageAfter - PhysicsConfig.HIGH_DAMAGE_FROM, 0) / PhysicsConfig.HIGH_DAMAGE_RANGE, 1);
    return knockbackY * (1 + past * PhysicsConfig.HIGH_DAMAGE_LIFT);
}

/** Hit pause in steps: a moment, longer for hits that launch harder. */
export function hitstopFor(knockback: number): number {
    return Math.min(PhysicsConfig.HITSTOP_MAX_STEPS, PhysicsConfig.HITSTOP_MIN_STEPS + Math.floor(knockback / PhysicsConfig.HITSTOP_SPEED_PER_STEP));
}

/** Damage the fighter's current move deals. */
export function currentDamage(f: FighterState): number {
    const c = f.combat;
    if (!c.attack) return f.body.isRecovering ? PhysicsConfig.RECOVERY_DAMAGE : 0;
    return Math.floor(AttackRegistry[c.attack.key].damage * chargeBonus(f));
}

/** A charged heavy deals more damage and variable force: up to FULL_CHARGE_BONUS more at full charge. */
function chargeBonus(f: FighterState): number {
    return 1 + chargeRatio(f) * PhysicsConfig.FULL_CHARGE_BONUS;
}

/** Lands a hit found by findHit. */
export function applyHit(hit: Hit, events: MatchEvent[]): void {
    const { attacker, target } = hit;
    const tb = target.body;
    if (hit.popUp) tb.y -= PhysicsConfig.GROUNDED_SPIKE_LIFT;
    launchFighter(target, hit.damage, hit.knockbackX, hit.knockbackY, hit.stun, hit.hitstop);
    // Hitting restarts the wall slip count too
    attacker.body.airActionCounter = 0;

    // An attacker hit back on the same step (a trade) is stunned: its move is over
    const c = attacker.combat;
    if (!attacker.isHitStunned) {
        // The attacker can chase: a directional dodge until a moment after this attack ends
        c.chaseDodgeTimer = remainingAttackTime(attacker) + PhysicsConfig.CHASE_DODGE_WINDOW;
    }

    attacker.hitstopSteps = Math.max(attacker.hitstopSteps, hit.hitstop);

    events.push({
        type: 'hit', attacker: attacker.id, target: target.id, attackKey: hit.attackKey,
        x: hit.x, y: hit.y, damage: hit.damage, knockbackX: tb.vx, knockbackY: tb.vy,
    });
}

/** What any hit does to its target (a move's or an explosion's): damage, the launch, stun and hit pause. */
export function launchFighter(target: FighterState, damage: number, knockbackX: number, knockbackY: number, stun: number, hitstop: number): void {
    const tb = target.body;
    target.damagePercent = Math.min(target.damagePercent + damage, PhysicsConfig.MAX_DAMAGE);
    interruptMovement(tb);
    tb.vx = knockbackX;
    tb.vy = knockbackY;
    tb.isLaunched = true;
    tb.isJumpRising = false;
    target.isHitStunned = true;
    target.hitStunTimer = stun * SIM_STEP_MS;
    changeState(target, 'HitStun');
    target.hitstopSteps = Math.max(target.hitstopSteps, hitstop);
    // Being hit restarts the wall slip count; a target out of jumps gets one back
    tb.airActionCounter = 0;
    if (tb.jumpsRemaining === 0) tb.jumpsRemaining = 1;
}

/** Time left in the fighter's current move, in ms. */
function remainingAttackTime(f: FighterState): number {
    const attack = f.combat.attack;
    if (!attack) return f.body.isRecovering ? f.body.recoveryTimer : 0;
    const data = AttackRegistry[attack.key];
    const recovery = data.recovery;
    switch (attack.phase) {
        case AttackPhase.STARTUP: return (data.startup - attack.phaseTimer + data.active + recovery) * SIM_STEP_MS;
        case AttackPhase.ACTIVE: return (data.active - attack.phaseTimer + recovery) * SIM_STEP_MS;
        case AttackPhase.RECOVERY: return (recovery - attack.phaseTimer) * SIM_STEP_MS;
        default: return 0;
    }
}
