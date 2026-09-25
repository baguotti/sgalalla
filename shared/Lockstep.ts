/**
 * Delay-based lockstep for a two-player match.
 *
 * Each side simulates frame F only once it has both players' inputs for F.
 * A player's input is sampled `inputDelay` frames before the frame it applies
 * to, which gives it that long to reach the other side; frames before
 * `inputDelay` have no input. Packets repeat every input the other side hasn't
 * acknowledged, and carry a checksum of the match every CHECKSUM_INTERVAL
 * frames so the two sides can tell if their simulations ever disagree.
 */

import { MAX_INPUTS_PER_PACKET, decodeInputPacket, encodeInputPacket } from './NetProtocol.js';

export const CHECKSUM_INTERVAL = 60;

export class Lockstep {
    readonly matchId: number;
    readonly slot: number;
    readonly inputDelay: number;
    /** Next frame to simulate. */
    frame = 0;
    /** First frame at which the two sides' checksums differed, or -1. */
    desyncFrame = -1;

    /** Packed inputs by frame, ours and the other player's. */
    private readonly local: number[] = [];
    private readonly remote: number[] = [];
    /** First frame of ours the other side doesn't have yet. */
    private remoteNeeds: number;
    /** First frame of theirs we don't have yet. */
    private remoteNext: number;

    private readonly localChecksums = new Map<number, number>();
    private readonly remoteChecksums = new Map<number, number>();
    private latestChecksum: { frame: number; value: number } | null = null;

    private sentPackets = 0;
    private receivedPackets = 0;
    private highestReceivedSeq = -1;

    /** `matchId` tells this match's packets from a previous one's; both sides use the match seed. */
    constructor(matchId: number, slot: number, inputDelay: number) {
        this.matchId = matchId >>> 0;
        this.slot = slot;
        this.inputDelay = inputDelay;
        this.remoteNeeds = inputDelay;
        this.remoteNext = inputDelay;
    }

    /**
     * Both players' inputs for the next frame, by slot, or null while the other
     * player's hasn't arrived. On success our own input for frame + inputDelay
     * is taken from `sampleLocal`.
     */
    advance(sampleLocal: () => number): number[] | null {
        const f = this.frame;
        const hasInputs = f >= this.inputDelay;
        if (hasInputs && this.remote[f] === undefined) return null;

        this.local[f + this.inputDelay] = sampleLocal();
        const inputs = [0, 0];
        if (hasInputs) {
            inputs[this.slot] = this.local[f];
            inputs[1 - this.slot] = this.remote[f];
        }
        this.frame++;
        return inputs;
    }

    /** Record the match checksum after simulating `frame`, if it's a checksum frame. */
    recordChecksum(frame: number, value: number): void {
        if (frame % CHECKSUM_INTERVAL !== 0) return;
        this.localChecksums.set(frame, value);
        this.latestChecksum = { frame, value };
        this.compareChecksum(frame);
    }

    /** Our inputs the other side hasn't acknowledged, our acknowledgement and latest checksum. */
    buildPacket(): Uint8Array {
        const first = this.remoteNeeds;
        const count = Math.min(Math.max(this.local.length - first, 0), MAX_INPUTS_PER_PACKET);
        return encodeInputPacket({
            match: this.matchId,
            seq: this.sentPackets++,
            ackNext: this.remoteNext,
            first,
            inputs: this.local.slice(first, first + count),
            checksum: this.latestChecksum,
        });
    }

    receivePacket(bytes: Uint8Array): void {
        const packet = decodeInputPacket(bytes);
        if (!packet || packet.match !== this.matchId) return;

        this.receivedPackets++;
        this.highestReceivedSeq = Math.max(this.highestReceivedSeq, packet.seq);
        this.remoteNeeds = Math.max(this.remoteNeeds, packet.ackNext);

        packet.inputs.forEach((mask, i) => {
            const frame = packet.first + i;
            if (frame >= this.inputDelay && this.remote[frame] === undefined) this.remote[frame] = mask;
        });
        while (this.remote[this.remoteNext] !== undefined) this.remoteNext++;

        if (packet.checksum) {
            this.remoteChecksums.set(packet.checksum.frame, packet.checksum.value);
            this.compareChecksum(packet.checksum.frame);
        }
    }

    /** Share of the other side's packets that never arrived, 0 to 1. */
    get packetLoss(): number {
        const expected = this.highestReceivedSeq + 1;
        return expected > 0 ? 1 - this.receivedPackets / expected : 0;
    }

    private compareChecksum(frame: number): void {
        const local = this.localChecksums.get(frame);
        const remote = this.remoteChecksums.get(frame);
        if (local === undefined || remote === undefined) return;
        if (local !== remote && this.desyncFrame < 0) this.desyncFrame = frame;
        // Older checksums whose counterpart was lost will never be compared
        for (const checksums of [this.localChecksums, this.remoteChecksums]) {
            for (const f of checksums.keys()) if (f <= frame) checksums.delete(f);
        }
    }
}
