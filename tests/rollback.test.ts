/**
 * Rollback players over a simulated network: latency, jitter, packet loss and
 * reordering, with each packet reaching every other player separately, as the
 * relay server does. Each player runs their own copy of the match from random
 * inputs, guessing the others'; once a frame is confirmed, all copies must agree.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, matchChecksum, stepMatch } from '../shared/GameSim.ts';
import { unpackInput } from '../shared/FighterInput.ts';
import type { MatchEvent } from '../shared/MatchEvents.ts';
import { MAX_ROLLBACK, RollbackSession } from '../shared/Rollback.ts';

const FRAME_MS = 1000 / 60;
const FIGHTERS = [
    { character: 'fok', x: 520, y: 300 },
    { character: 'sgu', x: 1400, y: 300 },
    { character: 'pe', x: 800, y: 200 },
    { character: 'nock', x: 1120, y: 200 },
];

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
    players: number;
    latencyMs: number;
    jitterMs: number;
    loss: number;
    inputDelay: number;
    /** Tick at which each player starts, like start messages arriving at different times. */
    startTicks?: number[];
    ticks: number;
}

interface Peer {
    session: RollbackSession;
    sample: () => number;
    /** Checksum of the match at the start of each confirmed frame. */
    confirmed: Map<number, number>;
    events: MatchEvent[];
}

function play(c: Conditions, tamper?: (peers: Peer[], tick: number) => void): Peer[] {
    const fighters = FIGHTERS.slice(0, c.players);
    const peers: Peer[] = fighters.map((_, slot) => {
        const peer: Peer = {
            session: new RollbackSession(1234, slot, c.players, c.inputDelay, createMatch(fighters, 1234)),
            sample: masher(100 + slot),
            confirmed: new Map(),
            events: [],
        };
        peer.session.onConfirmed = (frame, state) => peer.confirmed.set(frame, matchChecksum(state));
        return peer;
    });
    const net = random(7);
    const inFlight: { at: number; to: number; bytes: Uint8Array }[] = [];

    for (let tick = 0; tick < c.ticks; tick++) {
        const now = tick * FRAME_MS;
        peers.forEach((peer, slot) => {
            if (tick < (c.startTicks?.[slot] ?? 0)) return;
            peer.session.step(peer.sample, peer.events);
            const bytes = peer.session.buildPacket();
            for (let to = 0; to < peers.length; to++) {
                if (to === slot || net() < c.loss) continue;
                inFlight.push({ at: now + c.latencyMs + (net() * 2 - 1) * c.jitterMs, to, bytes });
            }
        });
        for (let i = inFlight.length - 1; i >= 0; i--) {
            if (inFlight[i].at <= now) {
                peers[inFlight[i].to].session.receivePacket(inFlight[i].bytes);
                inFlight.splice(i, 1);
            }
        }
        tamper?.(peers, tick);
    }
    return peers;
}

/** Every frame confirmed by two players has the same state for both. */
function assertInSync(peers: Peer[]): void {
    const [first, ...rest] = peers.map(p => p.confirmed);
    for (const other of rest) {
        let compared = 0;
        for (const [frame, checksum] of first) {
            const theirs = other.get(frame);
            if (theirs === undefined) continue;
            if (theirs !== checksum) assert.fail(`two copies differ at confirmed frame ${frame}`);
            compared++;
        }
        assert.ok(compared > 0, 'no confirmed frames to compare');
    }
    for (const peer of peers) assert.equal(peer.session.desyncFrame, -1);
}

test('two players need no rollback on a clean network', () => {
    const peers = play({ players: 2, latencyMs: 0, jitterMs: 0, loss: 0, inputDelay: 1, ticks: 1800 });
    assertInSync(peers);
    for (const { session } of peers) {
        assert.ok(session.frame >= 1790, `advanced ${session.frame} frames`);
        assert.equal(session.rollbacks, 0);
    }
});

test('two players agree at 100 ms ping with jitter, 5% loss and a late start', () => {
    // Long enough for the mashers to finish a match
    const peers = play({ players: 2, latencyMs: 50, jitterMs: 10, loss: 0.05, inputDelay: 2, startTicks: [0, 6], ticks: 5400 });
    assertInSync(peers);
    const [a, b] = peers.map(p => p.session);
    assert.ok(Math.min(a.frame, b.frame) > 5000, `advanced ${a.frame} and ${b.frame} frames of 5400`);
    assert.ok(a.rollbacks > 0 && b.rollbacks > 0, 'guesses were corrected');
    assert.ok(Math.max(a.maxRollbackDepth, b.maxRollbackDepth) <= MAX_ROLLBACK);
    assert.ok(a.skips > 0, 'the player who started first slowed down');
    assert.ok(Math.abs(a.frame - b.frame) <= 3, `frames ${a.frame} and ${b.frame} stayed level`);
    assert.ok(a.isOverConfirmed && b.isOverConfirmed, 'the random inputs play a match to the end');
});

test('four players agree at 100 ms ping with jitter, 5% loss and staggered starts', () => {
    const peers = play({ players: 4, latencyMs: 50, jitterMs: 10, loss: 0.05, inputDelay: 2, startTicks: [0, 4, 9, 13], ticks: 5400 });
    assertInSync(peers);
    const frames = peers.map(p => p.session.frame);
    assert.ok(Math.min(...frames) > 4800, `advanced ${frames.join(', ')} frames of 5400`);
    assert.ok(Math.max(...frames) - Math.min(...frames) <= 3, `frames ${frames.join(', ')} stayed level`);
    assert.ok(peers.every(p => p.session.rollbacks > 0), 'guesses were corrected');
    assert.ok(peers[0].session.skips > 0, 'the player who started first slowed down');
    assert.ok(peers.every(p => p.session.isOverConfirmed), 'the random inputs play a match to the end');
});

test('three players agree through 30% loss, waiting when too far ahead', () => {
    const peers = play({ players: 3, latencyMs: 30, jitterMs: 20, loss: 0.3, inputDelay: 2, ticks: 1800 });
    assertInSync(peers);
    assert.ok(peers[0].session.frame > 900, `advanced ${peers[0].session.frame} frames`);
});

test('a player who falls out of sync is caught by the checksums', () => {
    const peers = play({ players: 4, latencyMs: 20, jitterMs: 0, loss: 0, inputDelay: 2, ticks: 600 }, (peers, tick) => {
        if (tick === 200) peers[2].session.match.fighters[0].damagePercent += 1;
    });
    for (const { session } of peers) {
        assert.ok(session.desyncFrame > 180 && session.desyncFrame <= 300, `desync seen at ${session.desyncFrame}`);
    }
});

test('a packet from the previous match is ignored after a rematch', () => {
    const fighters = FIGHTERS.slice(0, 2);
    const previous = new RollbackSession(1, 0, 2, 2, createMatch(fighters, 1));
    const current = new RollbackSession(2, 1, 2, 2, createMatch(fighters, 2));
    for (let i = 0; i < 5; i++) previous.step(() => 0b1, []);
    current.receivePacket(previous.buildPacket());
    for (let i = 0; i < 5; i++) current.step(() => 0, []);
    assert.equal(current.confirmedFrame, 2, 'only the frames before the input delay are confirmed');
});

test('a restored copy of the match continues exactly like the original', () => {
    const match = createMatch(FIGHTERS, 99);
    const inputs = FIGHTERS.map((_, i) => masher(i + 1));
    const next = () => inputs.map(sample => unpackInput(sample()));
    for (let i = 0; i < 300; i++) stepMatch(match, next());

    const copy = structuredClone(match);
    for (let i = 0; i < 600; i++) {
        const step = next();
        stepMatch(match, step);
        stepMatch(copy, step);
    }
    assert.equal(matchChecksum(copy), matchChecksum(match));
});
