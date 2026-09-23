/**
 * NetworkProtocol.ts — Shared Binary Protocol for Low-Latency Rollback Networking
 *
 * Encodes player inputs as a 16-bit bitmask.
 * Redundant input packet format (10 bytes total) protects against UDP packet loss:
 *   [0-3] Frame number (uint32)
 *   [4-5] Input mask for Frame N (uint16)
 *   [6-7] Input mask for Frame N - 1 (uint16)
 *   [8-9] Input mask for Frame N - 2 (uint16)
 */

import type { SimInput } from './PhysicsSimulation.js';

export const INPUT_BITS = {
    MOVE_LEFT: 1 << 0,          // 1
    MOVE_RIGHT: 1 << 1,         // 2
    MOVE_UP: 1 << 2,            // 4
    MOVE_DOWN: 1 << 3,          // 8
    JUMP_BUFFERED: 1 << 4,      // 16
    JUMP_HELD: 1 << 5,          // 32
    LIGHT_ATTACK: 1 << 6,       // 64
    LIGHT_ATTACK_HELD: 1 << 7,  // 128
    HEAVY_ATTACK: 1 << 8,       // 256
    HEAVY_ATTACK_HELD: 1 << 9,  // 512
    DODGE_BUFFERED: 1 << 10,    // 1024
    DODGE_HELD: 1 << 11,        // 2048
    AIM_UP: 1 << 12,            // 4096
    AIM_DOWN: 1 << 13,          // 8192
    RECOVERY: 1 << 14,          // 16384
    TAUNT: 1 << 15,             // 32768
} as const;

export interface FullPlayerInput {
    // Movement
    moveLeft: boolean;
    moveRight: boolean;
    moveUp: boolean;
    moveDown: boolean;
    // Jump
    jumpBuffered: boolean;
    jumpHeld: boolean;
    // Attacks
    lightAttack: boolean;
    lightAttackHeld: boolean;
    heavyAttack: boolean;
    heavyAttackHeld: boolean;
    // Defense
    dodgeBuffered: boolean;
    dodgeHeld: boolean;
    // Direction & Special
    aimUp: boolean;
    aimDown: boolean;
    recoveryRequested: boolean;
    taunt: boolean;
}

export const EMPTY_PLAYER_INPUT: FullPlayerInput = {
    moveLeft: false,
    moveRight: false,
    moveUp: false,
    moveDown: false,
    jumpBuffered: false,
    jumpHeld: false,
    lightAttack: false,
    lightAttackHeld: false,
    heavyAttack: false,
    heavyAttackHeld: false,
    dodgeBuffered: false,
    dodgeHeld: false,
    aimUp: false,
    aimDown: false,
    recoveryRequested: false,
    taunt: false,
};

/**
 * Fast, branchless bitmask encoder (converts full input to uint16).
 */
export function encodeInputMask(input: FullPlayerInput): number {
    let mask = 0;
    if (input.moveLeft) mask |= INPUT_BITS.MOVE_LEFT;
    if (input.moveRight) mask |= INPUT_BITS.MOVE_RIGHT;
    if (input.moveUp) mask |= INPUT_BITS.MOVE_UP;
    if (input.moveDown) mask |= INPUT_BITS.MOVE_DOWN;
    if (input.jumpBuffered) mask |= INPUT_BITS.JUMP_BUFFERED;
    if (input.jumpHeld) mask |= INPUT_BITS.JUMP_HELD;
    if (input.lightAttack) mask |= INPUT_BITS.LIGHT_ATTACK;
    if (input.lightAttackHeld) mask |= INPUT_BITS.LIGHT_ATTACK_HELD;
    if (input.heavyAttack) mask |= INPUT_BITS.HEAVY_ATTACK;
    if (input.heavyAttackHeld) mask |= INPUT_BITS.HEAVY_ATTACK_HELD;
    if (input.dodgeBuffered) mask |= INPUT_BITS.DODGE_BUFFERED;
    if (input.dodgeHeld) mask |= INPUT_BITS.DODGE_HELD;
    if (input.aimUp) mask |= INPUT_BITS.AIM_UP;
    if (input.aimDown) mask |= INPUT_BITS.AIM_DOWN;
    if (input.recoveryRequested) mask |= INPUT_BITS.RECOVERY;
    if (input.taunt) mask |= INPUT_BITS.TAUNT;
    return mask;
}

/**
 * Decode 16-bit mask to FullPlayerInput without allocating a new object if dst is provided.
 */
export function decodeInputMask(mask: number, dst?: FullPlayerInput): FullPlayerInput {
    const target = dst || { ...EMPTY_PLAYER_INPUT };
    target.moveLeft = (mask & INPUT_BITS.MOVE_LEFT) !== 0;
    target.moveRight = (mask & INPUT_BITS.MOVE_RIGHT) !== 0;
    target.moveUp = (mask & INPUT_BITS.MOVE_UP) !== 0;
    target.moveDown = (mask & INPUT_BITS.MOVE_DOWN) !== 0;
    target.jumpBuffered = (mask & INPUT_BITS.JUMP_BUFFERED) !== 0;
    target.jumpHeld = (mask & INPUT_BITS.JUMP_HELD) !== 0;
    target.lightAttack = (mask & INPUT_BITS.LIGHT_ATTACK) !== 0;
    target.lightAttackHeld = (mask & INPUT_BITS.LIGHT_ATTACK_HELD) !== 0;
    target.heavyAttack = (mask & INPUT_BITS.HEAVY_ATTACK) !== 0;
    target.heavyAttackHeld = (mask & INPUT_BITS.HEAVY_ATTACK_HELD) !== 0;
    target.dodgeBuffered = (mask & INPUT_BITS.DODGE_BUFFERED) !== 0;
    target.dodgeHeld = (mask & INPUT_BITS.DODGE_HELD) !== 0;
    target.aimUp = (mask & INPUT_BITS.AIM_UP) !== 0;
    target.aimDown = (mask & INPUT_BITS.AIM_DOWN) !== 0;
    target.recoveryRequested = (mask & INPUT_BITS.RECOVERY) !== 0;
    target.taunt = (mask & INPUT_BITS.TAUNT) !== 0;
    return target;
}

/**
 * Convert FullPlayerInput to SimInput for PhysicsSimulation.
 */
export function toSimInput(input: FullPlayerInput, dst?: SimInput): SimInput {
    if (dst) {
        dst.moveLeft = input.moveLeft;
        dst.moveRight = input.moveRight;
        dst.moveDown = input.moveDown;
        dst.moveUp = input.moveUp;
        dst.jumpBuffered = input.jumpBuffered;
        dst.jumpHeld = input.jumpHeld;
        dst.dodgeBuffered = input.dodgeBuffered;
        dst.aimUp = input.aimUp;
        dst.aimDown = input.aimDown;
        dst.recoveryRequested = input.recoveryRequested;
        return dst;
    }
    return {
        moveLeft: input.moveLeft,
        moveRight: input.moveRight,
        moveDown: input.moveDown,
        moveUp: input.moveUp,
        jumpBuffered: input.jumpBuffered,
        jumpHeld: input.jumpHeld,
        dodgeBuffered: input.dodgeBuffered,
        aimUp: input.aimUp,
        aimDown: input.aimDown,
        recoveryRequested: input.recoveryRequested,
    };
}

/**
 * Encode a redundant 10-byte UDP packet for Frame N.
 */
export function encodeInputPacket(frame: number, maskN: number, maskN1: number = 0, maskN2: number = 0): ArrayBuffer {
    const buffer = new ArrayBuffer(10);
    const view = new DataView(buffer);
    view.setUint32(0, frame, true);
    view.setUint16(4, maskN, true);
    view.setUint16(6, maskN1, true);
    view.setUint16(8, maskN2, true);
    return buffer;
}

/**
 * Decode a 10-byte UDP packet.
 */
export function decodeInputPacket(buffer: ArrayBuffer): { frame: number; maskN: number; maskN1: number; maskN2: number } | null {
    if (buffer.byteLength < 6) return null;
    const view = new DataView(buffer);
    const frame = view.getUint32(0, true);
    const maskN = view.getUint16(4, true);
    const maskN1 = buffer.byteLength >= 8 ? view.getUint16(6, true) : 0;
    const maskN2 = buffer.byteLength >= 10 ? view.getUint16(8, true) : 0;
    return { frame, maskN, maskN1, maskN2 };
}
