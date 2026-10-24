import type { NetClient } from './NetClient';
import { packInput, type FighterInput } from '../../shared/FighterInput';
import type { MatchState } from '../../shared/GameSim';
import type { MatchEvent } from '../../shared/MatchEvents';
import { NetEvent, NET_REPORT_MS, type MatchStart, type NetReport, type PlayerLeft } from '../../shared/NetProtocol';
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
    /** For the NetReport: since the last one. */
    private reportAt = performance.now();
    private rollbacksAtReport = 0;
    private waitsAtReport = 0;
    private skipsAtReport = 0;
    private deepestRollback = 0;
    private slowFrames = 0;
    private slowestFrame = 0;
    private lastPacketAt = 0;
    private packetGaps = 0;
    private longestGap = 0;

    constructor(client: NetClient, start: MatchStart) {
        this.client = client;
        this.start = start;
        client.onPacket(packet => {
            const now = performance.now();
            const gap = this.lastPacketAt > 0 ? now - this.lastPacketAt : 0;
            if (gap > 100) this.packetGaps++;
            this.longestGap = Math.max(this.longestGap, gap);
            this.lastPacketAt = now;
            this.session?.receivePacket(packet);
        });
    }

    /** A rendered frame took `ms`: slow ones go in the NetReport. */
    noteFrame(ms: number): void {
        if (ms > 50) this.slowFrames++;
        this.slowestFrame = Math.max(this.slowestFrame, ms);
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
        // A new session counts from 0
        this.rollbacksAtReport = 0;
        this.waitsAtReport = 0;
        this.skipsAtReport = 0;
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
        this.deepestRollback = Math.max(this.deepestRollback, session.lastRollbackDepth);
        if (now - this.reportAt >= NET_REPORT_MS) this.report(now);
        if (session.desyncFrame >= 0 && !this.desyncReported) {
            this.desyncReported = true;
            console.error(`[Online] Our simulation differs from another player's at frame ${session.desyncFrame}`);
        }
    }

    /** Tells the server how play went since the last report (it logs it), then starts counting again. */
    private report(now: number): void {
        const s = this.session!;
        const client = this.client;
        const report: NetReport = {
            rtt: Math.round(client.rtt), worstRtt: Math.round(client.worstRtt),
            rollbacks: s.rollbacks - this.rollbacksAtReport, deepestRollback: this.deepestRollback,
            waits: s.waits - this.waitsAtReport, skips: s.skips - this.skipsAtReport,
            slowFrames: this.slowFrames, slowestFrame: Math.round(this.slowestFrame),
            packetGaps: this.packetGaps, longestGap: Math.round(this.longestGap),
        };
        client.send(NetEvent.NET_REPORT, report);
        this.reportAt = now;
        this.rollbacksAtReport = s.rollbacks;
        this.waitsAtReport = s.waits;
        this.skipsAtReport = s.skips;
        this.deepestRollback = 0;
        this.slowFrames = 0;
        this.slowestFrame = 0;
        this.packetGaps = 0;
        this.longestGap = 0;
        client.worstRtt = 0;
    }

    /** How far rollbacks moved each fighter since the last call, by fighter (x, y), to ease into the drawing. */
    takeCorrections(): [number, number][] {
        return this.session?.takeCorrections() ?? [];
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
