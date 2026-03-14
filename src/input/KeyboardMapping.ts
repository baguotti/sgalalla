/**
 * KeyboardMapping — Persistent, user-configurable keyboard key mapping.
 *
 * Default layout (Brawlhalla-style):
 *   WASD = Move, Space = Jump, J = Light, K = Heavy, L = Dodge, P = Taunt, Shift = Recovery
 *
 * Mappings are persisted to localStorage under `keyboard_mapping`.
 */

/** The keyboard actions that can be rebound. */
export type KeyboardAction = 'moveUp' | 'moveDown' | 'moveLeft' | 'moveRight' | 'jump' | 'lightAttack' | 'heavyAttack' | 'dodge' | 'taunt' | 'recovery' | 'defeat';

/** Human-readable labels for the settings UI. */
export const KB_ACTION_LABELS: Record<KeyboardAction, string> = {
    moveUp: 'MUOVI SU',
    moveDown: 'MUOVI GIÙ',
    moveLeft: 'MUOVI SINISTRA',
    moveRight: 'MUOVI DESTRA',
    jump: 'SALTA',
    lightAttack: 'ATTACCO LEGGERO',
    heavyAttack: 'ATTACCO PESANTE',
    dodge: 'SCHIVATA',
    taunt: 'PROVOCA',
    recovery: 'RECOVERY',
    defeat: 'SCONFITTA',
};

export interface KeyboardMappingData {
    moveUp: string;
    moveDown: string;
    moveLeft: string;
    moveRight: string;
    jump: string;
    lightAttack: string;
    heavyAttack: string;
    dodge: string;
    taunt: string;
    recovery: string;
    defeat: string;
}

const DEFAULT_MAPPING: KeyboardMappingData = {
    moveUp: 'KeyW',
    moveDown: 'KeyS',
    moveLeft: 'KeyA',
    moveRight: 'KeyD',
    jump: 'Space',
    lightAttack: 'KeyJ',
    heavyAttack: 'KeyK',
    dodge: 'KeyL',
    taunt: 'KeyP',
    recovery: 'ShiftLeft',
    defeat: 'KeyO',
};

/** Convert a KeyboardEvent.code to a short display name. */
export function keyCodeToLabel(code: string): string {
    // Letters
    if (code.startsWith('Key')) return code.slice(3);
    // Digits
    if (code.startsWith('Digit')) return code.slice(5);
    // Arrows
    if (code === 'ArrowUp') return '↑';
    if (code === 'ArrowDown') return '↓';
    if (code === 'ArrowLeft') return '←';
    if (code === 'ArrowRight') return '→';
    // Common
    const NAMES: Record<string, string> = {
        Space: 'SPAZIO',
        ShiftLeft: 'L-SHIFT',
        ShiftRight: 'R-SHIFT',
        ControlLeft: 'L-CTRL',
        ControlRight: 'R-CTRL',
        AltLeft: 'L-ALT',
        AltRight: 'R-ALT',
        Enter: 'INVIO',
        Backspace: 'INDIETRO',
        Tab: 'TAB',
        CapsLock: 'MAIUSC',
        Comma: ',',
        Period: '.',
        Slash: '/',
        Semicolon: ';',
        Quote: "'",
        BracketLeft: '[',
        BracketRight: ']',
        Backslash: '\\',
        Minus: '-',
        Equal: '=',
    };
    return NAMES[code] || code;
}

const STORAGE_KEY = 'keyboard_mapping';

export class KeyboardMapping {
    private static instance: KeyboardMapping;
    private mapping: KeyboardMappingData;

    private constructor() {
        this.mapping = { ...DEFAULT_MAPPING };
        this.load();
    }

    static getInstance(): KeyboardMapping {
        if (!KeyboardMapping.instance) {
            KeyboardMapping.instance = new KeyboardMapping();
        }
        return KeyboardMapping.instance;
    }

    getMapping(): KeyboardMappingData {
        return { ...this.mapping };
    }

    getKeyForAction(action: KeyboardAction): string {
        return this.mapping[action];
    }

    setKeyForAction(action: KeyboardAction, code: string): void {
        this.mapping[action] = code;
        this.save();
    }

    resetDefaults(): void {
        this.mapping = { ...DEFAULT_MAPPING };
        this.save();
    }

    private save(): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.mapping));
        } catch {
            // localStorage may be unavailable
        }
    }

    private load(): void {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                this.mapping = { ...DEFAULT_MAPPING, ...parsed };
            }
        } catch {
            // Corrupted data — keep defaults
        }
    }
}
