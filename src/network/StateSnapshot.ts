/**
 * StateSnapshot.ts — Pre-allocated Rollback Ring Buffer
 *
 * Implements an O(1) circular ring buffer that pre-allocates SimBody slots.
 * Zero heap allocations during frame saving, input querying, and rollback rewinding.
 */

import type { InputState } from '../input/InputManager';
import { type SimBody, createBody, copyBody } from '../../shared/PhysicsSimulation';

// Individual player state snapshot (legacy support)
export interface PlayerSnapshot {
    playerId: number;
    x: number;
    y: number;
    velocityX: number;
    velocityY: number;
    isGrounded: boolean;
    jumpsRemaining: number;
    facingDirection: number;
    damagePercent: number;
    playerState: string;
    isAttacking: boolean;
    animationKey?: string;
    isDodging: boolean;
    isInvincible: boolean;
    lives: number;
}

// Full game state at a specific frame (legacy support)
export interface GameSnapshot {
    frame: number;
    timestamp: number;
    players: PlayerSnapshot[];
}

// Input entry for a specific frame (legacy support)
export interface FrameInput {
    frame: number;
    playerId: number;
    input: InputState;
    confirmed: boolean;
}

/**
 * Pre-allocated slot in the Rollback Ring Buffer.
 */
export interface RollbackSlot {
    frame: number;
    localBody: SimBody;
    remoteBody: SimBody;
    localInputMask: number;
    remoteInputMask: number;
    remotePredicted: boolean;
}

/**
 * High-Performance Zero-Allocation Circular Rollback Buffer (GGPO Pattern).
 */
export class RollbackBuffer {
    public readonly capacity: number;
    private slots: RollbackSlot[];

    constructor(capacity: number = 128) {
        this.capacity = capacity;
        this.slots = new Array(capacity);

        // Pre-allocate all slots and SimBody objects
        for (let i = 0; i < capacity; i++) {
            this.slots[i] = {
                frame: -1,
                localBody: createBody(0, 0, 1),
                remoteBody: createBody(0, 0, -1),
                localInputMask: 0,
                remoteInputMask: 0,
                remotePredicted: false,
            };
        }
    }

    /**
     * Save the exact physics state of both players at frame N.
     */
    public saveFrame(
        frame: number,
        localBody: SimBody,
        remoteBody: SimBody,
        localInputMask: number,
        remoteInputMask: number,
        remotePredicted: boolean
    ): void {
        const slot = this.slots[frame % this.capacity];
        slot.frame = frame;
        copyBody(slot.localBody, localBody);
        copyBody(slot.remoteBody, remoteBody);
        slot.localInputMask = localInputMask;
        slot.remoteInputMask = remoteInputMask;
        slot.remotePredicted = remotePredicted;
    }

    /**
     * Get the snapshot for frame N if it exists in the ring buffer.
     */
    public getFrame(frame: number): RollbackSlot | null {
        const slot = this.slots[frame % this.capacity];
        return slot.frame === frame ? slot : null;
    }

    /**
     * Restore both players' SimBody instances from snapshot frame N.
     * Returns true if restored, false if frame has fallen outside the ring buffer.
     */
    public restoreFrame(frame: number, localBodyDst: SimBody, remoteBodyDst: SimBody): boolean {
        const slot = this.getFrame(frame);
        if (!slot) return false;

        copyBody(localBodyDst, slot.localBody);
        copyBody(remoteBodyDst, slot.remoteBody);
        return true;
    }

    /**
     * Record a confirmed remote input for frame N.
     */
    public setConfirmedRemoteInput(frame: number, remoteInputMask: number): void {
        const slot = this.slots[frame % this.capacity];
        if (slot.frame === frame) {
            slot.remoteInputMask = remoteInputMask;
            slot.remotePredicted = false;
        }
    }

    /**
     * Reset the buffer.
     */
    public clear(): void {
        for (let i = 0; i < this.capacity; i++) {
            this.slots[i].frame = -1;
        }
    }
}

// ─── Legacy Buffer Classes (Kept for backwards compatibility) ───

export class SnapshotBuffer {
    private buffer: GameSnapshot[] = [];
    private readonly maxSize: number;

    constructor(maxSize: number = 60) {
        this.maxSize = maxSize;
    }

    push(snapshot: GameSnapshot): void {
        if (this.buffer.length >= this.maxSize) {
            this.buffer.shift();
        }
        this.buffer.push(snapshot);
    }

    get(frame: number): GameSnapshot | undefined {
        return this.buffer.find(s => s.frame === frame);
    }

    getLatest(): GameSnapshot | undefined {
        return this.buffer[this.buffer.length - 1];
    }

    getRange(startFrame: number): GameSnapshot[] {
        return this.buffer.filter(s => s.frame >= startFrame);
    }

    clear(): void {
        this.buffer = [];
    }

    get length(): number {
        return this.buffer.length;
    }
}

export class InputBuffer {
    private buffer: Map<number, FrameInput[]> = new Map();
    private readonly maxFrames: number;

    constructor(maxFrames: number = 120) {
        this.maxFrames = maxFrames;
    }

    addInput(frameInput: FrameInput): void {
        const frame = frameInput.frame;
        if (!this.buffer.has(frame)) {
            this.buffer.set(frame, []);
        }
        const inputs = this.buffer.get(frame)!;
        const existingIdx = inputs.findIndex(i => i.playerId === frameInput.playerId);
        if (existingIdx >= 0) {
            inputs[existingIdx] = frameInput;
        } else {
            inputs.push(frameInput);
        }
        this.cleanup(frame);
    }

    getInputs(frame: number): FrameInput[] {
        return this.buffer.get(frame) || [];
    }

    getInputForPlayer(frame: number, playerId: number): FrameInput | undefined {
        const inputs = this.buffer.get(frame);
        return inputs?.find(i => i.playerId === playerId);
    }

    confirmInput(frame: number, playerId: number): void {
        const input = this.getInputForPlayer(frame, playerId);
        if (input) {
            input.confirmed = true;
        }
    }

    private cleanup(currentFrame: number): void {
        const cutoff = currentFrame - this.maxFrames;
        for (const frame of this.buffer.keys()) {
            if (frame < cutoff) {
                this.buffer.delete(frame);
            }
        }
    }

    clear(): void {
        this.buffer.clear();
    }
}
