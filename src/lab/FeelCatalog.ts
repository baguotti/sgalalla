/**
 * What the Studio Lab's FEEL mode shows: every gameplay setting in plain
 * words, grouped by topic, with its range. Pure data (a test checks every
 * PhysicsConfig setting is here or deliberately left out).
 */
import type { EffectKey } from '../config/EffectConfig';
import type { MoveField, PhysicsKey } from './Tuning';

/** How a value is measured: shown next to it, and used to pick its slider's range. */
export type Unit = 'ms' | 'steps' | 'px' | 'px/s' | 'px/s²' | 'share' | 'times' | 'count' | 'deg' | '%' | '';

export interface Setting<K extends string = string> {
    key: K;
    label: string;
    hint?: string;
    unit: Unit;
    /** Slider min, max, step; typed values may go past them. */
    range?: readonly [number, number, number];
    /** Only a new match picks it up (R restarts one). */
    newMatch?: boolean;
}

export interface Group<K extends string = string> {
    title: string;
    settings: Setting<K>[];
}

type Row<K extends string> = [key: K, label: string, unit: Unit, hint?: string, range?: readonly [number, number, number]];

function group<K extends string>(title: string, rows: Row<K>[]): Group<K> {
    return { title, settings: rows.map(([key, label, unit, hint, range]) => ({ key, label, unit, hint, range })) };
}

export const MOVEMENT_GROUPS: Group<PhysicsKey>[] = [
    group('GROUND', [
        ['RUN_SPEED', 'Run speed', 'px/s', 'Top speed holding a direction on the ground.', [0, 3000, 10]],
        ['RUN_FRICTION', 'Run build-up', 'share', 'Speed kept each half-step while running: lower starts and turns quicker.', [0.5, 0.99, 0.01]],
        ['STOP_FRICTION', 'Stopping', 'share', 'Speed kept each half-step letting go: lower stops deader.', [0, 0.99, 0.01]],
        ['GROUND_OVERSPEED_DECEL', 'Easing down from a dash', 'px/s²', 'Above the run speed (a dash\'s run-on) the speed eases down at this rate.', [0, 30000, 100]],
    ]),
    group('JUMPS', [
        ['JUMP_FORCE', 'Jump', 'px/s', 'Take-off speed of a full jump (negative is up).', [-2500, 0, 10]],
        ['SHORT_HOP_FORCE', 'Short hop cut-off', 'px/s', 'Letting go of jump while rising slower than this cuts the jump short.', [-2000, 0, 10]],
        ['SHORT_HOP_VELOCITY_DAMP', 'Short hop cut', 'share', 'Rising speed kept each step once jump is let go.'],
        ['DOUBLE_JUMP_FORCE', 'Air jump', 'px/s', 'Take-off speed of each air jump.', [-2500, 0, 10]],
        ['MAX_JUMPS', 'Jumps', 'count', 'The ground jump plus air jumps.', [1, 6, 1]],
        ['LANDING_LAG_STEPS', 'Landing lag', 'steps', 'After landing from the air: no jump, dodge or attack for this many steps.', [0, 20, 1]],
    ]),
    group('GRAVITY AND FALLING', [
        ['GRAVITY', 'Gravity', 'px/s²', undefined, [0, 12000, 50]],
        ['MAX_FALL_SPEED', 'Fall speed', 'px/s', 'Gravity speeds a fall up to this.'],
        ['FAST_FALL_SPEED', 'Fast fall start', 'px/s', 'Holding down while falling starts at least this fast.'],
        ['MAX_FAST_FALL_SPEED', 'Fast fall speed', 'px/s', 'A fast fall speeds up to this.'],
        ['FALL_SPEED_EASE', 'Fall ease-back', 'share', 'After a fast fall, speed over the fall speed shrinks by this share each step.'],
    ]),
    group('AIR', [
        ['AIR_SPEED', 'Air speed', 'px/s', 'Top drift speed holding a direction in the air.', [0, 3000, 10]],
        ['AIR_ACCEL', 'Air control', 'px/s²', 'How fast drifting builds up or turns round in the air.', [0, 40000, 100]],
        ['AIR_DECEL', 'Air momentum', 'px/s²', 'How fast drift (and anything faster, like the end of a launch) slows when you let go: lower keeps momentum.', [0, 20000, 50]],
        ['AIR_ATTACK_DRIFT', 'Drift while attacking', 'share', 'An attack in the air drifts at this share of the air speed.', [0, 1, 0.01]],
        ['AERIAL_STALL_GRAVITY_DAMP', 'Air attack stall: fall', 'share', 'Moves that stall in the air keep this share of the fall speed.'],
        ['AERIAL_STALL_HORIZONTAL_DAMP', 'Air attack stall: drift', 'share', 'Moves that stall in the air keep this share of the drift.'],
    ]),
    group('DODGES', [
        ['SPOT_DODGE_DURATION', 'Spot dodge', 'ms', 'Invincible dodge in place.'],
        ['SPOT_DODGE_AERIAL_Y_DAMP', 'Spot dodge in air: fall', 'share', 'Fall speed kept when dodging in place in the air.'],
        ['AIR_DODGE_DURATION', 'Air dodge', 'ms', 'Directional dodge in the air.'],
        ['AIR_DODGE_DISTANCE', 'Air dodge distance', 'px'],
        ['AIR_DODGE_END_SPEED', 'Air dodge end speed', 'share', 'Vertical speed kept when a directional air dodge ends.'],
        ['DODGE_COOLDOWN', 'Dodge cooldown', 'ms', 'After a spot dodge.'],
        ['AIR_DODGE_COOLDOWN', 'Air dodge cooldown', 'ms', 'Until landing, after an air dodge.'],
        ['LANDED_AIR_DODGE_COOLDOWN', 'Landed air dodge cooldown', 'ms', 'Landing after an air dodge: the dodge is back this long after it ended.'],
        ['SPOT_DODGE_ALPHA', 'Dodge see-through', 'share', 'How opaque a fighter looks while invincible.'],
    ]),
    group('DASH', [
        ['DASH_SPEED', 'Dash speed', 'px/s', 'Dodge + direction on the ground.'],
        ['DASH_DURATION', 'Dash length', 'ms'],
        ['DASH_REPEAT_DELAY', 'Dash repeat delay', 'ms', 'Before another dash can start.'],
        ['DASH_JUMP_FORCE', 'Dash jump', 'px/s', 'Take-off speed of a jump out of a dash: low and fast.', [-2500, 0, 10]],
        ['DASH_JUMP_SPEED', 'Dash jump speed', 'px/s', 'Horizontal speed of a dash jump.'],
        ['DASH_JUMP_AIR_FRICTION', 'Dash jump coast', 'share', 'Speed kept each half-step while a dash jump coasts.', [0.9, 1, 0.001]],
        ['DASH_MOMENTUM_MIN_SPEED', 'Dash jump coast until', 'px/s', 'A dash jump coasts until it slows to this.'],
    ]),
    group('CHASE DODGE', [
        ['CHASE_DODGE_WINDOW', 'Window after a hit', 'ms', 'A directional dodge within the attack that hit, or this long after it, is a chase dodge.'],
        ['CHASE_DODGE_DURATION', 'Length', 'ms'],
        ['CHASE_DODGE_INVINCIBLE', 'Invincible for', 'ms'],
        ['CHASE_DODGE_SPEED', 'Speed', 'px/s'],
        ['MAX_AIR_CHASE_DODGES', 'In the air, at most', 'count', undefined, [0, 6, 1]],
        ['CHASE_ATTACK_SPEED_KEPT', 'Attack out of it keeps', 'share', 'Share of the chase dodge speed an attack out of it keeps.'],
    ]),
    group('WALLS', [
        ['WALL_SLIDE_SPEED', 'Slide speed', 'px/s'],
        ['WALL_JUMP_FORCE_X', 'Wall jump out', 'px/s'],
        ['WALL_JUMP_FORCE_Y', 'Wall jump up', 'px/s', undefined, [-2500, 0, 10]],
        ['WALL_COYOTE_TIME', 'Wall jump grace', 'ms', 'A wall jump still works this long after leaving the wall.'],
        ['MAX_AIR_ACTIONS', 'Air actions before slipping', 'count', 'After this many air jumps, wall jumps and recoveries without landing or a hit, walls stop holding the fighter.', [1, 20, 1]],
    ]),
    group('PLATFORMS', [
        ['DROP_HOLD_STEPS', 'Hold down to drop', 'steps', 'Steps of holding down on a soft platform before dropping through it.', [1, 30, 1]],
        ['PLATFORM_DROP_GRACE_PERIOD', 'Drop grace', 'ms', 'After dropping, the platform ignores the fighter this long.'],
        ['PLATFORM_DROP_NUDGE_Y', 'Drop nudge', 'px'],
        ['PLATFORM_DROP_PUSH_Y', 'Drop push', 'px/s'],
        ['PLATFORM_SNAP_THRESHOLD', 'Landing snap', 'px', 'A fighter this close above a platform top lands on it.'],
    ]),
    group('RECOVERY MOVE', [
        ['RECOVERY_FORCE_Y', 'Up', 'px/s', 'Up or neutral heavy in the air.', [-3500, 0, 10]],
        ['RECOVERY_FORCE_X', 'Forward', 'px/s'],
        ['RECOVERY_DURATION', 'Length', 'ms'],
        ['EXHAUSTED_RECOVERY_FORCE', 'Second recovery push', 'share', 'A second recovery before landing costs a jump and pushes this share as hard.'],
    ]),
    group('BODY AND INPUT', [
        ['PLAYER_WIDTH', 'Body width', 'px', 'For collisions with the stage. R starts a new match with it.'],
        ['PLAYER_FOOT_WIDTH', 'Feet width', 'px', 'Platforms hold a fighter by their feet: off an edge by more than half this, they fall.', [10, 120, 1]],
        ['PLAYER_HEIGHT', 'Body height', 'px', 'For collisions with the stage. R starts a new match with it.'],
        ['HURTBOX_WIDTH', 'Hurtbox width', 'px', 'What attacks hit and blast zones test.'],
        ['HURTBOX_HEIGHT', 'Hurtbox height', 'px'],
        ['INPUT_BUFFER_STEPS', 'Input buffer', 'steps', 'A press is remembered this many steps, so one a little early still counts.', [0, 20, 1]],
    ]),
];

export const COMBAT_GROUPS: Group<PhysicsKey>[] = [
    group('KNOCKBACK', [
        ['FORCE_SCALE', 'px/s per force', 'px/s', 'Knockback = (fixed + variable × (d/100 + d²/20000)) × this, d the target\'s damage after the hit.', [0, 80, 0.5]],
        ['FULL_CHARGE_BONUS', 'Full charge +', 'share', 'A fully charged heavy: this share more damage and variable force.', [0, 1, 0.01]],
        ['HIGH_DAMAGE_FROM', 'Lift from', '%', 'From this damage (red) launches fly higher.', [0, 400, 5]],
        ['HIGH_DAMAGE_RANGE', 'Lift over', '%', 'The extra lift grows to its full amount over this much more damage.', [1, 300, 5]],
        ['HIGH_DAMAGE_LIFT', 'Lift', 'share', 'At full, a launch\'s upward speed is this share faster.', [0, 2, 0.05]],
        ['MAX_DAMAGE', 'Most damage', '%'],
        ['GROUNDED_SPIKE_BOUNCE', 'Spike on ground: pop-up', 'share', 'A downward hit on a grounded fighter pops it up with this share of the knockback.'],
        ['GROUNDED_SPIKE_LIFT', 'Spike on ground: lift', 'px'],
    ]),
    group('STUN', [
        ['STUN_FLYING_SPEED', 'Stun while flying faster than', 'px/s', 'After the move\'s stun frames, stun lasts while the fighter flies faster than this, across or up.'],
        ['STUN_EXTENSION_MAX', 'Stun runs on at most', 'ms'],
        ['LAUNCH_DECEL', 'Launch slows by', 'px/s²', 'A launch loses this much speed a second along its angle: it flies speed²/2 × this far, so soft hits barely push and hard hits fly.', [0, 30000, 100]],
        ['LAUNCH_EASE_SPEED', 'Launch eases out below', 'px/s', 'Below this speed the slowing eases off with the speed, so a launch fades out instead of stopping dead.', [1, 5000, 10]],
        ['LAUNCH_FALL_DRAG', 'Sideways fade in the fall', '', 'Past the top of the arc only the sideways speed fades, this share of it a second: the fall curves.', [0, 10, 0.1]],
        ['HITSTUN_GRAVITY', 'Gravity in a launch', 'share', 'Gravity pulls a launched fighter at this share of its strength, bending the flight into an arc.', [0, 1.5, 0.01]],
    ]),
    group('BOUNCES', [
        ['BOUNCE_SPEED', 'Bounce faster than', 'px/s', 'A stunned fighter hitting a floor or wall faster than this bounces off.'],
        ['BOUNCE_KEEP', 'Bounce keeps', 'share'],
    ]),
    group('HIT-STOP', [
        ['HITSTOP_MIN_STEPS', 'Shortest', 'steps', 'Both fighters freeze on every hit: this many steps…', [0, 20, 1]],
        ['HITSTOP_SPEED_PER_STEP', 'One more per', 'px/s', '…plus one step per this much knockback…', [100, 5000, 50]],
        ['HITSTOP_MAX_STEPS', 'Longest', 'steps', '…up to this.', [0, 30, 1]],
    ]),
    group('ATTACKING', [
        ['ATTACK_ACTIVE_FRICTION', 'Grip while hitting', 'share', 'Speed kept each half-step while a move is active.'],
        ['ATTACK_RECOVERY_FRICTION', 'Grip in recovery', 'share', 'Speed kept each half-step while a move ends.'],
        ['SLIDE_ATTACK_SPEED', 'Slide (down light)', 'px/s'],
        ['SIDE_LIGHT_LUNGE_SPEED', 'Side light lunge', 'px/s'],
        ['SLIDE_ATTACK_DECELERATION', 'Slide slows', 'share', 'Speed kept each step while sliding.', [0.8, 1, 0.005]],
        ['RUN_ATTACK_SPEED_MULT', 'Run attack speed ×', 'times', 'Run attack slides at slide speed × this.', [0, 3, 0.05]],
        ['RUN_ATTACK_MIN_SPEED', 'Run attack from', 'share', 'The run attack comes out above this share of walk speed.'],
    ]),
    group('CHARGE', [
        ['CHARGE_MAX_TIME', 'Full charge', 'ms', 'Heavies charge while held; at full charge they go by themselves.'],
        ['ATTACK_END_COOLDOWN', 'Cooldown after a move', 'ms', 'After any move, no attack can start for this long.'],
        ['CHARGE_FRICTION', 'Grip while charging', 'share'],
        ['CHARGE_GRAVITY_CANCEL', 'Charging in the air: fall', 'share'],
    ]),
    group('GHOSTS', [
        ['GHOST_OFFSET', 'Starts in front', 'px', 'Where a signature ghost appears, in front of the fighter.', [-200, 300, 1]],
        ['NOCK_GHOST_OFFSET', 'Nock: starts in front', 'px', undefined, [-200, 300, 1]],
        ['GHOST_FORWARD', 'Side: extra forward', 'px', undefined, [-200, 300, 1]],
        ['GHOST_LIFT', 'Up: starts higher', 'px', undefined, [-200, 300, 1]],
        ['GHOST_TRAVEL', 'Travels', 'px', 'How far it flies, forward or up.'],
        ['GHOST_TRAVEL_PER_CHARGE', 'Travels more, full charge', 'px'],
        ['GHOST_TRAVEL_MS', 'Travel time', 'ms'],
        ['GHOST_LIFETIME', 'Stays', 'ms', 'How long it stays and hits, before the fade.'],
        ['GHOST_LIFETIME_PER_CHARGE', 'Stays longer, full charge', 'ms'],
        ['GHOST_FADE_MS', 'Fade', 'ms', 'It still hits while fading.'],
        ['GHOST_HITBOX_SCALE', 'Hitbox size', 'share', 'The hitbox is a square: the 256 px ghost frame × this.', [0, 2, 0.01]],
    ]),
    group('GROUND POUND', [
        ['GROUND_POUND_FALL_MULT', 'Fall speed ×', 'times', 'After its startup hang, falls at fall speed × this.', [0.5, 4, 0.05]],
        ['GROUND_POUND_LANDING_SPEED_KEPT', 'Landing keeps speed', 'share'],
    ]),
    group('RECOVERY HIT', [
        ['RECOVERY_DAMAGE', 'Damage', '%'],
        ['RECOVERY_FIXED_FORCE', 'Fixed force', '', 'The same at any damage.', [0, 200, 1]],
        ['RECOVERY_VARIABLE_FORCE', 'Variable force', '', 'Grows with the target\'s damage.', [0, 200, 1]],
        ['RECOVERY_STUN', 'Stun', 'steps', undefined, [0, 60, 1]],
        ['RECOVERY_KNOCKBACK_ANGLE', 'Knockback angle', 'deg', '0 forward, 90 up, 270 down.', [0, 359, 1]],
        ['RECOVERY_HITBOX_SIZE', 'Hitbox size', 'px', 'A square round the fighter.'],
    ]),
    group('BOMBS', [
        ['BOMB_FIRST', 'First drops after', 'ms'],
        ['BOMB_GAP', 'Next one after', 'ms', 'After a bomb is gone, the next drops this long after…'],
        ['BOMB_GAP_RANDOM', '…plus up to', 'ms'],
        ['BOMB_LIFETIME', 'Loose bomb lasts', 'ms'],
        ['BOMB_RADIUS', 'Size (radius)', 'px'],
        ['BOMB_HIT_RANGE', 'Hits within', 'px', 'An armed bomb goes off this close to a fighter\'s hurtbox (narrower than the art).', [0, 120, 1]],
        ['BOMB_PICKUP_RANGE', 'Pick up within', 'px', 'How far past the hurtbox light attack or throw reaches a bomb.'],
        ['BOMB_THROW_SPEED_MIN', 'Throw speed, tapped', 'px/s'],
        ['BOMB_THROW_SPEED_MAX', 'Throw speed, charged', 'px/s'],
        ['BOMB_CHARGE_FULL', 'Full charge after', 'ms'],
        ['BOMB_OVERCHARGE', 'Goes off in the hand after', 'ms', 'Charging a throw longer than this blows the bomb up on its holder.'],
        ['BOMB_FLIGHT_GRAVITY', 'Gravity in flight', 'share', 'A thrown bomb falls at this share of gravity at first, so it flies almost straight.', [0, 1, 0.01]],
        ['BOMB_STRAIGHT_STEPS', 'Straight for', 'steps', 'Steps of light gravity after a throw; then it falls normally.', [0, 120, 1]],
        ['BOMB_BOUNCE', 'Bounce keeps', 'share'],
        ['BOMB_SAFE_SPEED', 'Safe again below', 'px/s', 'A thrown bomb slower than this stops being armed.'],
        ['BOMB_GRACE_STEPS', 'Passes through for', 'steps', 'After a throw, the bomb goes through everyone for this long.', [0, 30, 1]],
        ['BOMB_BLAST_RADIUS', 'Blast radius', 'px'],
        ['BOMB_DAMAGE', 'Damage', '%'],
        ['BOMB_FIXED_FORCE', 'Fixed force', '', undefined, [0, 200, 1]],
        ['BOMB_VARIABLE_FORCE', 'Variable force', '', undefined, [0, 200, 1]],
        ['BOMB_STUN', 'Stun', 'steps', undefined, [0, 60, 1]],
    ]),
    group('RESPAWN', [
        ['RESPAWN_DELAY_STEPS', 'Out after a KO', 'steps', undefined, [0, 300, 1]],
        ['RESPAWN_INVULNERABILITY_MS', 'Invulnerable after', 'ms'],
    ]),
];

/** Settings that only seed other values when the game loads: changing them live would do nothing. */
export const HIDDEN_PHYSICS: readonly PhysicsKey[] = [];

export const EFFECT_GROUPS: Group<EffectKey>[] = [
    group('CAMERA KICK', [
        ['CAMERA_KICK_FROM', 'From knockback', 'px/s', 'Hits knocking back harder than this nudge the camera the way the target flies.'],
        ['CAMERA_KICK_PER_PIXEL', 'Knockback per pixel', 'px/s'],
        ['CAMERA_KICK_MAX', 'Most', 'px', undefined, [0, 60, 1]],
        ['CAMERA_KICK_DECAY', 'Settles', 'share', 'Share of the kick left each step.'],
    ]),
    group('SHAKES', [
        ['HEAVY_SHAKE_MS', 'Heavy hit shake', 'ms'],
        ['HEAVY_SHAKE', 'Heavy hit strength', '', undefined, [0, 0.05, 0.001]],
        ['KO_SHAKE_MS', 'KO shake', 'ms'],
        ['KO_SHAKE', 'KO strength', '', undefined, [0, 0.05, 0.001]],
        ['KO_ZOOM_PUNCH', 'KO zoom-in', 'times', undefined, [1, 1.3, 0.005]],
        ['HITSTOP_TREMBLE', 'Hit-stop tremble', 'px', undefined, [0, 20, 0.5]],
    ]),
    group('SPARKS AND MOTION', [
        ['SPARK_SIZE', 'Hit spark size ×', 'times', undefined, [0, 3, 0.05]],
        ['SPARK_RING_DAMAGE', 'Spark ring from damage', '%', undefined, [0, 30, 1]],
        ['DUST_OPACITY', 'Dust ×', 'times', undefined, [0, 3, 0.05]],
        ['JUMP_RING_OPACITY', 'Air jump ring ×', 'times', undefined, [0, 3, 0.05]],
        ['AFTERIMAGE_OPACITY', 'Afterimages ×', 'times', undefined, [0, 3, 0.05]],
        ['AFTERIMAGE_EVERY_MS', 'Afterimage every', 'ms', undefined, [10, 200, 1]],
        ['LAUNCH_TRAIL_SPEED', 'Launch trail faster than', 'px/s', 'A fighter launched faster than this leaves afterimages behind.', [0, 5000, 50]],
    ]),
];

// ─── Moves ───

export interface MoveInfo {
    key: string;
    label: string;
    /** Signatures hit where their ghost is: hitbox from GHOSTS. */
    signature?: boolean;
    /** The ground pound: falls until it lands instead of an active time. */
    groundPound?: boolean;
}

export const MOVES: MoveInfo[] = [
    { key: 'light_neutral_grounded', label: 'Neutral light' },
    { key: 'light_side_grounded', label: 'Side light' },
    { key: 'light_up_grounded', label: 'Up light' },
    { key: 'light_down_grounded', label: 'Down light (slide)' },
    { key: 'light_run_grounded', label: 'Run light' },
    { key: 'light_neutral_aerial', label: 'Neutral air' },
    { key: 'light_side_aerial', label: 'Side air' },
    { key: 'light_up_aerial', label: 'Up air' },
    { key: 'light_down_aerial', label: 'Down air' },
    { key: 'heavy_side_grounded', label: 'Side signature', signature: true },
    { key: 'heavy_up_grounded', label: 'Up signature', signature: true },
    { key: 'heavy_neutral_grounded', label: 'Neutral signature', signature: true },
    { key: 'heavy_down_aerial', label: 'Ground pound', groundPound: true },
];

export const MOVE_SETTINGS: Record<Exclude<MoveField, 'shouldStallInAir'>, Setting<MoveField>> = {
    damage: { key: 'damage', label: 'Damage', unit: '%', range: [0, 40, 1] },
    fixedForce: { key: 'fixedForce', label: 'Fixed force', unit: '', range: [0, 200, 1], hint: 'The same at any damage (× COMBAT › KNOCKBACK px/s per force).' },
    variableForce: { key: 'variableForce', label: 'Variable force', unit: '', range: [0, 200, 1], hint: 'Grows with the target\'s damage: × (d/100 + d²/20000).' },
    stun: { key: 'stun', label: 'Stun', unit: 'steps', range: [0, 60, 1], hint: 'The target can\'t act this many steps (longer while it flies fast).' },
    knockbackAngle: { key: 'knockbackAngle', label: 'Angle', unit: 'deg', range: [0, 359, 1], hint: '0 forward, 90 up, 270 down.' },
    startup: { key: 'startup', label: 'Startup', unit: 'steps', range: [0, 60, 1], hint: 'Before the hitbox comes out.' },
    active: { key: 'active', label: 'Active', unit: 'steps', range: [0, 60, 1], hint: 'The hitbox is out.' },
    recovery: { key: 'recovery', label: 'Recovery', unit: 'steps', range: [0, 60, 1], hint: 'Stuck after the hitbox (the ground pound: its landing pose). Every move then has COMBAT › Cooldown after a move.' },
    hitboxWidth: { key: 'hitboxWidth', label: 'Hitbox width', unit: 'px', range: [0, 400, 1] },
    hitboxHeight: { key: 'hitboxHeight', label: 'Hitbox height', unit: 'px', range: [0, 400, 1] },
    hitboxOffsetX: { key: 'hitboxOffsetX', label: 'Hitbox forward', unit: 'px', range: [-250, 250, 1], hint: 'From the fighter\'s centre, forward.' },
    hitboxOffsetY: { key: 'hitboxOffsetY', label: 'Hitbox down', unit: 'px', range: [-250, 250, 1], hint: 'From the fighter\'s centre, down (negative is up).' },
};

/** A slider range for a setting without its own, from its default. */
export function rangeFor(setting: Setting, value: number): readonly [number, number, number] {
    if (setting.range) return setting.range;
    const size = Math.abs(value);
    if (setting.unit === 'share') return [0, Math.max(1, Math.ceil(size * 2)), 0.01];
    if (setting.unit === 'steps' || setting.unit === 'count') return [0, Math.max(10, size * 3), 1];
    const step = size >= 500 ? 10 : size >= 100 ? 5 : size >= 20 ? 1 : 0.1;
    const top = Math.max(step * 10, Math.ceil((size * 3) / step) * step);
    return value < 0 ? [-top, 0, step] : [0, top, step];
}
