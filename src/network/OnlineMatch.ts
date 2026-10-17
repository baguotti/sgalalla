import type { NetClient } from './NetClient';
import { packInput, type FighterInput } from '../../shared/FighterInput';
import type { MatchState } from '../../shared/GameSim';
import type { MatchEvent } from '../../shared/MatchEvents';
import type { MatchStart, PlayerLeft } from '../../shared/NetProtocol';
import { SIM_STEP_MS } from '../../shared/FixedStepClock';
import { RollbackSession } from '../../shared/Rollback';

/**
 * The network side of an online match: runs it in rollback with the other
 * players (shared/Rollback.ts) and reports how that is going.
 */
export class OnlineMatch {
    readonly client: NetClient;
    /** The server's start message for the current match. */
    start: MatchStart;

    private session: RollbackSession | null = null;
    private desyncReported = false;
    private lastSentFrame = -1;
    private lastSentAt = 0;

    constructor(client: NetClient, start: MatchStart) {
        this.client = client;
        this.start = start;
        client.onPacket(packet => this.session?.receivePacket(packet));
    }

    /** Our fighter's index in the match. */
    get slot(): number {
        return this.start.slot;
    }

    /** Plays `match`, freshly created from `start`: the first match or a rematch. */
    begin(match: MatchState): void {
        const { seed, slot, characters, inputDelay } = this.start;
        this.session = new RollbackSession(seed, slot, characters.length, inputDelay, match);
        this.desyncReported = false;
    }

    /** A player left: their fighter leaves the match, the same frame on every machine. */
    playerLeft(left: PlayerLeft): void {
        this.session?.playerLeft(left.slot, left.lastFrame, left.first, left.inputs);
    }

    /** How many of the other players are still in the match. */
    get othersPlaying(): number {
        const s = this.session;
        if (!s) return 0;
        let count = 0;
        for (let slot = 0; slot < s.players; slot++) if (slot !== s.slot && s.isPlaying(slot)) count++;
        return count;
    }

    /** The match as simulated so far. A rollback can replace the object. */
    get match(): MatchState {
        return this.session!.match;
    }

    /** The match has ended in a frame no rollback can undo. */
    get isOverConfirmed(): boolean {
        return this.session!.isOverConfirmed;
    }

    /**
     * Simulates the next frame, correcting any wrong guess of the others'
     * inputs first. Events to play go to `events`. False while waiting for
     * someone or letting them catch up.
     */
    step(readLocal: () => FighterInput, events: MatchEvent[]): boolean {
        return this.session!.step(() => packInput(readLocal()), events);
    }

    /**
     * Sends every input someone hasn't confirmed: called once per rendered frame, also after the
     * match ends. It sends once per simulated frame, or at the step rate while none is simulated,
     * so a 120 Hz display doesn't send twice as much.
     */
    flush(): void {
        const session = this.session;
        if (!session) return;
        const now = performance.now();
        if (session.frame === this.lastSentFrame && now - this.lastSentAt < SIM_STEP_MS * 0.75) return;
        this.lastSentFrame = session.frame;
        this.lastSentAt = now;
        this.client.sendPacket(session.buildPacket());
        if (session.desyncFrame >= 0 && !this.desyncReported) {
            this.desyncReported = true;
            console.error(`[Online] Our simulation differs from another player's at frame ${session.desyncFrame}`);
        }
    }

    /** One line for the stats overlay. */
    stats(): string {
        const s = this.session;
        if (!s) return '';
        const sync = s.desyncFrame < 0 ? 'SYNC OK' : `DESYNC @${s.desyncFrame}`;
        // Each other player: how many frames behind their inputs arrive, and their lost packets
        const peers = s.peerStats().map(p => `P${p.slot + 1} ${p.behind}f ${Math.round(p.loss * 100)}%`).join('  ');
        return `DLY ${s.inputDelay}f  RB ${s.lastRollbackDepth}/${s.maxRollbackDepth}  WAIT ${s.waits}  SKIP ${s.skips}  ${sync}  |  ${peers}`;
    }
}
