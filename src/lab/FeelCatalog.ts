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
        ['MOVE_ACCEL', 'Acceleration', 'px/s²', 'How fast walking and running build up speed.'],
        ['MAX_SPEED', 'Walk speed', 'px/s', 'Top walking speed; running multiplies it.'],
        ['RUN_SPEED_MULT', 'Run speed ×', 'times', 'Running top speed = walk speed × this.', [1, 4, 0.05]],
        ['RUN_ACCEL_MULT', 'Run acceleration ×', 'times', undefined, [0, 3, 0.05]],
        ['FRICTION', 'Stopping grip', 'share', 'Speed kept each half-step when you let go on the ground: lower stops sooner.'],
        ['RUN_FRICTION', 'Running grip', 'share', 'Speed kept each half-step while running.'],
        ['HIGH_SPEED_THRESHOLD_MULT', 'High speed ×', 'times', 'Above walk speed × this, a fighter counts as moving fast.', [0, 3, 0.05]],
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
        ['GRAVITY', 'Gravity', 'px/s²'],
        ['MAX_FALL_SPEED', 'Fall speed', 'px/s', 'Gravity speeds a fall up to this.'],
        ['FAST_FALL_SPEED', 'Fast fall start', 'px/s', 'Holding down while falling starts at least this fast.'],
        ['MAX_FAST_FALL_SPEED', 'Fast fall speed', 'px/s', 'A fast fall speeds up to this.'],
        ['FALL_SPEED_EASE', 'Fall ease-back', 'share', 'After a fast fall, speed over the fall speed shrinks by this share each step.'],
    ]),
    group('AIR', [
        ['AIR_FRICTION', 'Air drift grip', 'share', 'Horizontal speed kept each half-step in the air.'],
        ['AERIAL_STALL_GRAVITY_DAMP', 'Air attack stall: fall', 'share', 'Moves that stall in the air keep this share of the fall speed.'],
        ['AERIAL_STALL_HORIZONTAL_DAMP', 'Air attack stall: drift', 'share', 'Moves that stall in the air keep this share of the drift.'],
    ]),
    group('DODGES', [
        ['SPOT_DODGE_DURATION', 'Spot dodge', 'ms', 'Invincible dodge in place.'],
        ['SPOT_DODGE_AERIAL_Y_DAMP', 'Spot dodge in air: fall', 'share', 'Fall speed kept when dodging in place in the air.'],
        ['AIR_DODGE_DURATION', 'Air dodge', 'ms', 'Directional dodge in the air.'],
        ['AIR_DODGE_DISTANCE', 'Air dodge distance', 'px'],
        ['AIR_DODGE_END_SPEED', 'Air dodge end speed', 'share', 'Vertical speed kept when a directional air dodge ends.'],
        ['AIR_DODGE_VERTICAL_DAMP', 'Air dodge vertical', 'share', 'Share of the dodge speed used up and down.'],
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
        ['PLAYER_HEIGHT', 'Body height', 'px', 'For collisions with the stage. R starts a new match with it.'],
        ['HURTBOX_WIDTH', 'Hurtbox width', 'px', 'What attacks hit and blast zones test.'],
        ['HURTBOX_HEIGHT', 'Hurtbox height', 'px'],
        ['INPUT_BUFFER_STEPS', 'Input buffer', 'steps', 'A press is remembered this many steps, so one a little early still counts.', [0, 20, 1]],
    ]),
];

export const COMBAT_GROUPS: Group<PhysicsKey>[] = [
    group('KNOCKBACK', [
        ['GLOBAL_KNOCKBACK_SCALING', 'Knockback growth ×', 'times', 'Every move: knockback = base + growth × this × (target damage + hit damage).', [0, 15, 0.1]],
        ['MAX_DAMAGE', 'Most damage', '%'],
        ['GROUNDED_SPIKE_BOUNCE', 'Spike on ground: pop-up', 'share', 'A downward hit on a grounded fighter pops it up with this share of the knockback.'],
        ['GROUNDED_SPIKE_LIFT', 'Spike on ground: lift', 'px'],
    ]),
    group('STUN', [
        ['HIT_STUN_DURATION', 'Hitstun', 'ms', 'No control after a hit, at least this long.'],
        ['STUN_FLYING_SPEED', 'Stun while flying faster than', 'px/s', 'Stun lasts while the fighter flies faster than this, across or up.'],
        ['MAX_HIT_STUN', 'Longest stun', 'ms'],
        ['HITSTUN_FRICTION', 'Air grip in stun', 'share'],
    ]),
    group('BOUNCES', [
        ['BOUNCE_SPEED', 'Bounce faster than', 'px/s', 'A stunned fighter hitting a floor or wall faster than this bounces off.'],
        ['BOUNCE_KEEP', 'Bounce keeps', 'share'],
    ]),
    group('HIT-STOP', [
        ['HITSTOP_MIN_STEPS', 'Shortest', 'steps', 'Both fighters freeze on every hit: this many steps…', [0, 20, 1]],
        ['HITSTOP_PER_DAMAGE', 'Per damage', 'steps', '…plus this many per point of damage…', [0, 2, 0.05]],
        ['HITSTOP_MAX_STEPS', 'Longest', 'steps', '…up to this.', [0, 30, 1]],
    ]),
    group('ATTACKING', [
        ['ATTACK_ACTIVE_FRICTION', 'Grip while hitting', 'share', 'Speed kept each half-step while a move is active.'],
        ['ATTACK_RECOVERY_FRICTION', 'Grip in recovery', 'share', 'Speed kept each half-step while a move ends.'],
        ['ATTACK_END_COOLDOWN', 'Cooldown after a move', 'ms'],
        ['SLIDE_ATTACK_SPEED', 'Slide (down light)', 'px/s'],
        ['SLIDE_ATTACK_DECELERATION', 'Slide slows', 'share', 'Speed kept each step while sliding.', [0.8, 1, 0.005]],
        ['RUN_ATTACK_SPEED_MULT', 'Run attack speed ×', 'times', 'Run attack slides at slide speed × this.', [0, 3, 0.05]],
        ['RUN_ATTACK_MIN_SPEED', 'Run attack from', 'share', 'The run attack comes out above this share of walk speed.'],
    ]),
    group('CHARGE', [
        ['CHARGE_MAX_TIME', 'Full charge', 'ms', 'Heavies charge while held; at full charge they go by themselves.'],
        ['CHARGE_FRICTION', 'Grip while charging', 'share'],
        ['CHARGE_GRAVITY_CANCEL', 'Charging in the air: fall', 'share'],
        ['FOK_CHARGE_COOLDOWN', 'Fok: extra cooldown', 'ms', 'Fok\'s charged moves: extra cooldown at full charge.'],
    ]),
    group('SIGNATURES', [
        ['SIDE_SIG_MIN_DAMAGE', 'Damage, no charge', '%', 'Heavy side, up and neutral.'],
        ['SIDE_SIG_MAX_DAMAGE', 'Damage, full charge', '%'],
        ['SIDE_SIG_KNOCKBACK_BONUS', 'Side: base knockback +', 'share', 'A fully charged side signature: base knockback this share more.', [0, 3, 0.05]],
        ['SIDE_SIG_GROWTH_BONUS', 'Side: growth +', 'share', 'A fully charged side signature: growth this share more.', [0, 3, 0.05]],
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
        ['GROUND_POUND_STARTUP', 'Hang before falling', 'ms'],
        ['GROUND_POUND_FALL_MULT', 'Fall speed ×', 'times', 'Falls at fall speed × this.', [0.5, 4, 0.05]],
        ['GROUND_POUND_MIN_DAMAGE', 'Damage, no charge', '%'],
        ['GROUND_POUND_MAX_DAMAGE', 'Damage, full charge', '%'],
        ['GROUND_POUND_KNOCKBACK_BONUS', 'Base knockback +, full charge', 'share', undefined, [0, 3, 0.05]],
        ['GROUND_POUND_GROWTH_BONUS', 'Growth +, full charge', 'share', undefined, [0, 3, 0.05]],
        ['GROUND_POUND_LANDING_SPEED_KEPT', 'Landing keeps speed', 'share'],
    ]),
    group('RECOVERY HIT', [
        ['RECOVERY_DAMAGE', 'Damage', '%'],
        ['RECOVERY_BASE_KNOCKBACK', 'Base knockback', 'px/s'],
        ['RECOVERY_KNOCKBACK_GROWTH', 'Knockback growth', '', undefined, [0, 30, 0.1]],
        ['RECOVERY_KNOCKBACK_ANGLE', 'Knockback angle', 'deg', '0 forward, 90 up, 270 down.', [0, 359, 1]],
        ['RECOVERY_HITBOX_SIZE', 'Hitbox size', 'px', 'A square round the fighter.'],
    ]),
    group('RESPAWN', [
        ['RESPAWN_DELAY_STEPS', 'Out after a KO', 'steps', undefined, [0, 300, 1]],
        ['RESPAWN_INVULNERABILITY_MS', 'Invulnerable after', 'ms'],
    ]),
];

/** Settings that only seed other values when the game loads: changing them live would do nothing. */
export const HIDDEN_PHYSICS: readonly PhysicsKey[] = [
    'LIGHT_STARTUP_MS', 'LIGHT_ACTIVE_MS', 'LIGHT_RECOVERY_MS', 'HEAVY_STARTUP_MS', 'HEAVY_ACTIVE_MS', 'HEAVY_RECOVERY_MS',
];

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
    ]),
];

// ─── Moves ───

export interface MoveInfo {
    key: string;
    label: string;
    /** Signatures hit where their ghost is: damage from SIGNATURES, hitbox from GHOSTS. */
    signature?: boolean;
    /** The ground pound: damage from GROUND POUND, and its own timing. */
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
    { key: 'heavy_side_aerial', label: 'Side signature (air)', signature: true },
    { key: 'heavy_up_aerial', label: 'Up signature (air)', signature: true },
    { key: 'heavy_neutral_aerial', label: 'Neutral signature (air)', signature: true },
    { key: 'heavy_down_aerial', label: 'Ground pound', groundPound: true },
];

export const MOVE_SETTINGS: Record<Exclude<MoveField, 'shouldStallInAir'>, Setting<MoveField>> = {
    damage: { key: 'damage', label: 'Damage', unit: '%', range: [0, 40, 1] },
    baseKnockback: { key: 'baseKnockback', label: 'Base knockback', unit: 'px/s', range: [0, 1500, 5], hint: 'Knockback at 0%.' },
    knockbackGrowth: { key: 'knockbackGrowth', label: 'Knockback growth', unit: '', range: [0, 30, 0.1], hint: 'Extra knockback per % of the target, times the global growth.' },
    knockbackAngle: { key: 'knockbackAngle', label: 'Angle', unit: 'deg', range: [0, 359, 1], hint: '0 forward, 90 up, 270 down.' },
    startupDuration: { key: 'startupDuration', label: 'Startup', unit: 'ms', range: [0, 800, 1], hint: 'Before the hitbox comes out.' },
    activeDuration: { key: 'activeDuration', label: 'Active', unit: 'ms', range: [0, 1000, 1], hint: 'The hitbox is out.' },
    recoveryDuration: { key: 'recoveryDuration', label: 'Recovery', unit: 'ms', range: [0, 1000, 1], hint: 'After the hitbox, before the next action.' },
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
