/**
 * Hashes of simulation state, used to check that two runs of the same match
 * (a recording and its replay, or the two players of an online match) agree.
 */

const scratch = new DataView(new ArrayBuffer(8));

/** FNV-1a over each value's float64 bytes. -0 counts as 0. */
export function hashValues(values: readonly number[]): number {
    let hash = 0x811c9dc5;
    for (const value of values) {
        scratch.setFloat64(0, value === 0 ? 0 : value);
        for (let i = 0; i < 8; i++) {
            hash ^= scratch.getUint8(i);
            hash = Math.imul(hash, 0x01000193);
        }
    }
    return hash >>> 0;
}

/** FNV-1a over a string's UTF-16 code units. */
export function hashString(text: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}
