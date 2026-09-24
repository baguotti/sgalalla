/**
 * A fighter in the simulation: plain data, its input buffer, and the state
 * machine (ported from src/state/states).
 */

import type { AttackDirection, AttackPhase } from './AttackData.js';
import { emptyInput, type FighterInput } from './FighterInput.js';
import { createBody, type SimBody } from './PhysicsSimulation.js';

/** Presses stay usable for this many steps. */
const INPUT_BUFFER_STEPS = 6;

export const FIGHTER_STATES = [
    'Idle', 'Run', 'Jump', 'Fall', 'WallSlide', 'Attack', 'Charging', 'HitStun',
    'Dodge', 'AirDodge', 'Recovery', 'GroundPound', 'Taunt', 'Win', 'Defeat',
    'Respawning', 'Cinematic',
] as const;
export type FighterStateName = typeof FIGHTER_STATES[number];

export type BufferedAction = 'jump' | 'lightAttack' | 'heavyAttack' | 'dodge';

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
    /** Facing when the attack started; hitbox offsets use it. */
    facing: number;
}

/** Signature-attack projectile: the hitbox follows it until it fades. */
export interface GhostHitbox {
    age: number;
    lifetime: number;
    startX: number;
    startY: number;
    travel: number;
    facing: number;
    vertical: boolean;
}

export interface Hitbox {
    active: boolean;
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface CombatState {
    attack: AttackInstance | null;
    attackCooldownTimer: number;
    /** Bit per fighter id already hit by the current move. */
    hitTargets: number;
    hitbox: Hitbox;
    ghost: GhostHitbox | null;
    hasSpawnedGhost: boolean;
    isCharging: boolean;
    chargeTime: number;
    lastChargeTime: number;
    chargeDirection: AttackDirection;
    isGroundPounding: boolean;
    isGroundPoundLanding: boolean;
    groundPoundStartupTimer: number;
    groundPoundChargeRatio: number;
    /** Alternates the light-attack animation. */
    lightAttackVariant: number;
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

    /** Set by the dodge states on enter; overwritten from the body after each physics pass. */
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

export interface FighterSetup {
    character: string;
    x: number;
    y: number;
}

export function createFighter(id: number, setup: FighterSetup): FighterState {
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
            hitTargets: 0,
            hitbox: { active: false, x: 0, y: 0, w: 0, h: 0 },
            ghost: null,
            hasSpawnedGhost: false,
            isCharging: false,
            chargeTime: 0,
            lastChargeTime: 0,
            chargeDirection: 'neutral',
            isGroundPounding: false,
            isGroundPoundLanding: false,
            groundPoundStartupTimer: 0,
            groundPoundChargeRatio: 0,
            lightAttackVariant: 0,
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

// ─── Input buffer ───

export function updateInputBuffer(f: FighterState): void {
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

export function isBuffered(f: FighterState, action: BufferedAction): boolean {
    return f.buffer[action].length > 0;
}

export function consumeBuffered(f: FighterState, action: BufferedAction): void {
    f.buffer[action].shift();
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
            combat.hitbox.active = false;
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
            combat.hitbox.active = false;
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

export function updateState(f: FighterState): void {
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
