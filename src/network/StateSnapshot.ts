/**
 * StateSnapshot.ts
 * Serializable game state for rollback netcode
 * 
 * Usage:
 * 1. Each frame, save a snapshot before simulation
 * 2. When misprediction detected, restore snapshot and re-simulate
 */

import type { InputState } from '../input/InputManager';

// Individual player state snapshot
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
    playerState: string; // 'idle', 'jumping', 'attacking', etc.
    isAttacking: boolean;
    animationKey?: string;
    isDodging: boolean;
    isInvincible: boolean;
    lives: number;
}

// Full game state at a specific frame
export interface GameSnapshot {
    frame: number;
    timestamp: number;
    players: PlayerSnapshot[];
}

// Input entry for a specific frame
export interface FrameInput {
    frame: number;
    playerId: number;
    input: InputState;
    confirmed: boolean; // True if server has confirmed this input
}

// Ring buffer for managing snapshots (fixed size, oldest overwritten)
export class SnapshotBuffer {
    private buffer: GameSnapshot[] = [];
    private readonly maxSize: number;

    constructor(maxSize: number = 60) {
        this.maxSize = maxSize;
    }

    push(snapshot: GameSnapshot): void {
        if (this.buffer.length >= this.maxSize) {
            this.buffer.shift(); // Remove oldest
        }
        this.buffer.push(snapshot);
    }

    get(frame: number): GameSnapshot | undefined {
        return this.buffer.find(s => s.frame === frame);
    }

    getLatest(): GameSnapshot | undefined {
        return this.buffer[this.buffer.length - 1];
    }

    // Get all snapshots from startFrame to current
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

// Ring buffer for managing inputs
export class InputBuffer {
    private buffer: Map<number, FrameInput[]> = new Map(); // frame -> inputs for that frame
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
        // Replace if same player, otherwise add
        const existingIdx = inputs.findIndex(i => i.playerId === frameInput.playerId);
        if (existingIdx >= 0) {
            inputs[existingIdx] = frameInput;
        } else {
            inputs.push(frameInput);
        }

        // Cleanup old frames
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
