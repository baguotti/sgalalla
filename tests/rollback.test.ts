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
import { decodeInputPacket } from '../shared/NetProtocol.ts';
import { SpectatorSession } from '../shared/Spectate.ts';

const FRAME_MS = 1000 / 60;
const FIGHTERS = [
    { character: 'fok', x: 520, y: 300 },
    { character: 'sgu', x: 1400, y: 300 },
    { character: 'pe', x: 800, y: 200 },
    { character: 'nock', x: 1120, y: 200 },
    { character: 'greg', x: 960, y: 150 },
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
    /** A player who quits at a tick: the relay server then sends the others their last frame and inputs. */
    leave?: { slot: number; tick: number };
}

interface Peer {
    session: RollbackSession;
    sample: () => number;
    /** Checksum of the match at the start of each confirmed frame. */
    confirmed: Map<number, number>;
    events: MatchEvent[];
}

/** What the relay server saw: every player's inputs, by slot then frame, and who left after which frame. */
interface Relay {
    inputs: number[][];
    left: { slot: number; lastFrame: number }[];
}

function play(c: Conditions, tamper?: (peers: Peer[], tick: number) => void): Peer[] & { relay: Relay } {
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
    // The relay server sees every packet (all traffic goes through it)
    const relay: Relay = { inputs: fighters.map(() => []), left: [] };
    const relayed = c.leave ? relay.inputs[c.leave.slot] : [];
    const leaves: { at: number; to: number }[] = [];

    for (let tick = 0; tick < c.ticks; tick++) {
        const now = tick * FRAME_MS;
        if (c.leave && tick === c.leave.tick) {
            for (let to = 0; to < peers.length; to++) if (to !== c.leave.slot) leaves.push({ at: now + c.latencyMs, to });
        }
        if (c.leave && tick === c.leave.tick) {
            let last = c.inputDelay - 1;
            while (relayed[last + 1] !== undefined) last++;
            relay.left.push({ slot: c.leave.slot, lastFrame: last });
        }
        for (let i = leaves.length - 1; i >= 0; i--) {
            if (leaves[i].at > now) continue;
            let last = c.inputDelay - 1;
            while (relayed[last + 1] !== undefined) last++;
            const first = Math.max(c.inputDelay, last - 599);
            peers[leaves[i].to].session.playerLeft(c.leave!.slot, last, first, relayed.slice(first, last + 1));
            leaves.splice(i, 1);
        }
        peers.forEach((peer, slot) => {
            if (tick < (c.startTicks?.[slot] ?? 0)) return;
            if (c.leave && slot === c.leave.slot && tick >= c.leave.tick) return;
            peer.session.step(peer.sample, peer.events);
            const bytes = peer.session.buildPacket();
            const packet = decodeInputPacket(bytes)!;
            packet.inputs.forEach((mask, i) => relay.inputs[slot][packet.first + i] ??= mask);
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
    return Object.assign(peers, { relay });
}

/**
 * A spectator fed what the relay server saw, in batches in a shuffled order
 * (reliable messages can arrive out of order): every frame it simulates must
 * match the players' confirmed state for that frame.
 */
function watch(peers: Peer[] & { relay: Relay }, inputDelay: number): SpectatorSession {
    const { relay } = peers;
    const spectator = new SpectatorSession(relay.inputs.length, inputDelay, createMatch(FIGHTERS.slice(0, relay.inputs.length), 1234));
    const seen = new Map<number, number>();
    spectator.onFrame = (frame, state) => seen.set(frame, matchChecksum(state));
    const batches: { slot: number; first: number; inputs: number[] }[] = [];
    relay.inputs.forEach((inputs, slot) => {
        for (let first = inputDelay; first < inputs.length; first += 97) batches.push({ slot, first, inputs: inputs.slice(first, first + 97) });
    });
    const order = random(11);
    batches.sort(() => order() - 0.5);
    for (const batch of batches) {
        spectator.addInputs(batch.slot, batch.first, batch.inputs);
        while (spectator.step([])) { /* as far as the inputs allow */ }
    }
    for (const { slot, lastFrame } of relay.left) spectator.playerLeft(slot, lastFrame);
    while (spectator.step([])) { /* the rest */ }

    let compared = 0;
    for (const peer of peers) {
        if (!peer.confirmed.size) continue;
        for (const [frame, checksum] of peer.confirmed) {
            const theirs = seen.get(frame);
            if (theirs === undefined) continue;
            assert.equal(theirs, checksum, `the spectator differs from player ${peer.session.slot} at frame ${frame}`);
            compared++;
        }
    }
    assert.ok(compared > 1000, `compared ${compared} frames`);
    return spectator;
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

test('five players agree at 120 ms ping with jitter and 3% loss', () => {
    const peers = play({ players: 5, latencyMs: 60, jitterMs: 15, loss: 0.03, inputDelay: 3, startTicks: [0, 3, 5, 8, 11], ticks: 3600 });
    assertInSync(peers);
    assert.ok(peers.every(p => p.session.frame > 3300), 'nobody fell far behind');
});

test('a player quitting mid-match: the others retire their fighter at the same frame and play on in sync', () => {
    const peers = play({ players: 5, latencyMs: 50, jitterMs: 10, loss: 0.05, inputDelay: 2, ticks: 2400, leave: { slot: 2, tick: 900 } });
    const stayed = peers.filter((_, slot) => slot !== 2);
    assertInSync(stayed);
    for (const { session } of stayed) {
        assert.equal(session.isPlaying(2), false);
        assert.equal(session.match.fighters[2].lives, 0, 'the fighter left the match');
        assert.ok(session.frame > 2000, `carried on to frame ${session.frame}`);
    }
});

test('a spectator fed the relayed inputs sees exactly the players\' match, a player quitting included', () => {
    const peers = play({ players: 4, latencyMs: 50, jitterMs: 10, loss: 0.05, inputDelay: 2, ticks: 2400, leave: { slot: 1, tick: 1000 } });
    const spectator = watch(peers, 2);
    assert.equal(spectator.isPlaying(1), false);
    assert.equal(spectator.match.fighters[1].lives, 0);
    assert.ok(spectator.frame > 2000, `watched ${spectator.frame} frames`);
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
