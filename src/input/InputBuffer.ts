/**
 * InputBuffer — Stores recent button presses for a configurable window.
 *
 * Fighting games use input buffering to make controls feel responsive.
 * If a player presses "Jump" 2 frames before their attack ends,
 * the buffer holds that input so the jump executes immediately after.
 *
 * Usage:
 *   buffer.update(rawInput);           // Call once per frame with fresh input
 *   if (buffer.consumeJump()) { ... }  // Consume buffered jump (removes it)
 */

export type BufferableAction = 'jump' | 'lightAttack' | 'heavyAttack' | 'dodge' | 'recovery';

interface BufferedInput {
    action: BufferableAction;
    frame: number;
}

export class InputBuffer {
    /** How long (in frames) a buffered input stays valid */
    private readonly BUFFER_WINDOW_FRAMES: number;

    /** The queue of buffered inputs */
    private buffer: BufferedInput[] = [];

    /** Current frame tracker */
    private currentFrame: number = 0;

    constructor(bufferWindowFrames: number = 6) { // 6 frames @ 60fps ~= 100ms
        this.BUFFER_WINDOW_FRAMES = bufferWindowFrames;
    }

    /**
     * Call once per frame. Records any new single-press actions
     * and purges expired entries.
     */
    update(input: {
        jump: boolean;
        lightAttack: boolean;
        heavyAttack: boolean;
        dodge: boolean;
        recovery: boolean;
    }): void {
        this.currentFrame++;

        // Record new presses
        if (input.jump) this.record('jump');
        if (input.lightAttack) this.record('lightAttack');
        if (input.heavyAttack) this.record('heavyAttack');
        if (input.dodge) this.record('dodge');
        if (input.recovery) this.record('recovery');

        // Purge expired entries
        this.buffer = this.buffer.filter(
            entry => (this.currentFrame - entry.frame) <= this.BUFFER_WINDOW_FRAMES
        );
    }

    /**
     * Record a new action press.
     * Avoids duplicate entries for the same action within 1 frame.
     */
    private record(action: BufferableAction): void {
        // Don't double-buffer the same action on the same frame
        const existingIdx = this.buffer.findIndex(
            e => e.action === action && e.frame === this.currentFrame
        );
        if (existingIdx >= 0) return;

        this.buffer.push({ action, frame: this.currentFrame });
    }

    /**
     * Check if an action was recently pressed (within the buffer window).
     * Does NOT consume the input — use `consume()` to remove it.
     */
    has(action: BufferableAction): boolean {
        return this.buffer.some(
            e => e.action === action && (this.currentFrame - e.frame) <= this.BUFFER_WINDOW_FRAMES
        );
    }

    /**
     * Check and consume a buffered action.
     * Returns true if the action was buffered (and removes it).
     * Returns false if no buffered input exists.
     */
    consume(action: BufferableAction): boolean {
        const idx = this.buffer.findIndex(
            e => e.action === action && (this.currentFrame - e.frame) <= this.BUFFER_WINDOW_FRAMES
        );
        if (idx >= 0) {
            this.buffer.splice(idx, 1);
            return true;
        }
        return false;
    }

    /**
     * Consume jump specifically — convenience method.
     */
    consumeJump(): boolean {
        return this.consume('jump');
    }

    /**
     * Consume light attack specifically — convenience method.
     */
    consumeLightAttack(): boolean {
        return this.consume('lightAttack');
    }

    /**
     * Consume heavy attack specifically — convenience method.
     */
    consumeHeavyAttack(): boolean {
        return this.consume('heavyAttack');
    }

    /**
     * Consume dodge specifically — convenience method.
     */
    consumeDodge(): boolean {
        return this.consume('dodge');
    }

    /**
     * Clear all buffered inputs (e.g., on death or state reset).
     */
    clear(): void {
        this.buffer = [];
    }
}
