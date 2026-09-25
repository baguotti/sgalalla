/**
 * Two lockstep peers over a simulated network: latency, jitter, packet loss
 * and reordering. Each peer runs its own copy of the match from random inputs;
 * the copies must never disagree.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, matchChecksum, stepMatch, type MatchState } from '../shared/GameSim.ts';
import { unpackInput } from '../shared/FighterInput.ts';
import { Lockstep } from '../shared/Lockstep.ts';

const FRAME_MS = 1000 / 60;

/** Seeded generator for reproducible network conditions and inputs. */
function random(seed: number): () => number {
    let a = seed | 0;
    return () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), a | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Directions and held buttons (bits 0-7, 9, 11, 13, 15 of packInput). */
const HELD_BITS = 0xAAFF;
/** Jump, light, heavy and dodge presses. */
const PRESS_BITS = [8, 10, 12, 14];

/** Button mashing: a new held mask every 10 frames, plus random presses. */
function masher(seed: number): () => number {
    const rand = random(seed);
    let held = 0;
    let frame = 0;
    return () => {
        if (frame++ % 10 === 0) held = Math.floor(rand() * (1 << 16)) & HELD_BITS;
        const press = rand() < 0.15 ? 1 << PRESS_BITS[Math.floor(rand() * PRESS_BITS.length)] : 0;
        return held | press;
    };
}

interface Conditions {
    latencyMs: number;
    jitterMs: number;
    loss: number;
    inputDelay: number;
    /** Ticks after peer 0 that peer 1 starts, like a start message arriving later. */
    startOffset?: number;
    ticks: number;
}

interface Peer {
    lockstep: Lockstep;
    match: MatchState;
    sample: () => number;
    started: boolean;
    /** Match checksum after each frame. */
    history: number[];
}

function play(c: Conditions, tamper?: (peers: Peer[], tick: number) => void) {
    const fighters = [{ character: 'fok', x: 520, y: 300 }, { character: 'sgu', x: 1400, y: 300 }];
    const peers: Peer[] = [0, 1].map(slot => ({
        lockstep: new Lockstep(1234, slot, c.inputDelay),
        match: createMatch(fighters, 1234),
        sample: masher(100 + slot),
        started: false,
        history: [],
    }));
    const net = random(7);
    const inFlight: { at: number; to: number; bytes: Uint8Array }[] = [];

    for (let tick = 0; tick < c.ticks; tick++) {
        const now = tick * FRAME_MS;
        peers[0].started = true;
        peers[1].started = tick >= (c.startOffset ?? 0);

        peers.forEach((peer, slot) => {
            if (!peer.started) return;
            const inputs = peer.lockstep.advance(peer.sample);
            if (inputs) {
                stepMatch(peer.match, inputs.map(mask => unpackInput(mask)));
                const checksum = matchChecksum(peer.match);
                peer.history.push(checksum);
                peer.lockstep.recordChecksum(peer.match.frame, checksum);
            }
            if (net() >= c.loss) {
                inFlight.push({ at: now + c.latencyMs + (net() * 2 - 1) * c.jitterMs, to: 1 - slot, bytes: peer.lockstep.buildPacket() });
            }
        });

        for (let i = inFlight.length - 1; i >= 0; i--) {
            if (inFlight[i].at <= now) {
                peers[inFlight[i].to].lockstep.receivePacket(inFlight[i].bytes);
                inFlight.splice(i, 1);
            }
        }
        tamper?.(peers, tick);
    }
    return peers;
}

/** Both copies of the match were identical after every frame both simulated. */
function assertInSync(peers: Peer[]): void {
    const [a, b] = peers.map(p => p.history);
    const frames = Math.min(a.length, b.length);
    for (let i = 0; i < frames; i++) {
        if (a[i] !== b[i]) assert.fail(`the copies differ after frame ${i + 1}`);
    }
    for (const peer of peers) assert.equal(peer.lockstep.desyncFrame, -1);
}

test('peers agree on a clean network', () => {
    const peers = play({ latencyMs: 0, jitterMs: 0, loss: 0, inputDelay: 2, ticks: 1800 });
    assertInSync(peers);
    assert.ok(peers[0].lockstep.frame >= 1790, `advanced ${peers[0].lockstep.frame} frames`);
});

test('peers agree at 100 ms ping with jitter, 5% loss and a late start', () => {
    const peers = play({ latencyMs: 50, jitterMs: 10, loss: 0.05, inputDelay: 5, startOffset: 6, ticks: 3600 });
    assertInSync(peers);
    const [a, b] = peers.map(p => p.lockstep.frame);
    assert.ok(Math.min(a, b) > 3300, `advanced ${a} and ${b} frames of 3600`);
    assert.ok(peers.every(p => p.match.isOver), 'the random inputs play a match to the end');
});

test('peers agree through 30% loss, only slower', () => {
    const peers = play({ latencyMs: 30, jitterMs: 20, loss: 0.3, inputDelay: 4, ticks: 1800 });
    assertInSync(peers);
    assert.ok(peers[0].lockstep.frame > 900, `advanced ${peers[0].lockstep.frame} frames`);
});

test('a peer that falls out of sync is caught by the checksums', () => {
    const peers = play({ latencyMs: 20, jitterMs: 0, loss: 0, inputDelay: 3, ticks: 600 }, (peers, tick) => {
        if (tick === 200) peers[1].match.fighters[0].damagePercent += 1;
    });
    for (const peer of peers) {
        assert.ok(peer.lockstep.desyncFrame > 180 && peer.lockstep.desyncFrame <= 300, `desync seen at ${peer.lockstep.desyncFrame}`);
    }
});

test('a packet from the previous match is ignored after a rematch', () => {
    const previous = new Lockstep(1, 0, 2);
    const current = new Lockstep(2, 1, 2);
    for (let i = 0; i < 5; i++) previous.advance(() => 0b1);
    current.receivePacket(previous.buildPacket());
    for (let i = 0; i < 2; i++) assert.ok(current.advance(() => 0), 'frames before the delay need no input');
    assert.equal(current.advance(() => 0), null, 'still waiting for the opponent in this match');
});
