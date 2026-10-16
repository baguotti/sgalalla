/** Uniform integer in [min, max] from a match's seeded generator (mulberry32), advancing it. */
export function randomInt(state: { rng: number }, min: number, max: number): number {
    const a = state.rng = (state.rng + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return min + ((t ^ (t >>> 14)) >>> 0) % (max - min + 1);
}
