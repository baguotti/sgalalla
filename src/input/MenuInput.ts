import Phaser from 'phaser';
import { getBackButtonIndex, getConfirmButtonIndex, getMenuNavX, getMenuNavY } from './JoyConMapper';

/**
 * One way for every menu to read the keyboard and all gamepads as menu
 * actions. Poll once per frame and act on what comes back.
 *
 * - Buttons count when they go down; one still held from the previous screen
 *   doesn't count until it's let go.
 * - Holding a direction moves once, then repeats after a pause.
 * - Joy-Cons held sideways, and controllers whose confirm is B, are handled
 *   (see JoyConMapper).
 */

export type MenuAction = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back' | 'start';

export interface MenuPress {
    action: MenuAction;
    /** The gamepad's index, or null for the keyboard. */
    pad: number | null;
}

/** A held direction repeats after this long, then this often. */
const REPEAT_DELAY_MS = 350;
const REPEAT_EVERY_MS = 110;
/** The standard gamepad's Start button. */
const START_BUTTON = 9;

const KEYS: Record<Exclude<MenuAction, 'start'>, readonly number[]> = {
    up: [Phaser.Input.Keyboard.KeyCodes.UP, Phaser.Input.Keyboard.KeyCodes.W],
    down: [Phaser.Input.Keyboard.KeyCodes.DOWN, Phaser.Input.Keyboard.KeyCodes.S],
    left: [Phaser.Input.Keyboard.KeyCodes.LEFT, Phaser.Input.Keyboard.KeyCodes.A],
    right: [Phaser.Input.Keyboard.KeyCodes.RIGHT, Phaser.Input.Keyboard.KeyCodes.D],
    confirm: [Phaser.Input.Keyboard.KeyCodes.ENTER, Phaser.Input.Keyboard.KeyCodes.SPACE],
    back: [Phaser.Input.Keyboard.KeyCodes.ESC, Phaser.Input.Keyboard.KeyCodes.BACKSPACE],
};

/** One keyboard or gamepad: what it held last frame, and its held direction's repeat clock. */
interface Source {
    held: Set<MenuAction>;
    /** When the held direction on each axis started, and when it last fired. */
    repeat: Record<'x' | 'y', { dir: number; nextAt: number }>;
}

export class MenuInput {
    private readonly scene: Phaser.Scene;
    private readonly keys: Map<MenuAction, Phaser.Input.Keyboard.Key[]> = new Map();
    private readonly sources = new Map<number | null, Source>();

    /** `keyboard: false` for menus that read the keyboard their own way (text entry, key rebinding). */
    constructor(scene: Phaser.Scene, options: { keyboard?: boolean } = {}) {
        this.scene = scene;
        const keyboard = scene.input.keyboard;
        if (keyboard && options.keyboard !== false) {
            for (const [action, codes] of Object.entries(KEYS) as [MenuAction, readonly number[]][]) {
                this.keys.set(action, codes.map(code => keyboard.addKey(code, false)));
            }
        }
        this.holdEverything();
        scene.events.once('shutdown', () => fixSparseGamepads(scene));
    }

    /**
     * Whatever is held right now waits to be let go before it counts: call when
     * a menu or a sub-menu opens, so the press that opened it doesn't also act on it.
     */
    holdEverything(): void {
        this.sources.clear();
        this.read(this.scene.time.now, true);
    }

    /** What was pressed since the last poll, in order. */
    poll(): MenuPress[] {
        return this.read(this.scene.time.now, false);
    }

    private read(now: number, quiet: boolean): MenuPress[] {
        const presses: MenuPress[] = [];
        if (this.keys.size > 0) {
            const down = new Set<MenuAction>();
            for (const [action, keys] of this.keys) {
                if (keys.some(key => key.isDown)) down.add(action);
            }
            this.update(null, down, now, quiet, presses);
        }
        for (const pad of navigator.getGamepads()) {
            if (!pad) continue;
            this.update(pad.index, padActions(pad), now, quiet, presses);
        }
        return presses;
    }

    /** Presses from one source: buttons as they go down, directions with repeat. */
    private update(id: number | null, down: Set<MenuAction>, now: number, quiet: boolean, presses: MenuPress[]): void {
        let source = this.sources.get(id);
        const firstLook = !source;
        if (!source) {
            source = { held: new Set(), repeat: { x: { dir: 0, nextAt: 0 }, y: { dir: 0, nextAt: 0 } } };
            this.sources.set(id, source);
        }
        // A pad seen for the first time mid-menu: its held buttons wait too
        const silent = quiet || firstLook;

        for (const action of ['confirm', 'back', 'start'] as const) {
            if (down.has(action) && !source.held.has(action) && !silent) presses.push({ action, pad: id });
        }
        for (const [axis, negative, positive] of [['x', 'left', 'right'], ['y', 'up', 'down']] as const) {
            const dir = down.has(negative) ? -1 : down.has(positive) ? 1 : 0;
            const repeat = source.repeat[axis];
            if (dir === 0) {
                repeat.dir = 0;
            } else if (dir !== repeat.dir) {
                repeat.dir = dir;
                if (silent) {
                    // Held from before: nothing until it's let go
                    repeat.nextAt = Infinity;
                } else {
                    repeat.nextAt = now + REPEAT_DELAY_MS;
                    presses.push({ action: dir < 0 ? negative : positive, pad: id });
                }
            } else if (now >= repeat.nextAt) {
                repeat.nextAt = now + REPEAT_EVERY_MS;
                presses.push({ action: dir < 0 ? negative : positive, pad: id });
            }
        }
        source.held = down;
    }
}

/** The menu actions a gamepad is holding. */
function padActions(pad: Gamepad): Set<MenuAction> {
    const down = new Set<MenuAction>();
    const x = getMenuNavX(pad);
    const y = getMenuNavY(pad);
    if (x < 0) down.add('left');
    if (x > 0) down.add('right');
    if (y < 0) down.add('up');
    if (y > 0) down.add('down');
    if (pad.buttons[getConfirmButtonIndex(pad)]?.pressed) down.add('confirm');
    if (pad.buttons[getBackButtonIndex(pad)]?.pressed) down.add('back');
    if (pad.buttons[START_BUTTON]?.pressed) down.add('start');
    return down;
}

/**
 * Phaser's gamepad plugin crashes stopping its listeners when its pad list
 * has gaps (pad 1 connected without pad 0); closing the gaps on shutdown avoids it.
 */
export function fixSparseGamepads(scene: Phaser.Scene): void {
    const plugin = scene.input.gamepad;
    if (plugin && Array.isArray(plugin.gamepads)) {
        plugin.gamepads = plugin.gamepads.filter(pad => !!pad);
    }
}
