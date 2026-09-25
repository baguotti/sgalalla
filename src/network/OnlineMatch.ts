import type { NetClient } from './NetClient';
import { packInput, type FighterInput } from '../../shared/FighterInput';
import type { MatchState } from '../../shared/GameSim';
import type { MatchEvent } from '../../shared/MatchEvents';
import type { MatchStart } from '../../shared/NetProtocol';
import { RollbackSession } from '../../shared/Rollback';

/**
 * The network side of an online match: runs it in rollback with the opponent
 * (shared/Rollback.ts) and reports how that is going.
 */
export class OnlineMatch {
    readonly client: NetClient;
    /** Our fighter's index in the match. */
    readonly slot: number;
    /** The server's start message for the current match. */
    start: MatchStart;

    private session: RollbackSession | null = null;
    private desyncReported = false;

    constructor(client: NetClient, slot: number, start: MatchStart) {
        this.client = client;
        this.slot = slot;
        this.start = start;
        client.onPacket(packet => this.session?.receivePacket(packet));
    }

    /** Plays `match`, freshly created from `start`: the first match or a rematch. */
    begin(match: MatchState): void {
        this.session = new RollbackSession(this.start.seed, this.slot, this.start.inputDelay, match);
        this.desyncReported = false;
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
     * Simulates the next frame, correcting any wrong guess of the opponent's
     * input first. Events to play go to `events`. False while waiting for the
     * opponent or letting them catch up.
     */
    step(readLocal: () => FighterInput, events: MatchEvent[]): boolean {
        return this.session!.step(() => packInput(readLocal()), events);
    }

    /** Sends every input the opponent hasn't confirmed. Once per rendered frame, also after the match ends. */
    flush(): void {
        const session = this.session;
        if (!session) return;
        this.client.sendPacket(session.buildPacket());
        if (session.desyncFrame >= 0 && !this.desyncReported) {
            this.desyncReported = true;
            console.error(`[Online] The two simulations differ at frame ${session.desyncFrame}`);
        }
    }

    /** One line for the stats overlay. */
    stats(): string {
        const s = this.session;
        if (!s) return '';
        const loss = Math.round(s.packetLoss * 100);
        const sync = s.desyncFrame < 0 ? 'SYNC OK' : `DESYNC @${s.desyncFrame}`;
        return `DLY ${s.inputDelay}f  RB ${s.lastRollbackDepth}/${s.maxRollbackDepth}  WAIT ${s.waits}  SKIP ${s.skips}  LOSS ${loss}%  ${sync}`;
    }
}
