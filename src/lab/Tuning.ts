/**
 * Live tuning for the Studio Lab's FEEL mode: every PhysicsConfig number, every
 * move's data and the screen effects can be changed while a match runs, and
 * put back. Only the Lab changes them: every other match starts from the
 * defaults (resetTuning), so online players always simulate the same rules.
 */
import { AttackRegistry, type AttackData } from '../../shared/AttackData';
import { KNOCKBACK_DIRECTIONS } from '../../shared/Combat';
import { PhysicsConfig } from '../../shared/PhysicsConfig';
import { DEFAULT_EFFECTS, effects, type EffectKey } from '../config/EffectConfig';

export type PhysicsKey = keyof typeof PhysicsConfig;

/** The move fields the Lab tunes. */
export const MOVE_FIELDS = [
    'damage', 'baseKnockback', 'knockbackGrowth', 'knockbackAngle',
    'startupDuration', 'activeDuration', 'recoveryDuration',
    'hitboxWidth', 'hitboxHeight', 'hitboxOffsetX', 'hitboxOffsetY', 'shouldStallInAir',
] as const satisfies readonly (keyof AttackData)[];
export type MoveField = typeof MOVE_FIELDS[number];
type MoveValue = number | boolean;

/** What differs from the defaults: the Lab's saved settings and what "Copy changes" gives. */
export interface TuningChanges {
    physics?: Partial<Record<PhysicsKey, number>>;
    moves?: Record<string, Partial<Record<MoveField, MoveValue>>>;
    effects?: Partial<Record<EffectKey, number>>;
}

const physics = PhysicsConfig as Record<PhysicsKey, number>;
const directions = KNOCKBACK_DIRECTIONS as Record<number, readonly [number, number]>;

export const DEFAULT_PHYSICS: Readonly<Record<PhysicsKey, number>> = { ...physics };
export const DEFAULT_MOVES: Readonly<Record<string, Readonly<AttackData>>> =
    Object.fromEntries(Object.entries(AttackRegistry).map(([key, data]) => [key, { ...data }]));
const TABLE_ANGLES = new Set(Object.keys(directions).map(Number));

export function setPhysics(key: PhysicsKey, value: number): void {
    physics[key] = value;
    if (key === 'RECOVERY_KNOCKBACK_ANGLE') addDirection(value);
}

export function moveValue(move: string, field: MoveField): MoveValue {
    return AttackRegistry[move][field] ?? false;
}

export function setMoveValue(move: string, field: MoveField, value: MoveValue): void {
    (AttackRegistry[move] as unknown as Record<string, MoveValue>)[field] = value;
    if (field === 'knockbackAngle') addDirection(value as number);
}

export function defaultMoveValue(move: string, field: MoveField): MoveValue {
    return DEFAULT_MOVES[move][field] ?? false;
}

export function setEffect(key: EffectKey, value: number): void {
    effects[key] = value;
}

/** Everything back to the defaults. Every match outside the Lab starts with this. */
export function resetTuning(): void {
    Object.assign(physics, DEFAULT_PHYSICS);
    for (const [key, data] of Object.entries(DEFAULT_MOVES)) {
        const move = AttackRegistry[key] as unknown as Record<string, unknown>;
        for (const field of MOVE_FIELDS) delete move[field];
        Object.assign(move, data);
    }
    Object.assign(effects, DEFAULT_EFFECTS);
    for (const angle of Object.keys(directions).map(Number)) {
        if (!TABLE_ANGLES.has(angle)) delete directions[angle];
    }
}

export function isDefaultTuning(): boolean {
    const changes = tuningChanges();
    return !changes.physics && !changes.moves && !changes.effects;
}

/** Only what differs from the defaults. */
export function tuningChanges(): TuningChanges {
    const changes: TuningChanges = {};
    for (const key of Object.keys(DEFAULT_PHYSICS) as PhysicsKey[]) {
        if (physics[key] !== DEFAULT_PHYSICS[key]) (changes.physics ??= {})[key] = physics[key];
    }
    for (const move of Object.keys(DEFAULT_MOVES)) {
        for (const field of MOVE_FIELDS) {
            const value = moveValue(move, field);
            if (value !== defaultMoveValue(move, field)) ((changes.moves ??= {})[move] ??= {})[field] = value;
        }
    }
    for (const key of Object.keys(DEFAULT_EFFECTS) as EffectKey[]) {
        if (effects[key] !== DEFAULT_EFFECTS[key]) (changes.effects ??= {})[key] = effects[key];
    }
    return changes;
}

/** Every value, changed or not ("Copy all"). */
export function allTuning(): Required<TuningChanges> {
    return {
        physics: { ...physics },
        moves: Object.fromEntries(Object.keys(DEFAULT_MOVES).map(move =>
            [move, Object.fromEntries(MOVE_FIELDS.map(field => [field, moveValue(move, field)]))])),
        effects: { ...effects },
    };
}

/**
 * Back to the defaults, then `changes` on top: settings saved in the browser or
 * pasted in. Unknown names and values of the wrong type are skipped; returns
 * how many values were applied.
 */
export function applyTuning(changes: unknown): number {
    resetTuning();
    const c = changes as TuningChanges | null;
    let applied = 0;
    for (const [key, value] of Object.entries(c?.physics ?? {})) {
        if (key in DEFAULT_PHYSICS && isNumber(value)) {
            setPhysics(key as PhysicsKey, value);
            applied++;
        }
    }
    for (const [move, fields] of Object.entries(c?.moves ?? {})) {
        if (!(move in DEFAULT_MOVES)) continue;
        for (const [field, value] of Object.entries(fields ?? {})) {
            if (!(MOVE_FIELDS as readonly string[]).includes(field)) continue;
            if (typeof value !== typeof defaultMoveValue(move, field as MoveField) || (typeof value === 'number' && !isNumber(value))) continue;
            setMoveValue(move, field as MoveField, value as MoveValue);
            applied++;
        }
    }
    for (const [key, value] of Object.entries(c?.effects ?? {})) {
        if (key in DEFAULT_EFFECTS && isNumber(value)) {
            setEffect(key as EffectKey, value);
            applied++;
        }
    }
    return applied;
}

/**
 * A knockback angle the table doesn't have yet. The Lab only: the sim avoids
 * Math.cos/sin so every browser computes the same knockback, and an angle made
 * a default goes into KNOCKBACK_DIRECTIONS (a test checks it).
 */
function addDirection(angle: number): void {
    if (angle in directions) return;
    const radians = (angle * Math.PI) / 180;
    directions[angle] = [Math.cos(radians), Math.sin(radians)];
}

function isNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}
