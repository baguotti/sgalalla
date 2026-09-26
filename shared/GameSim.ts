/**
 * GameSim — deterministic match simulation.
 *
 * Plain data only: no Phaser, no wall-clock time, no Math.random. `stepMatch`
 * advances the match by one fixed step of SIM_STEP_MS and reports what happened
 * as events. tests/sim.test.ts replays recorded matches and checks every step
 * reproduces the recording exactly.
 */

import { countDown, SIM_STEP_MS } from './FixedStepClock.js';
import { AttackPhase, AttackRegistry, AttackType } from './AttackData.js';
import { HURTBOX_HEIGHT, HURTBOX_WIDTH, cancelAttackForChaseDodge, checkHit, handleCombatInput, updateCombat } from './Combat.js';
import type { FighterInput } from './FighterInput.js';
import {
    FIGHTER_STATES, changeState, consumeBuffered, createFighter, holdInputBuffer, isBuffered, isInPlay, updateInputBuffer, updateState,
    type FighterSetup, type FighterState, type FighterStateName,
} from './FighterState.js';
import { pushPhysicsSounds, type MatchEvent } from './MatchEvents.js';
import { PhysicsConfig } from './PhysicsConfig.js';
import {
    type SimInput as PhysicsInput, type PhysicsEvent,
    stepPhysics, checkSinglePlatformCollision, resetWallState, checkSingleWallCollision, checkSingleCeilingCollision,
    ATTACK_PHASE_NONE, ATTACK_PHASE_STARTUP, ATTACK_PHASE_ACTIVE, ATTACK_PHASE_RECOVERY,
    ATTACK_TYPE_NONE, ATTACK_TYPE_LIGHT, ATTACK_TYPE_HEAVY,
} from './PhysicsSimulation.js';
import { STAGE_LAYOUT } from './StageData.js';
import { hashString } from './StateHash.js';

const STEP_S = SIM_STEP_MS / 1000;

/** States in which a fighter cannot start attacks. */
const COMBAT_BLOCKED_STATES: ReadonlySet<FighterStateName> = new Set(['HitStun', 'Taunt', 'Defeat']);

/** A KO'd fighter sits out 2 s, then drops in above the stage centre. */
const RESPAWN_DELAY_STEPS = 120;
const RESPAWN_X = 960;
const RESPAWN_Y = 200;
/** Random horizontal offset, so fighters respawning together don't stack. */
const RESPAWN_SPREAD = 50;
/** After a respawn, hits are ignored for 1 s and blast zones for 1.5 s. */
const RESPAWN_INVULNERABILITY_MS = 1000;
const KO_IMMUNITY_STEPS = 90;

export interface MatchState {
    frame: number;
    fighters: FighterState[];
    /** Seeded random generator state. */
    rng: number;
    /** Set once at most one fighter has lives left; the match no longer steps. */
    isOver: boolean;
    /** The last fighter with lives left; -1 for a draw or while the match runs. */
    winnerId: number;
}

export function createMatch(fighters: readonly FighterSetup[], seed: number): MatchState {
    return {
        frame: 0,
        fighters: fighters.map((setup, id) => createFighter(id, setup)),
        rng: seed | 0,
        isOver: false,
        winnerId: -1,
    };
}

// ─── Step ───

/**
 * Advances the match by one fixed step. `inputs[i]` is fighter i's input for
 * this step; what happened is appended to `events`.
 */
export function stepMatch(match: MatchState, inputs: readonly FighterInput[], events: MatchEvent[] = []): void {
    if (match.isOver) return;

    for (const f of match.fighters) {
        if (f.respawnSteps > 0 && --f.respawnSteps === 0) {
            respawn(match, f);
            events.push({ type: 'respawn', fighter: f.id, x: f.body.x, y: f.body.y });
        }
    }
    const fighters = match.fighters.filter(isInPlay);
    // Fighters in hit-stop are frozen this step, though they can still be hit by someone else
    const moving = fighters.filter(f => {
        Object.assign(f.input, inputs[f.id]);
        if (f.hitstopSteps <= 0) return true;
        f.hitstopSteps--;
        holdInputBuffer(f);
        return false;
    });

    for (const f of moving) {
        updateInputBuffer(f);
        stepFighterPhysics(f, events);
        updateFacing(f);
    }

    for (const f of moving) collidePlatforms(f, events);

    for (const f of moving) {
        updateState(f);
        updateCombat(f, events);
        if (!COMBAT_BLOCKED_STATES.has(f.state)) handleCombatInput(f, events);
        updateTimers(f);
    }

    for (const f of moving) collideWalls(f);

    for (const attacker of moving) {
        for (const target of fighters) {
            if (attacker !== target) checkHit(attacker, target, events);
        }
    }

    checkBlastZones(match, fighters, events);

    match.frame++;
}

// ─── Outside the step ───

/** Adds a fighter mid-match (training dummies); returns it. */
export function addFighter(match: MatchState, setup: FighterSetup): FighterState {
    const f = createFighter(match.fighters.length, setup);
    match.fighters.push(f);
    return f;
}

/** Brings a KO'd fighter back now instead of when its respawn delay ends. */
export function respawnFighter(match: MatchState, id: number): void {
    respawn(match, match.fighters[id]);
}

/**
 * For cutscenes: stands a fighter still at (x, y), facing `facing` (1 or -1),
 * with a clean slate except for its damage and lives.
 */
export function placeFighter(match: MatchState, id: number, x: number, y: number, facing: number): void {
    const f = match.fighters[id];
    const { damagePercent, lives } = f;
    Object.assign(f, createFighter(f.id, { character: f.character, x, y }));
    f.damagePercent = damagePercent;
    f.lives = lives;
    f.body.facingDirection = facing;
    f.body.isGrounded = true;
}

// ─── Movement ───

// Reused every step: the physics' input and the events it reports
const physicsInput: PhysicsInput = {
    moveLeft: false, moveRight: false, moveDown: false, moveUp: false,
    jumpBuffered: false, jumpHeld: false, dodgeBuffered: false, chaseDodgeReady: false,
};
const physicsEvents: PhysicsEvent[] = [];

function stepFighterPhysics(f: FighterState, events: MatchEvent[]): void {
    const b = f.body;
    const combat = f.combat;

    // Combat state the physics reads
    b.isAttacking = f.isAttacking;
    b.isHitStunned = f.isHitStunned;
    b.isCharging = combat.isCharging;
    const attack = combat.attack;
    if (attack) {
        const data = AttackRegistry[attack.key];
        b.attackPhase = attack.phase === AttackPhase.STARTUP ? ATTACK_PHASE_STARTUP
            : attack.phase === AttackPhase.ACTIVE ? ATTACK_PHASE_ACTIVE
                : attack.phase === AttackPhase.RECOVERY ? ATTACK_PHASE_RECOVERY
                    : ATTACK_PHASE_NONE;
        b.attackType = data.type === AttackType.LIGHT ? ATTACK_TYPE_LIGHT : ATTACK_TYPE_HEAVY;
        b.shouldStallInAir = !!data.shouldStallInAir;
    } else {
        b.attackPhase = ATTACK_PHASE_NONE;
        b.attackType = ATTACK_TYPE_NONE;
        b.shouldStallInAir = false;
    }

    const input = f.input;
    physicsInput.moveLeft = input.moveLeft;
    physicsInput.moveRight = input.moveRight;
    physicsInput.moveDown = input.moveDown;
    physicsInput.moveUp = input.moveUp;
    physicsInput.jumpBuffered = isBuffered(f, 'jump');
    physicsInput.jumpHeld = input.jumpHeld;
    physicsInput.dodgeBuffered = isBuffered(f, 'dodge');
    physicsInput.chaseDodgeReady = combat.chaseDodgeTimer > 0;

    physicsEvents.length = 0;
    stepPhysics(b, physicsInput, STEP_S, physicsEvents);
    f.isDodging = b.isDodging;
    handlePhysicsEvents(f, physicsEvents);
    pushPhysicsSounds(events, f.id, physicsEvents);
}

function handlePhysicsEvents(f: FighterState, physicsEvents: readonly PhysicsEvent[]): void {
    for (const event of physicsEvents) {
        if (event.type === 'consume') {
            consumeBuffered(f, event.input);
        } else if (event.type === 'dodge_start') {
            if (event.chase) cancelAttackForChaseDodge(f);
            changeState(f, event.isGrounded ? 'Dodge' : 'AirDodge');
        } else if (event.type === 'dash_start') {
            changeState(f, 'Dash');
        }
    }
}

function collidePlatforms(f: FighterState, events: MatchEvent[]): void {
    const b = f.body;
    const platforms = STAGE_LAYOUT.platforms;
    physicsEvents.length = 0;
    for (let i = 0; i < platforms.length; i++) {
        const p = platforms[i];
        if (b.droppingThroughPlatformIdx === i) b.droppingThroughY = p.y;
        checkSinglePlatformCollision(b, i, p.x, p.y, p.w, p.h, p.isSoft, physicsEvents);
    }
    pushPhysicsSounds(events, f.id, physicsEvents);
    f.isDodging = b.isDodging;
}

function collideWalls(f: FighterState): void {
    const b = f.body;
    resetWallState(b);
    for (const w of STAGE_LAYOUT.walls) {
        checkSingleWallCollision(b, w.x, w.y, w.w, w.h);
    }
    for (const c of STAGE_LAYOUT.ceilings) {
        checkSingleCeilingCollision(b, c.x, c.y, c.w, c.h);
    }
    f.isDodging = b.isDodging;
}

/** Facing follows movement, except while stunned, ground pounding or mid-attack. */
function updateFacing(f: FighterState): void {
    if (f.isHitStunned) return;

    const b = f.body;
    const combat = f.combat;
    const isGroundPoundCharge = combat.isCharging && combat.chargeDirection === 'down' && !b.isGrounded;
    if (combat.isGroundPounding || combat.isGroundPoundLanding || isGroundPoundCharge) return;

    if (f.isAttacking && combat.attack && combat.attack.phase !== AttackPhase.RECOVERY) return;

    if (b.isWallSliding) {
        b.facingDirection = -b.wallDirection;
    } else if (b.vx > 5) {
        b.facingDirection = 1;
    } else if (b.vx < -5) {
        b.facingDirection = -1;
    }
}

function updateTimers(f: FighterState): void {
    f.hitStunTimer = countDown(f.hitStunTimer);
    if (f.hitStunTimer <= 0 && f.isHitStunned) {
        // Still flying fast across or upward: the stun goes on, up to its limit (falling doesn't count)
        const b = f.body;
        const flying = Math.abs(b.vx) > PhysicsConfig.STUN_FLYING_SPEED || b.vy < -PhysicsConfig.STUN_FLYING_SPEED;
        const overLimit = f.hitStunTimer <= PhysicsConfig.HIT_STUN_DURATION - PhysicsConfig.MAX_HIT_STUN;
        if (!flying || overLimit) f.isHitStunned = false;
    }

    if (f.invulnerabilityTimer > 0) {
        f.invulnerabilityTimer = countDown(f.invulnerabilityTimer);
        if (f.invulnerabilityTimer <= 0) {
            f.isInvulnerable = false;
        }
    }

    if (f.koImmunitySteps > 0) f.koImmunitySteps--;
    if (f.body.landingLagSteps > 0) f.body.landingLagSteps--;
}

// ─── KOs ───

/** A fighter whose hurtbox crosses a blast zone edge loses a life. */
function checkBlastZones(match: MatchState, fighters: readonly FighterState[], events: MatchEvent[]): void {
    const zone = STAGE_LAYOUT.blastZones;
    let eliminated = false;

    for (const f of fighters) {
        if (f.koImmunitySteps > 0) continue;

        const b = f.body;
        if (b.x - HURTBOX_WIDTH / 2 < zone.left || b.x + HURTBOX_WIDTH / 2 > zone.right ||
            b.y - HURTBOX_HEIGHT / 2 < zone.top || b.y + HURTBOX_HEIGHT / 2 > zone.bottom) {
            f.lives--;
            if (f.lives > 0) f.respawnSteps = RESPAWN_DELAY_STEPS;
            else eliminated = true;
            events.push({ type: 'ko', fighter: f.id, x: b.x, y: b.y });
        }
    }

    if (eliminated) {
        const survivors = match.fighters.filter(f => f.lives > 0);
        if (survivors.length <= 1) {
            match.isOver = true;
            match.winnerId = survivors.length === 1 ? survivors[0].id : -1;
        }
    }
}

/** Puts a KO'd fighter back in play with a clean slate, keeping lives and facing. */
function respawn(match: MatchState, f: FighterState): void {
    const x = RESPAWN_X + randomInt(match, -RESPAWN_SPREAD, RESPAWN_SPREAD);
    const { lives } = f;
    const facing = f.body.facingDirection;

    Object.assign(f, createFighter(f.id, { character: f.character, x, y: RESPAWN_Y }));
    f.lives = lives;
    f.body.facingDirection = facing;
    // As in the original game: the first step after a respawn counts as grounded.
    f.body.isGrounded = true;
    f.body.jumpsRemaining = PhysicsConfig.MAX_JUMPS - 1;
    f.isInvulnerable = true;
    f.invulnerabilityTimer = RESPAWN_INVULNERABILITY_MS;
    f.koImmunitySteps = KO_IMMUNITY_STEPS;
}

/** Uniform integer in [min, max] from the match's seeded generator (mulberry32). */
function randomInt(match: MatchState, min: number, max: number): number {
    const a = match.rng = (match.rng + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return min + ((t ^ (t >>> 14)) >>> 0) % (max - min + 1);
}

// ─── Comparing runs ───

/**
 * Checksum of the whole match state. JSON number formatting is exactly
 * specified, so every engine produces the same text for the same state.
 */
export function matchChecksum(match: MatchState): number {
    return hashString(JSON.stringify(match));
}

const ATTACK_KEYS = Object.keys(AttackRegistry);
const ATTACK_PHASES = [AttackPhase.NONE, AttackPhase.STARTUP, AttackPhase.ACTIVE, AttackPhase.RECOVERY];

/** Values compared between a recorded match and its replay, in this order. */
export const PARITY_FIELDS = [
    'x', 'y', 'vx', 'vy', 'facing', 'grounded', 'jumpsRemaining', 'airActionCounter',
    'wallSliding', 'wallDirection', 'dodging', 'spotDodging', 'dodgeTimer', 'dodgeCooldownTimer',
    'fastFalling', 'recovering', 'recoveryAvailable', 'recoveryTimer', 'running', 'state',
    'damage', 'lives', 'hitStunned', 'hitStunTimer', 'invulnerable', 'invulnerabilityTimer',
    'attacking', 'attackKey', 'attackPhase', 'attackPhaseTimer', 'attackCooldownTimer',
    'charging', 'chargeTime', 'groundPounding', 'groundPoundStartupTimer', 'groundPoundLanding',
] as const;

/** A fighter's parity values, in PARITY_FIELDS order. */
export function fighterParityValues(f: FighterState): number[] {
    const b = f.body;
    const c = f.combat;
    const n = (v: boolean) => (v ? 1 : 0);
    return [
        b.x, b.y, b.vx, b.vy, b.facingDirection, n(b.isGrounded), b.jumpsRemaining, b.airActionCounter,
        n(b.isWallSliding), b.wallDirection, n(b.isDodging), n(b.isSpotDodging), b.dodgeTimer, b.dodgeCooldownTimer,
        n(b.isFastFalling), n(b.isRecovering), n(b.recoveryAvailable), b.recoveryTimer, n(b.isRunning),
        FIGHTER_STATES.indexOf(f.state),
        f.damagePercent, f.lives, n(f.isHitStunned), f.hitStunTimer, n(f.isInvulnerable), f.invulnerabilityTimer,
        n(f.isAttacking), c.attack ? ATTACK_KEYS.indexOf(c.attack.key) : -1,
        c.attack ? ATTACK_PHASES.indexOf(c.attack.phase) : -1, c.attack?.phaseTimer ?? 0,
        c.attackCooldownTimer, n(c.isCharging), c.chargeTime,
        n(c.isGroundPounding), c.groundPoundStartupTimer, n(c.isGroundPoundLanding),
    ];
}
