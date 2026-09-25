import type { NetClient } from './NetClient';
import { emptyInput, packInput, unpackInput, type FighterInput } from '../../shared/FighterInput';
import { matchChecksum, type MatchState } from '../../shared/GameSim';
import { CHECKSUM_INTERVAL, Lockstep } from '../../shared/Lockstep';
import type { MatchStart } from '../../shared/NetProtocol';

/**
 * The network side of an online match: trades inputs with the opponent in
 * lockstep and checks that both simulations stay identical.
 */
export class OnlineMatch {
    readonly client: NetClient;
    /** Our fighter's index in the match. */
    readonly slot: number;
    start: MatchStart;
    /** Steps that had to wait for the opponent's input. */
    stalls = 0;

    private lockstep: Lockstep;
    private readonly inputs: FighterInput[] = [emptyInput(), emptyInput()];
    private desyncReported = false;

    constructor(client: NetClient, slot: number, start: MatchStart) {
        this.client = client;
        this.slot = slot;
        this.start = start;
        this.lockstep = new Lockstep(start.seed, slot, start.inputDelay);
        client.onPacket(packet => this.lockstep.receivePacket(packet));
    }

    /** A rematch: the same players in a new match. */
    restart(start: MatchStart): void {
        this.start = start;
        this.lockstep = new Lockstep(start.seed, this.slot, start.inputDelay);
        this.stalls = 0;
        this.desyncReported = false;
    }

    /**
     * Both fighters' inputs for the next step, by slot, or null while the
     * opponent's hasn't arrived. `readLocal` is only called when the step runs.
     */
    nextInputs(readLocal: () => FighterInput): FighterInput[] | null {
        const masks = this.lockstep.advance(() => packInput(readLocal()));
        if (!masks) {
            this.stalls++;
            return null;
        }
        masks.forEach((mask, slot) => unpackInput(mask, this.inputs[slot]));
        return this.inputs;
    }

    afterStep(match: MatchState): void {
        if (match.frame % CHECKSUM_INTERVAL === 0) this.lockstep.recordChecksum(match.frame, matchChecksum(match));
    }

    /** Sends every input the opponent hasn't confirmed. Once per rendered frame, also after the match ends. */
    flush(): void {
        this.client.sendPacket(this.lockstep.buildPacket());
        if (this.lockstep.desyncFrame >= 0 && !this.desyncReported) {
            this.desyncReported = true;
            console.error(`[Online] The two simulations differ at frame ${this.lockstep.desyncFrame}`);
        }
    }

    /** One line for the stats overlay. */
    stats(): string {
        const loss = Math.round(this.lockstep.packetLoss * 100);
        const sync = this.lockstep.desyncFrame < 0 ? 'SYNC OK' : `DESYNC @${this.lockstep.desyncFrame}`;
        return `DLY  ${this.start.inputDelay}f  STALL ${this.stalls}  LOSS ${loss}%  ${sync}`;
    }
}
