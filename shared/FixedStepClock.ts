/**
 * Fixed simulation tick.
 *
 * Gameplay always advances in steps of exactly SIM_STEP_MS, whatever the display
 * refresh rate. The render loop feeds real elapsed time into a FixedStepClock and
 * runs as many steps as are due.
 */

const SIM_TICK_RATE = 60;
export const SIM_STEP_MS = 1000 / SIM_TICK_RATE;

/** Frame time this close to a whole step still counts as one, so a 60 Hz display gets exactly one step per frame despite timer jitter. */
const STEP_TOLERANCE_MS = 1;

/** Caps catch-up after a stall (slow frame, background tab) so the game never fast-forwards more than this many steps at once. */
const MAX_STEPS_PER_FRAME = 4;

export class FixedStepClock {
    private accumulatorMs = 0;

    /** Adds the real time elapsed since the last frame and returns how many steps are due now. */
    advance(elapsedMs: number): number {
        this.accumulatorMs = Math.min(this.accumulatorMs + elapsedMs, SIM_STEP_MS * MAX_STEPS_PER_FRAME);

        let steps = 0;
        while (this.accumulatorMs >= SIM_STEP_MS - STEP_TOLERANCE_MS) {
            this.accumulatorMs -= SIM_STEP_MS;
            steps++;
        }
        return steps;
    }
}
