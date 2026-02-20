/**
 * Binary Codec for Network Packets
 * Reduces packet size from ~200 bytes (JSON) to ~15 bytes
 */

import type { NetPlayerState } from './NetworkManager';

// Animation key enum for 1-byte encoding
export const ANIMATION_KEYS = [
    '',           // 0 - empty/idle
    'idle',       // 1
    'run',        // 2
    'jump',       // 3
    'fall',       // 4
    'attack_light', // 5
    'attack_heavy', // 6
    'attack_up',  // 7
    'hurt',       // 8
    'slide',      // 9
    'dash',       // 10
    'block',      // 11
    'charge',     // 12
    'spot_dodge', // 13
] as const;

const animKeyToIndex = new Map<string, number>();
ANIMATION_KEYS.forEach((key, i) => animKeyToIndex.set(key, i));

/**
 * Encode NetPlayerState to compact binary (15 bytes)
 * Format:
 * [0]    playerId (uint8)
 * [1-2]  x * 10 (int16)
 * [3-4]  y * 10 (int16)
 * [5-6]  velocityX * 10 (int16)
 * [7-8]  velocityY * 10 (int16)
 * [9]    facingDirection (int8: -1 or 1)
 * [10]   flags (uint8: bit0=isGrounded, bit1=isAttacking)
 * [11]   animationKey index (uint8)
 * [12-13] damagePercent (uint16)
 * [14]   lives (uint8)
 */
export function encodePlayerState(state: NetPlayerState): ArrayBuffer {
    const buffer = new ArrayBuffer(15);
    const view = new DataView(buffer);

    view.setUint8(0, state.playerId);
    view.setInt16(1, Math.round(state.x * 10), true);
    view.setInt16(3, Math.round(state.y * 10), true);
    view.setInt16(5, Math.round(state.velocityX * 10), true);
    view.setInt16(7, Math.round(state.velocityY * 10), true);
    view.setInt8(9, state.facingDirection);

    let flags = 0;
    if (state.isGrounded) flags |= 0x01;
    if (state.isAttacking) flags |= 0x02;
    view.setUint8(10, flags);

    const animIndex = animKeyToIndex.get(state.animationKey || '') ?? 0;
    view.setUint8(11, animIndex);

    view.setUint16(12, Math.round(state.damagePercent), true);
    view.setUint8(14, state.lives);

    return buffer;
}

/**
 * Decode binary buffer back to NetPlayerState
 */
export function decodePlayerState(buffer: ArrayBuffer): NetPlayerState {
    const view = new DataView(buffer);

    const flags = view.getUint8(10);
    const animIndex = view.getUint8(11);

    return {
        playerId: view.getUint8(0),
        x: view.getInt16(1, true) / 10,
        y: view.getInt16(3, true) / 10,
        velocityX: view.getInt16(5, true) / 10,
        velocityY: view.getInt16(7, true) / 10,
        facingDirection: view.getInt8(9),
        isGrounded: (flags & 0x01) !== 0,
        isAttacking: (flags & 0x02) !== 0,
        animationKey: ANIMATION_KEYS[animIndex] || '',
        damagePercent: view.getUint16(12, true),
        lives: view.getUint8(14),
    };
}

/**
 * Delta compression helper - check if state changed enough to send
 */
export function shouldSendState(current: NetPlayerState, last: NetPlayerState | null): boolean {
    if (!last) return true;

    // Position delta threshold (2 pixels)
    const dx = Math.abs(current.x - last.x);
    const dy = Math.abs(current.y - last.y);
    if (dx > 2 || dy > 2) return true;

    // Velocity change
    if (Math.abs(current.velocityX - last.velocityX) > 1) return true;
    if (Math.abs(current.velocityY - last.velocityY) > 1) return true;

    // State changes (always send)
    if (current.animationKey !== last.animationKey) return true;
    if (current.isAttacking !== last.isAttacking) return true;
    if (current.isGrounded !== last.isGrounded) return true;
    if (current.lives !== last.lives) return true;
    if (Math.abs(current.damagePercent - last.damagePercent) > 0.5) return true;

    return false;
}
