/**
 * GameSim — deterministic match simulation.
 *
 * Plain data only: no Phaser, no wall-clock time, no Math.random. `stepMatch`
 * advances every fighter by one fixed step of SIM_STEP_MS. The step order
 * mirrors GameScene.stepSimulation, and tests/sim.test.ts replays matches
 * recorded in the running game to check the simulation reproduces them exactly.
 */

import { SIM_STEP_MS } from './FixedStepClock.js';
import { AttackPhase, AttackRegistry, AttackType } from './AttackData.js';
import { checkHit, handleCombatInput, updateCombat } from './Combat.js';
import type { FighterInput } from './FighterInput.js';
import {
    FIGHTER_STATES, changeState, consumeBuffered, createFighter, isBuffered, updateInputBuffer, updateState,
    type FighterSetup, type FighterState, type FighterStateName,
} from './FighterState.js';
import {
    type SimInput as PhysicsInput, type PhysicsEvent,
    stepPhysics, checkSinglePlatformCollision, resetWallState, checkSingleWallCollision,
    ATTACK_PHASE_NONE, ATTACK_PHASE_STARTUP, ATTACK_PHASE_ACTIVE, ATTACK_PHASE_RECOVERY,
    ATTACK_TYPE_NONE, ATTACK_TYPE_LIGHT, ATTACK_TYPE_HEAVY,
} from './PhysicsSimulation.js';
import { STAGE_LAYOUT } from './StageData.js';

const STEP_S = SIM_STEP_MS / 1000;

/** States in which a fighter cannot start attacks. */
const COMBAT_BLOCKED_STATES: ReadonlySet<FighterStateName> = new Set(['HitStun', 'Taunt', 'Win', 'Defeat', 'Respawning', 'Cinematic']);

export interface MatchState {
    frame: number;
    fighters: FighterState[];
}

export function createMatch(fighters: readonly FighterSetup[]): MatchState {
    return {
        frame: 0,
        fighters: fighters.map((setup, id) => createFighter(id, setup)),
    };
}

// ─── Step ───

/** Advances the match by one fixed step. `inputs[i]` is fighter i's input for this step. */
export function stepMatch(match: MatchState, inputs: readonly FighterInput[]): void {
    const { fighters } = match;

    for (const f of fighters) {
        Object.assign(f.input, inputs[f.id]);
        updateInputBuffer(f);
        stepFighterPhysics(f);
        updateFacing(f);
    }

    for (const f of fighters) collidePlatforms(f);

    for (const f of fighters) {
        updateState(f);
        updateCombat(f);
        if (!COMBAT_BLOCKED_STATES.has(f.state)) handleCombatInput(f);
        updateTimers(f);
    }

    for (const f of fighters) collideWalls(f);

    for (const attacker of fighters) {
        for (const target of fighters) {
            if (attacker !== target) checkHit(attacker, target);
        }
    }

    match.frame++;
}

// ─── Movement ───

const physicsInput: PhysicsInput = {
    moveLeft: false, moveRight: false, moveDown: false, moveUp: false,
    jumpBuffered: false, jumpHeld: false, dodgeBuffered: false,
    aimUp: false, aimDown: false, recoveryRequested: false,
};

function stepFighterPhysics(f: FighterState): void {
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
    physicsInput.aimUp = input.aimUp;
    physicsInput.aimDown = input.aimDown;

    const events = stepPhysics(b, physicsInput, STEP_S);
    f.isDodging = b.isDodging;
    handlePhysicsEvents(f, events);
}

function handlePhysicsEvents(f: FighterState, events: PhysicsEvent[]): void {
    for (const event of events) {
        if (event.type === 'consume') {
            consumeBuffered(f, event.input);
        } else if (event.type === 'dodge_start') {
            changeState(f, event.isGrounded ? 'Dodge' : 'AirDodge');
        }
    }
}

function collidePlatforms(f: FighterState): void {
    const b = f.body;
    const platforms = STAGE_LAYOUT.platforms;
    for (let i = 0; i < platforms.length; i++) {
        const p = platforms[i];
        if (b.droppingThroughPlatformIdx === i) b.droppingThroughY = p.y;
        checkSinglePlatformCollision(b, i, p.x, p.y, p.w, p.h, p.isSoft);
    }
    f.isDodging = b.isDodging;
}

function collideWalls(f: FighterState): void {
    const b = f.body;
    resetWallState(b);
    for (const w of STAGE_LAYOUT.walls) {
        checkSingleWallCollision(b, w.x, w.y, w.w, w.h);
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
    f.hitStunTimer -= SIM_STEP_MS;
    if (f.hitStunTimer <= 0 && f.isHitStunned) {
        f.isHitStunned = false;
    }

    if (f.invulnerabilityTimer > 0) {
        f.invulnerabilityTimer -= SIM_STEP_MS;
        if (f.invulnerabilityTimer <= 0) {
            f.isInvulnerable = false;
        }
    }
}

// ─── Replay comparison ───

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

/** Parity values in PARITY_FIELDS order. */
export function parityValues(v: {
    x: number; y: number; vx: number; vy: number; facing: number;
    grounded: boolean; jumpsRemaining: number; airActionCounter: number;
    wallSliding: boolean; wallDirection: number; dodging: boolean; spotDodging: boolean;
    dodgeTimer: number; dodgeCooldownTimer: number; fastFalling: boolean;
    recovering: boolean; recoveryAvailable: boolean; recoveryTimer: number; running: boolean;
    state: string; damage: number; lives: number; hitStunned: boolean; hitStunTimer: number;
    invulnerable: boolean; invulnerabilityTimer: number; attacking: boolean;
    attackKey: string | null; attackPhase: string | null; attackPhaseTimer: number;
    attackCooldownTimer: number; charging: boolean; chargeTime: number;
    groundPounding: boolean; groundPoundStartupTimer: number; groundPoundLanding: boolean;
}): number[] {
    const n = (b: boolean) => (b ? 1 : 0);
    return [
        v.x, v.y, v.vx, v.vy, v.facing, n(v.grounded), v.jumpsRemaining, v.airActionCounter,
        n(v.wallSliding), v.wallDirection, n(v.dodging), n(v.spotDodging), v.dodgeTimer, v.dodgeCooldownTimer,
        n(v.fastFalling), n(v.recovering), n(v.recoveryAvailable), v.recoveryTimer, n(v.running),
        FIGHTER_STATES.indexOf(v.state as FighterStateName),
        v.damage, v.lives, n(v.hitStunned), v.hitStunTimer, n(v.invulnerable), v.invulnerabilityTimer,
        n(v.attacking), v.attackKey === null ? -1 : ATTACK_KEYS.indexOf(v.attackKey),
        v.attackPhase === null ? -1 : ATTACK_PHASES.indexOf(v.attackPhase as AttackPhase), v.attackPhaseTimer,
        v.attackCooldownTimer, n(v.charging), v.chargeTime,
        n(v.groundPounding), v.groundPoundStartupTimer, n(v.groundPoundLanding),
    ];
}

export function fighterParityValues(f: FighterState): number[] {
    const b = f.body;
    const combat = f.combat;
    return parityValues({
        x: b.x, y: b.y, vx: b.vx, vy: b.vy, facing: b.facingDirection,
        grounded: b.isGrounded, jumpsRemaining: b.jumpsRemaining, airActionCounter: b.airActionCounter,
        wallSliding: b.isWallSliding, wallDirection: b.wallDirection,
        dodging: b.isDodging, spotDodging: b.isSpotDodging, dodgeTimer: b.dodgeTimer, dodgeCooldownTimer: b.dodgeCooldownTimer,
        fastFalling: b.isFastFalling, recovering: b.isRecovering, recoveryAvailable: b.recoveryAvailable,
        recoveryTimer: b.recoveryTimer, running: b.isRunning, state: f.state,
        damage: f.damagePercent, lives: f.lives, hitStunned: f.isHitStunned, hitStunTimer: f.hitStunTimer,
        invulnerable: f.isInvulnerable, invulnerabilityTimer: f.invulnerabilityTimer, attacking: f.isAttacking,
        attackKey: combat.attack?.key ?? null, attackPhase: combat.attack?.phase ?? null,
        attackPhaseTimer: combat.attack?.phaseTimer ?? 0, attackCooldownTimer: combat.attackCooldownTimer,
        charging: combat.isCharging, chargeTime: combat.chargeTime,
        groundPounding: combat.isGroundPounding, groundPoundStartupTimer: combat.groundPoundStartupTimer,
        groundPoundLanding: combat.isGroundPoundLanding,
    });
}
