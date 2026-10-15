/**
 * Numbers the FEEL mode measures by running the simulation off screen with the
 * current settings: how high a jump goes, how far a dash travels. Measured, not
 * worked out, so friction, damping and step timing are all counted.
 */
import { SIM_STEP_MS } from '../../shared/FixedStepClock';
import { emptyInput, type FighterInput } from '../../shared/FighterInput';
import { createMatch, stepMatch, type MatchState } from '../../shared/GameSim';
import { PhysicsConfig } from '../../shared/PhysicsConfig';
import { STAGE_LAYOUT } from '../../shared/StageData';

export interface Measurements {
    jumpHeight: number;
    jumpFrames: number;
    shortHopHeight: number;
    airJumpHeight: number;
    runSpeed: number;
    dashDistance: number;
    /** Air time of a full jump from the ground back to it. */
    jumpAirFrames: number;
}

const LIMIT = 600;

export function measure(): Measurements {
    const full = jumpFrom(steps => steps < LIMIT);
    return {
        jumpHeight: full.height,
        jumpFrames: full.frames,
        jumpAirFrames: full.airFrames,
        shortHopHeight: jumpFrom(steps => steps < 1).height,
        airJumpHeight: airJump(),
        runSpeed: runSpeed(),
        dashDistance: dashDistance(),
    };
}

/** Two fighters standing apart on the main stage, settled: the first near its left end, clear of the platform above. */
function standing(): MatchState {
    const main = STAGE_LAYOUT.platforms[0];
    const y = main.y - main.h / 2 - PhysicsConfig.PLAYER_HEIGHT / 2;
    const left = main.x - main.w / 2;
    const match = createMatch([{ character: 'fok', x: left + 90, y }, { character: 'fok', x: left + main.w - 60, y }], 1);
    for (let i = 0; i < 10; i++) step(match);
    return match;
}

function step(match: MatchState, input: Partial<FighterInput> = {}): void {
    stepMatch(match, [{ ...emptyInput(), ...input }, emptyInput()]);
}

/** A jump from the ground, holding jump while `holding(step)`: its height, steps to the top and air time. */
function jumpFrom(holding: (steps: number) => boolean): { height: number; frames: number; airFrames: number } {
    const match = standing();
    const body = match.fighters[0].body;
    const ground = body.y;
    let top = ground;
    let frames = 0;
    let airFrames = 0;
    for (let i = 0; i < LIMIT; i++) {
        step(match, { jump: i === 0, jumpHeld: holding(i) });
        if (body.y < top) {
            top = body.y;
            frames = i + 1;
        }
        if (i > 0 && body.isGrounded) {
            airFrames = i + 1;
            break;
        }
    }
    return { height: Math.round(ground - top), frames, airFrames };
}

/** How much higher an air jump at the top of a full jump takes the fighter. */
function airJump(): number {
    const match = standing();
    const body = match.fighters[0].body;
    step(match, { jump: true, jumpHeld: true });
    for (let i = 0; i < LIMIT && body.vy < 0; i++) step(match, { jumpHeld: true });
    step(match);
    const start = body.y;
    let top = start;
    step(match, { jump: true, jumpHeld: true });
    for (let i = 0; i < LIMIT && body.vy < 0; i++) {
        step(match, { jumpHeld: true });
        top = Math.min(top, body.y);
    }
    return Math.round(start - top);
}

/** Top speed holding a direction on the ground. */
function runSpeed(): number {
    const match = standing();
    const body = match.fighters[0].body;
    let fastest = 0;
    for (let i = 0; i < 60; i++) {
        step(match, { moveRight: true });
        fastest = Math.max(fastest, Math.abs(body.vx));
    }
    return Math.round(fastest);
}

/** How far a dash and its slide take the fighter before it stops. */
function dashDistance(): number {
    const match = standing();
    const body = match.fighters[0].body;
    const start = body.x;
    step(match, { dodge: true, dodgeHeld: true, moveRight: true });
    for (let i = 0; i < LIMIT && Math.abs(body.vx) > 1; i++) step(match);
    return Math.round(body.x - start);
}

/** Milliseconds as whole simulation steps: timers end on the first step at or past them. */
export function framesOf(ms: number): number {
    return Math.max(0, Math.ceil(ms / SIM_STEP_MS - 1e-6));
}
