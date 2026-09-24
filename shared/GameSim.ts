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
import type { AttackDirection } from './AttackData.js';
import type { FighterInput } from './FighterInput.js';
import { emptyInput } from './FighterInput.js';
import {
    type SimBody, type SimInput as PhysicsInput, type PhysicsEvent,
    createBody, stepPhysics, checkSinglePlatformCollision, resetWallState, checkSingleWallCollision,
    ATTACK_PHASE_NONE, ATTACK_PHASE_STARTUP, ATTACK_PHASE_ACTIVE, ATTACK_PHASE_RECOVERY,
    ATTACK_TYPE_NONE, ATTACK_TYPE_LIGHT, ATTACK_TYPE_HEAVY,
} from './PhysicsSimulation.js';
import { STAGE_LAYOUT } from './StageData.js';

const STEP_S = SIM_STEP_MS / 1000;

/** Presses stay usable for this many steps (the old InputBuffer window). */
const INPUT_BUFFER_STEPS = 6;

// ─── State ───

export const FIGHTER_STATES = [
    'Idle', 'Run', 'Jump', 'Fall', 'WallSlide', 'Attack', 'Charging', 'HitStun',
    'Dodge', 'AirDodge', 'Recovery', 'GroundPound', 'Taunt', 'Win', 'Defeat',
    'Respawning', 'Cinematic',
] as const;
export type FighterStateName = typeof FIGHTER_STATES[number];

type BufferedAction = 'jump' | 'lightAttack' | 'heavyAttack' | 'dodge';

/** Steps (per-fighter counter) at which each action was pressed, oldest first. */
interface InputBuffer {
    step: number;
    jump: number[];
    lightAttack: number[];
    heavyAttack: number[];
    dodge: number[];
}

export interface AttackInstance {
    key: string;
    phase: AttackPhase;
    phaseTimer: number;
    facing: number;
    nextHitTimer: number;
}

export interface CombatState {
    attack: AttackInstance | null;
    attackCooldownTimer: number;
    isCharging: boolean;
    chargeTime: number;
    lastChargeTime: number;
    chargeDirection: AttackDirection;
    isThrowCharging: boolean;
    isGroundPounding: boolean;
    isGroundPoundLanding: boolean;
    groundPoundStartupTimer: number;
    groundPoundChargeRatio: number;
    hitboxActive: boolean;
}

export interface FighterState {
    readonly id: number;
    readonly character: string;
    body: SimBody;
    state: FighterStateName;
    /** Input used on the latest step. */
    input: FighterInput;
    buffer: InputBuffer;
    combat: CombatState;

    /** Fighter-level dodge flag: states set it on enter, physics overwrites it from the body after each physics pass. */
    isDodging: boolean;
    isAttacking: boolean;
    isHitStunned: boolean;
    hitStunTimer: number;
    isInvulnerable: boolean;
    invulnerabilityTimer: number;
    damagePercent: number;
    lives: number;
    isRespawning: boolean;
    isTaunting: boolean;
    isShowingDefeat: boolean;
    isWinner: boolean;
}

export interface MatchState {
    frame: number;
    fighters: FighterState[];
}

export interface FighterSetup {
    character: string;
    x: number;
    y: number;
}

export function createMatch(fighters: readonly FighterSetup[]): MatchState {
    return {
        frame: 0,
        fighters: fighters.map((setup, id) => createFighter(id, setup)),
    };
}

function createFighter(id: number, setup: FighterSetup): FighterState {
    return {
        id,
        character: setup.character,
        body: createBody(setup.x, setup.y, 1),
        state: 'Idle',
        input: emptyInput(),
        buffer: { step: 0, jump: [], lightAttack: [], heavyAttack: [], dodge: [] },
        combat: {
            attack: null,
            attackCooldownTimer: 0,
            isCharging: false,
            chargeTime: 0,
            lastChargeTime: 0,
            chargeDirection: 'neutral',
            isThrowCharging: false,
            isGroundPounding: false,
            isGroundPoundLanding: false,
            groundPoundStartupTimer: 0,
            groundPoundChargeRatio: 0,
            hitboxActive: false,
        },
        isDodging: false,
        isAttacking: false,
        isHitStunned: false,
        hitStunTimer: 0,
        isInvulnerable: false,
        invulnerabilityTimer: 0,
        damagePercent: 0,
        lives: 3,
        isRespawning: false,
        isTaunting: false,
        isShowingDefeat: false,
        isWinner: false,
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
        updateTimers(f);
    }

    for (const f of fighters) collideWalls(f);

    match.frame++;
}

// ─── Input buffer ───

function updateInputBuffer(f: FighterState): void {
    const buffer = f.buffer;
    const step = ++buffer.step;
    if (f.input.jump) buffer.jump.push(step);
    if (f.input.lightAttack) buffer.lightAttack.push(step);
    if (f.input.heavyAttack) buffer.heavyAttack.push(step);
    if (f.input.dodge) buffer.dodge.push(step);

    for (const action of ['jump', 'lightAttack', 'heavyAttack', 'dodge'] as const) {
        const presses = buffer[action];
        while (presses.length > 0 && step - presses[0] > INPUT_BUFFER_STEPS) presses.shift();
    }
}

function isBuffered(f: FighterState, action: BufferedAction): boolean {
    return f.buffer[action].length > 0;
}

function consumeBuffered(f: FighterState, action: BufferedAction): void {
    f.buffer[action].shift();
}

// ─── Physics ───

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
    b.isThrowCharging = combat.isThrowCharging;
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

// ─── State machine ───

export function changeState(f: FighterState, next: FighterStateName): void {
    exitState(f);
    f.state = next;
    enterState(f);
}

function enterState(f: FighterState): void {
    const combat = f.combat;
    switch (f.state) {
        case 'Run':
            f.body.isRunning = true;
            break;
        case 'Attack':
            f.isAttacking = true;
            break;
        case 'GroundPound':
            combat.isGroundPounding = true;
            f.isAttacking = true;
            break;
        case 'HitStun':
            f.isAttacking = false;
            f.isDodging = false;
            combat.isGroundPounding = false;
            combat.attack = null;
            combat.hitboxActive = false;
            combat.isCharging = false;
            combat.chargeTime = 0;
            break;
        case 'Dodge':
        case 'AirDodge':
            f.isDodging = true;
            break;
        case 'Taunt':
            f.isTaunting = true;
            break;
        case 'Defeat':
            f.isShowingDefeat = true;
            break;
        case 'Win':
            f.isWinner = true;
            break;
        case 'Respawning':
            f.isRespawning = true;
            break;
        case 'Cinematic':
            f.body.vx = 0;
            f.body.vy = 0;
            combat.hitboxActive = false;
            break;
    }
}

function exitState(f: FighterState): void {
    switch (f.state) {
        case 'Run':
            f.body.isRunning = false;
            break;
        case 'GroundPound':
            f.combat.isGroundPounding = false;
            f.isAttacking = false;
            break;
        case 'Taunt':
            f.isTaunting = false;
            break;
        case 'Defeat':
            f.isShowingDefeat = false;
            break;
        case 'Win':
            f.isWinner = false;
            break;
        case 'Respawning':
            f.isRespawning = false;
            break;
    }
}

function airborneState(f: FighterState): FighterStateName {
    return f.body.vy < 0 ? 'Jump' : 'Fall';
}

function canDodge(f: FighterState): boolean {
    return isBuffered(f, 'dodge') && f.body.dodgeCooldownTimer <= 0;
}

function updateState(f: FighterState): void {
    const b = f.body;
    const input = f.input;
    const isMoving = input.moveLeft || input.moveRight;

    switch (f.state) {
        case 'Idle':
            if (f.isHitStunned) return changeState(f, 'HitStun');
            if (!b.isGrounded) return changeState(f, airborneState(f));
            if (input.taunt) return changeState(f, 'Taunt');
            if (input.defeat) return changeState(f, 'Defeat');
            if (canDodge(f)) return changeState(f, 'Dodge');
            if (isBuffered(f, 'jump')) return changeState(f, 'Jump');
            if (isMoving) return changeState(f, 'Run');
            return;

        case 'Run':
            if (f.isHitStunned) return changeState(f, 'HitStun');
            if (!b.isGrounded) return changeState(f, airborneState(f));
            if (canDodge(f)) return changeState(f, 'Dodge');
            if (isBuffered(f, 'jump')) return changeState(f, 'Jump');
            if (!isMoving) return changeState(f, 'Idle');
            return;

        case 'Jump':
            if (f.isHitStunned) return changeState(f, 'HitStun');
            if (b.isGrounded) return changeState(f, 'Idle');
            if (b.vy > 0) return changeState(f, 'Fall');
            if (canDodge(f)) return changeState(f, 'AirDodge');
            return;

        case 'Fall':
            if (f.isHitStunned) return changeState(f, 'HitStun');
            if (b.isGrounded) return changeState(f, 'Idle');
            if (b.vy < 0) return changeState(f, 'Jump');
            if (b.isWallSliding) return changeState(f, 'WallSlide');
            if (canDodge(f)) return changeState(f, 'AirDodge');
            return;

        case 'WallSlide':
            if (f.isHitStunned) return changeState(f, 'HitStun');
            if (b.isGrounded) return changeState(f, 'Idle');
            if (!b.isWallSliding) return changeState(f, airborneState(f));
            return;

        case 'Dodge':
            if (!f.isDodging) return changeState(f, b.isGrounded ? (isMoving ? 'Run' : 'Idle') : 'Fall');
            return;

        case 'AirDodge':
            if (b.isGrounded) return changeState(f, isMoving ? 'Run' : 'Idle');
            if (!f.isDodging) return changeState(f, airborneState(f));
            return;

        case 'Attack':
            if (f.isHitStunned) return changeState(f, 'HitStun');
            if (!f.isAttacking) return changeState(f, b.isGrounded ? 'Idle' : airborneState(f));
            return;

        case 'Charging':
            if (f.isHitStunned) return changeState(f, 'HitStun');
            if (!f.combat.isCharging) return changeState(f, b.isGrounded ? 'Idle' : 'Fall');
            return;

        case 'GroundPound':
            if (f.isHitStunned) return changeState(f, 'HitStun');
            if (!f.combat.isGroundPounding) return changeState(f, 'Idle');
            return;

        case 'HitStun':
            if (!f.isHitStunned) return changeState(f, b.isGrounded ? 'Idle' : airborneState(f));
            return;

        case 'Recovery':
            if (f.isHitStunned) return changeState(f, 'HitStun');
            if (b.isGrounded) return changeState(f, 'Idle');
            if (!b.isRecovering) return changeState(f, 'Fall');
            return;

        case 'Taunt':
        case 'Defeat':
            if (f.isHitStunned) return changeState(f, 'HitStun');
            if (isMoving || input.jump || input.lightAttack || input.heavyAttack || input.dodge || !b.isGrounded) {
                return changeState(f, 'Idle');
            }
            return;

        case 'Respawning':
            if (!f.isRespawning) return changeState(f, 'Idle');
            return;

        case 'Win':
        case 'Cinematic':
            return;
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
