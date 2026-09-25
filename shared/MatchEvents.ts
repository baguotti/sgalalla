/**
 * What happened during a simulation step, for sounds and effects. The
 * simulation only writes events; nothing in it reads them back.
 */

import type { GhostHitbox } from './FighterState.js';
import type { PhysicsEvent } from './PhysicsSimulation.js';

export type MatchEvent =
    /** A sound the physics asked for: jumps, dashes, landings. */
    | { type: 'sound'; fighter: number; key: string; volume: number }
    /** A light attack, or a heavy attack released from a charge. */
    | { type: 'attack'; fighter: number; key: string; charged: boolean }
    /** A signature attack threw its ghost; a copy of the ghost as spawned. */
    | { type: 'ghost'; fighter: number; ghost: GhostHitbox }
    /** `attackKey` is null for a hit with the recovery move. */
    | { type: 'hit'; attacker: number; target: number; attackKey: string | null }
    | { type: 'groundPoundMiss'; fighter: number }
    /** Position is where the fighter left the stage. */
    | { type: 'ko'; fighter: number; x: number; y: number }
    | { type: 'respawn'; fighter: number; x: number; y: number };

/** Forwards the sounds among a fighter's physics events. */
export function pushPhysicsSounds(events: MatchEvent[], fighter: number, physicsEvents: readonly PhysicsEvent[]): void {
    for (const event of physicsEvents) {
        if (event.type === 'sfx') events.push({ type: 'sound', fighter, key: event.key, volume: event.volume });
    }
}
