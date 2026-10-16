/**
 * Bombs, as Brawlhalla's Bouncy Bomb gadget (settings: PhysicsConfig BOMB_*).
 *
 * One drops from the sky over the main platform now and then. A fighter
 * pressing throw within reach of a loose bomb picks it up (a thrown one too:
 * a catch), and pressing it again throws it: up, down, or forward and a little
 * up. Thrown, it's armed: after a short grace period it explodes on touching
 * any fighter, its thrower included, hurting everyone near. It bounces off the
 * stage, and a bounce that leaves it slow makes it safe again. A fighter hit
 * while holding one drops it. A loose bomb is gone after a while, and one past
 * the blast zones at once.
 */

import { hitstopFor, KNOCKBACK_DIRECTIONS, knockbackSpeed, launchFighter } from './Combat.js';
import { SIM_STEP_MS } from './FixedStepClock.js';
import { consumeBuffered, isBuffered, isInPlay, type FighterState } from './FighterState.js';
import type { MatchEvent } from './MatchEvents.js';
import { PhysicsConfig } from './PhysicsConfig.js';
import { randomInt } from './Random.js';
import type { SimStage } from './StageData.js';

export interface BombState {
    /** Tells bombs apart from one step to the next (for drawing). */
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    /** The fighter holding it, or -1. */
    holder: number;
    /** Who threw it last, or -1. */
    thrower: number;
    /** Thrown and still fast: it explodes on touching a fighter. */
    armed: boolean;
    /** Steps it still passes through everyone after a throw. */
    graceSteps: number;
    /** Steps left before a loose bomb is gone. */
    lifeSteps: number;
}

/** A match's bombs, and when the next one may drop (ms). */
export interface Bombs {
    list: BombState[];
    nextId: number;
    dropTimer: number;
}

export function createBombs(): Bombs {
    return { list: [], nextId: 0, dropTimer: PhysicsConfig.BOMB_FIRST };
}

/** What a step needs from the match. */
interface Arena {
    rng: number;
    fighters: FighterState[];
    bombs: Bombs | null;
}

const STEP_S = SIM_STEP_MS / 1000;
/** Forward throws go this much up: cos and sin of 15°. */
const FORWARD = [0.9659258262890683, 0.25881904510252074] as const;
/** Explosions launch up and away at this angle (a KNOCKBACK_DIRECTIONS entry). */
const BLAST_ANGLE = 50;
/** A bounce slower than this (px/s) settles the bomb on the floor, which slows it as it rolls. */
const SETTLE_SPEED = 150;
const ROLL_KEEP = 0.9;

/** One step of every bomb: drops, holding, throws and catches, flight, explosions. */
export function updateBombs(match: Arena, layout: SimStage, events: MatchEvent[]): void {
    const bombs = match.bombs;
    if (!bombs) return;

    // One bomb at a time (two with 4 fighters or more); the next drops a while after one is gone
    if (bombs.list.length < (match.fighters.length >= 4 ? 2 : 1)) {
        bombs.dropTimer -= SIM_STEP_MS;
        if (bombs.dropTimer <= 0) {
            const main = layout.platforms[0];
            const x = randomInt(match, main.x - main.w / 2 + 120, main.x + main.w / 2 - 120);
            bombs.list.push({ id: bombs.nextId++, x, y: layout.camera.top + 100, vx: 0, vy: 0, holder: -1, thrower: -1, armed: false, graceSteps: 0, lifeSteps: lifetimeSteps() });
            bombs.dropTimer = PhysicsConfig.BOMB_GAP + randomInt(match, 0, PhysicsConfig.BOMB_GAP_RANDOM);
        }
    }

    for (let i = bombs.list.length - 1; i >= 0; i--) {
        if (!stepBomb(match, bombs.list[i], layout, events)) bombs.list.splice(i, 1);
    }
}

/** Returns false once the bomb is gone. */
function stepBomb(match: Arena, bomb: BombState, layout: SimStage, events: MatchEvent[]): boolean {
    if (bomb.holder >= 0) {
        const holder = match.fighters[bomb.holder];
        if (!isInPlay(holder)) return false;
        if (!holder.isHitStunned) {
            carry(bomb, holder);
            if (isBuffered(holder, 'throw')) {
                consumeBuffered(holder, 'throw');
                throwBomb(bomb, holder);
            }
            return true;
        }
        // Hit while holding it: dropped, safe
        bomb.holder = -1;
        bomb.vy = -400;
        bomb.lifeSteps = lifetimeSteps();
    }

    // Picked up before it can explode on whoever presses throw in reach: so a thrown bomb can be caught
    const catcher = match.fighters.find(f => isInPlay(f) && !f.isHitStunned && isBuffered(f, 'throw')
        && !match.bombs!.list.some(b => b.holder === f.id) && distanceToHurtbox(bomb, f) <= PhysicsConfig.BOMB_PICKUP_RANGE);
    if (catcher) {
        consumeBuffered(catcher, 'throw');
        bomb.holder = catcher.id;
        bomb.armed = false;
        bomb.graceSteps = 0;
        carry(bomb, catcher);
        return true;
    }

    fly(bomb, layout);
    const zone = layout.blastZones;
    if (bomb.x < zone.left || bomb.x > zone.right || bomb.y < zone.top || bomb.y > zone.bottom) return false;

    if (bomb.graceSteps > 0) {
        bomb.graceSteps--;
    } else if (bomb.armed && match.fighters.some(f => isHittable(f) && distanceToHurtbox(bomb, f) <= PhysicsConfig.BOMB_RADIUS)) {
        explode(match, bomb, events);
        return false;
    }
    return bomb.armed || --bomb.lifeSteps > 0;
}

/** In the holder's hand, moving with them (so a dropped bomb keeps their momentum). */
function carry(bomb: BombState, holder: FighterState): void {
    const b = holder.body;
    bomb.x = b.x + b.facingDirection * 34;
    bomb.y = b.y - 10;
    bomb.vx = b.vx;
    bomb.vy = b.vy;
}

function throwBomb(bomb: BombState, thrower: FighterState): void {
    const { aimUp, aimDown, aimLeft, aimRight } = thrower.input;
    const speed = PhysicsConfig.BOMB_THROW_SPEED;
    if (aimUp && !aimDown) {
        bomb.vx = 0;
        bomb.vy = -speed;
    } else if (aimDown && !aimUp) {
        bomb.vx = 0;
        bomb.vy = speed;
    } else {
        const facing = aimRight !== aimLeft ? (aimRight ? 1 : -1) : thrower.body.facingDirection;
        bomb.vx = FORWARD[0] * speed * facing;
        bomb.vy = -FORWARD[1] * speed;
    }
    bomb.holder = -1;
    bomb.thrower = thrower.id;
    bomb.armed = true;
    bomb.graceSteps = PhysicsConfig.BOMB_GRACE_STEPS;
    bomb.lifeSteps = lifetimeSteps();
}

/** Gravity, then the stage: solid platforms from every side, soft ones from above. */
function fly(bomb: BombState, layout: SimStage): void {
    const r = PhysicsConfig.BOMB_RADIUS;
    bomb.vy = Math.min(bomb.vy + PhysicsConfig.GRAVITY * STEP_S, PhysicsConfig.MAX_FALL_SPEED);
    bomb.x += bomb.vx * STEP_S;
    bomb.y += bomb.vy * STEP_S;

    for (const p of layout.platforms) {
        const left = p.x - p.w / 2;
        const right = p.x + p.w / 2;
        const top = p.y - p.h / 2;
        const bottom = p.y + p.h / 2;
        if (bomb.x + r <= left || bomb.x - r >= right || bomb.y + r <= top || bomb.y - r >= bottom) continue;
        if (p.isSoft) {
            // Only landing on it, from above
            if (bomb.vy > 0 && bomb.y + r - bomb.vy * STEP_S <= top + 1) bounce(bomb, 'floor', top - r);
            continue;
        }
        // Out the way it went in least
        const up = bomb.y + r - top;
        const down = bottom - (bomb.y - r);
        const toLeft = bomb.x + r - left;
        const toRight = right - (bomb.x - r);
        const least = Math.min(up, down, toLeft, toRight);
        if (least === up) bounce(bomb, 'floor', top - r);
        else if (least === down) bounce(bomb, 'ceiling', bottom + r);
        else if (least === toLeft) bounce(bomb, 'left', left - r);
        else bounce(bomb, 'right', right + r);
    }
}

function bounce(bomb: BombState, side: 'floor' | 'ceiling' | 'left' | 'right', at: number): void {
    const keep = PhysicsConfig.BOMB_BOUNCE;
    if (side === 'floor' || side === 'ceiling') {
        bomb.y = at;
        bomb.vy = (side === 'floor' ? -1 : 1) * Math.abs(bomb.vy) * keep;
        if (side === 'floor' && Math.abs(bomb.vy) < SETTLE_SPEED) {
            bomb.vy = 0;
            bomb.vx *= ROLL_KEEP;
        }
    } else {
        bomb.x = at;
        bomb.vx = (side === 'left' ? -1 : 1) * Math.abs(bomb.vx) * keep;
    }
    // Losing its momentum makes it safe again
    if (bomb.armed && Math.sqrt(bomb.vx * bomb.vx + bomb.vy * bomb.vy) < PhysicsConfig.BOMB_SAFE_SPEED) bomb.armed = false;
}

/**
 * Every hittable fighter in the blast is launched up and away at BLAST_ANGLE:
 * away from the bomb's side, or the way it was going if it's inside them.
 */
function explode(match: Arena, bomb: BombState, events: MatchEvent[]): void {
    events.push({ type: 'explosion', x: bomb.x, y: bomb.y });
    const [cos, sin] = KNOCKBACK_DIRECTIONS[BLAST_ANGLE];
    for (const target of match.fighters) {
        if (!isHittable(target) || distanceToHurtbox(bomb, target) > PhysicsConfig.BOMB_BLAST_RADIUS) continue;
        const dx = target.body.x - bomb.x;
        const side = Math.abs(dx) > PhysicsConfig.HURTBOX_WIDTH / 2 ? Math.sign(dx) : (Math.sign(bomb.vx) || 1);
        const knockback = knockbackSpeed(PhysicsConfig.BOMB_FIXED_FORCE, PhysicsConfig.BOMB_VARIABLE_FORCE, target.damagePercent + PhysicsConfig.BOMB_DAMAGE);
        launchFighter(target, PhysicsConfig.BOMB_DAMAGE, cos * side * knockback, -sin * knockback, PhysicsConfig.BOMB_STUN, hitstopFor(knockback));
        events.push({
            type: 'hit', attacker: bomb.thrower >= 0 ? bomb.thrower : target.id, target: target.id, attackKey: null,
            x: target.body.x, y: target.body.y, damage: PhysicsConfig.BOMB_DAMAGE, knockbackX: target.body.vx, knockbackY: target.body.vy,
        });
    }
}

function isHittable(f: FighterState): boolean {
    return isInPlay(f) && !f.isInvulnerable && !f.body.isInvincible;
}

/** From the bomb's centre to the nearest point of the fighter's hurtbox (0 inside it). */
function distanceToHurtbox(bomb: BombState, f: FighterState): number {
    const halfW = PhysicsConfig.HURTBOX_WIDTH / 2;
    const halfH = PhysicsConfig.HURTBOX_HEIGHT / 2;
    const dx = Math.max(Math.abs(bomb.x - f.body.x) - halfW, 0);
    const dy = Math.max(Math.abs(bomb.y - f.body.y) - halfH, 0);
    return Math.sqrt(dx * dx + dy * dy);
}

function lifetimeSteps(): number {
    return Math.round(PhysicsConfig.BOMB_LIFETIME / SIM_STEP_MS);
}
