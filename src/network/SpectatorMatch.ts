import type { NetClient } from './NetClient';
import type { MatchState } from '../../shared/GameSim';
import type { MatchEvent } from '../../shared/MatchEvents';
import type { PlayerLeft, WatchInputs, WatchStart } from '../../shared/NetProtocol';
import { NetEvent } from '../../shared/NetProtocol';
import { SpectatorSession } from '../../shared/Spectate';

/**
 * Watching an online match (shared/Spectate.ts): the server's batches of the
 * players' inputs come in, and each frame decides how many steps to play.
 * Joining late, it fast-forwards silently to near the live action; then it
 * stays a few steps behind the newest inputs, so network hiccups don't show.
 */

/** Steps kept in hand behind the newest inputs. */
const BUFFER = 6;
/** Further behind than this, fast-forward (silently, no sounds or effects). */
const CATCH_UP_FROM = 90;
/** Most steps simulated in one frame while fast-forwarding. */
const CATCH_UP_STEPS = 400;

export class SpectatorMatch {
    readonly client: NetClient;
    readonly watch: WatchStart;
    private session: SpectatorSession | null = null;
    /** Batches that came before the match was set up: the server sends each only once. */
    private readonly early: WatchInputs['batches'];

    /** `early`: batches that arrived before this was made (the lobby keeps them). */
    constructor(client: NetClient, watch: WatchStart, early: WatchInputs['batches'] = []) {
        this.client = client;
        this.watch = watch;
        this.early = [...early];
        client.on(NetEvent.WATCH_INPUTS, (message: WatchInputs) => {
            if (this.session) for (const batch of message.batches) this.session.addInputs(batch.slot, batch.first, batch.inputs);
            else this.early.push(...message.batches);
        });
    }

    /** Watches `match`, freshly created from the watch start. */
    begin(match: MatchState): void {
        const session = new SpectatorSession(this.watch.characters.length, this.watch.inputDelay, match);
        for (const { slot, lastFrame } of this.watch.left) session.playerLeft(slot, lastFrame);
        for (const batch of this.early) session.addInputs(batch.slot, batch.first, batch.inputs);
        this.early.length = 0;
        this.session = session;
    }

    playerLeft(left: PlayerLeft): void {
        this.session?.playerLeft(left.slot, left.lastFrame);
    }

    get match(): MatchState {
        return this.session!.match;
    }

    /** Steps behind the newest inputs. */
    get behind(): number {
        return this.session?.behind ?? 0;
    }

    /** Fast-forwarding to catch up: what's simulated isn't shown step by step. */
    get catchingUp(): boolean {
        return this.behind > CATCH_UP_FROM;
    }

    /**
     * How many steps to play this frame, `due` being the steps real time asks for:
     * a lot while catching up, one more now and then while the buffer grows, none when it runs dry.
     */
    stepsNow(due: number): number {
        const behind = this.behind;
        if (behind > CATCH_UP_FROM) return Math.min(CATCH_UP_STEPS, behind - BUFFER);
        if (due === 0) return 0;
        if (behind > BUFFER * 2) return Math.min(behind - BUFFER, due + 1);
        return Math.min(due, Math.max(0, behind - 1));
    }

    /** Simulates one step if its inputs are here; its events go to `events`. */
    step(events: MatchEvent[]): boolean {
        return this.session?.step(events) ?? false;
    }

    stats(): string {
        return `SPETTATORE  DIETRO ${this.behind}f`;
    }
}
