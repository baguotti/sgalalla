/**
 * Fixed simulation tick.
 *
 * Gameplay always advances in steps of exactly SIM_STEP_MS, whatever the display
 * refresh rate. The render loop feeds real elapsed time into a FixedStepClock and
 * runs as many steps as are due.
 */

const SIM_TICK_RATE = 60;
export const SIM_STEP_MS = 1000 / SIM_TICK_RATE;

/** Frame time this close to a whole step still counts as one, so a 60 Hz display gets exactly one step per frame. */
const STEP_TOLERANCE_MS = 1;

/** Caps catch-up after a stall (slow frame, background tab) so the game never fast-forwards more than this many steps at once. */
const MAX_STEPS_PER_FRAME = 4;

/** Display refresh rates the learnt frame interval snaps to when within SNAP_SHARE of one. */
const REFRESH_RATES = [60, 75, 90, 100, 120, 144, 165, 240];
const SNAP_SHARE = 0.04;
/** Frame times outside this range (a stall, a hidden tab) don't count toward the learnt interval. */
const MIN_FRAME_MS = 3;
const MAX_FRAME_MS = 50;

/**
 * A simulation timer (ms) after one step. Counting a whole number of steps'
 * worth down leaves float dust behind (200 - 12 x 16.67 is not quite 0), which
 * would stretch the timer by a step; within a millionth of a millisecond of 0
 * counts as 0. Negative values stay: some timers run past 0 on purpose.
 */
export function countDown(timerMs: number, stepMs: number = SIM_STEP_MS): number {
    const left = timerMs - stepMs;
    return Math.abs(left) < 1e-6 ? 0 : left;
}

export class FixedStepClock {
    private accumulatorMs = 0;
    /** Average frame time, from which the display's refresh interval is learnt. */
    private averageFrameMs = SIM_STEP_MS;
    private refreshMs = SIM_STEP_MS;
    /**
     * Real time the whole-frame counting left out. Timestamp noise cancels out
     * in it; what builds up (a display a little off its nominal rate) is added
     * back a frame at a time, so the clock keeps real time.
     */
    private uncountedMs = 0;

    /** Adds the real time elapsed since the last frame and returns how many steps are due now. */
    advance(elapsedMs: number): number {
        this.learnRefreshInterval(elapsedMs);

        // Count whole display frames. Browser frame timestamps are noisy while
        // frames are shown on a steady beat, and counting the noise would move
        // steps between frames at random: judder on screens faster than 60 Hz.
        let countedMs = Math.round(elapsedMs / this.refreshMs) * this.refreshMs;
        this.uncountedMs += elapsedMs - countedMs;
        // Three quarters of a frame, so after adding one the rest is well short of taking one back
        const frame = Math.sign(this.uncountedMs) * this.refreshMs;
        if (Math.abs(this.uncountedMs) >= this.refreshMs * 0.75 && countedMs + frame >= 0) {
            countedMs += frame;
            this.uncountedMs -= frame;
        }
        this.accumulatorMs = Math.min(this.accumulatorMs + countedMs, SIM_STEP_MS * MAX_STEPS_PER_FRAME);

        let steps = 0;
        while (this.accumulatorMs >= SIM_STEP_MS - STEP_TOLERANCE_MS) {
            this.accumulatorMs -= SIM_STEP_MS;
            steps++;
        }
        return steps;
    }

    private learnRefreshInterval(elapsedMs: number): void {
        if (elapsedMs < MIN_FRAME_MS || elapsedMs > MAX_FRAME_MS) return;
        this.averageFrameMs += (elapsedMs - this.averageFrameMs) * 0.1;
        this.refreshMs = this.averageFrameMs;
        for (const rate of REFRESH_RATES) {
            const interval = 1000 / rate;
            if (Math.abs(this.averageFrameMs - interval) < interval * SNAP_SHARE) {
                this.refreshMs = interval;
                return;
            }
        }
    }
}
