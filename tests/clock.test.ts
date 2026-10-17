import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FixedStepClock, ONLINE_BACKLOG_STEPS, SIM_STEP_MS } from '../shared/FixedStepClock.ts';

test('a stalled frame drops the time it lost, but online it is caught up over the next frames, 4 steps at most', () => {
    const local = new FixedStepClock();
    const online = new FixedStepClock(ONLINE_BACKLOG_STEPS);
    for (const clock of [local, online]) for (let i = 0; i < 30; i++) assert.equal(clock.advance(SIM_STEP_MS), 1);
    // A 200 ms frame: 12 steps due
    const frames = (clock: FixedStepClock) => [clock.advance(200), ...[0, 1, 2, 3].map(() => clock.advance(SIM_STEP_MS))];
    assert.deepEqual(frames(local), [4, 1, 1, 1, 1]);
    assert.deepEqual(frames(online), [4, 4, 4, 3, 1]);
});
