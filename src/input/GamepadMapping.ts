/**
 * GamepadMapping — Persistent, user-configurable gamepad button mapping.
 *
 * Supports **per-slot** configs so two gamepads can have independent mappings
 * in local multiplayer ("Botte in Locale").
 *
 * Default layout follows the Brawlhalla Xbox convention:
 *   A(0)=Jump, X(2)=Light, B(1)/Y(3)=Heavy, LT(6)/RT(7)=Dodge, R3(11)=Taunt
 *
 * Mappings are persisted to localStorage under `gamepad_mapping_0` / `gamepad_mapping_1`.
 */

/** The game actions that can be rebound. */
export type GameAction = 'jump' | 'lightAttack' | 'heavyAttack' | 'heavyAttack2' | 'dodge' | 'taunt';

/** Human-readable button names keyed by standard gamepad button index. */
export const BUTTON_NAMES: Record<number, string> = {
    0: 'A',
    1: 'B',
    2: 'X',
    3: 'Y',
    4: 'LB',
    5: 'RB',
    6: 'LT',
    7: 'RT',
    8: 'INDIETRO',
    9: 'START',
    10: 'L3',
    11: 'R3',
    12: 'D-SU',
    13: 'D-GIÙ',
    14: 'D-SINISTRA',
    15: 'D-DESTRA',
};

/** Label shown in the settings UI for each action. */
export const ACTION_LABELS: Record<GameAction, string> = {
    jump: 'SALTO',
    lightAttack: 'ATT. LEGGERO',
    heavyAttack: 'ATT. PESANTE',
    heavyAttack2: 'ATT. PESANTE 2',
    dodge: 'SCHIVATA',
    taunt: 'PROVOCA',
};

export interface GamepadMappingData {
    jump: number;           // button index for jump
    lightAttack: number;    // button index for light attack
    heavyAttack: number;    // primary heavy attack button index
    heavyAttack2: number;   // secondary heavy attack button index
    dodge: number;          // button index for dodge (trigger index — LT or RT, we store one, but both triggers always work)
    taunt: number;          // button index for taunt
    invertY: boolean;       // invert stick/dpad Y axis
}

const DEFAULT_MAPPING: GamepadMappingData = {
    jump: 0,           // A
    lightAttack: 2,    // X
    heavyAttack: 1,    // B
    heavyAttack2: 3,   // Y
    dodge: 6,          // LT  (RT is auto-mirrored in GamepadInput)
    taunt: 11,         // R3
    invertY: false,
};

/** Number of supported mapping slots (one per local gamepad). */
export const MAX_MAPPING_SLOTS = 2;

const STORAGE_KEY_PREFIX = 'gamepad_mapping';
const LEGACY_STORAGE_KEY = 'gamepad_mapping'; // Old single-mapping key for migration

export class GamepadMapping {
    private static instance: GamepadMapping;
    private mappings: GamepadMappingData[];

    private constructor() {
        this.mappings = [];
        for (let i = 0; i < MAX_MAPPING_SLOTS; i++) {
            this.mappings.push({ ...DEFAULT_MAPPING });
        }
        this.load();
    }

    static getInstance(): GamepadMapping {
        if (!GamepadMapping.instance) {
            GamepadMapping.instance = new GamepadMapping();
        }
        return GamepadMapping.instance;
    }

    getMapping(slot: number = 0): GamepadMappingData {
        return { ...this.mappings[this.clampSlot(slot)] };
    }

    getButtonForAction(action: GameAction, slot: number = 0): number {
        return this.mappings[this.clampSlot(slot)][action];
    }

    setButtonForAction(action: GameAction, buttonIndex: number, slot: number = 0): void {
        this.mappings[this.clampSlot(slot)][action] = buttonIndex;
        this.save(slot);
    }

    getInvertY(slot: number = 0): boolean {
        return this.mappings[this.clampSlot(slot)].invertY;
    }

    setInvertY(value: boolean, slot: number = 0): void {
        this.mappings[this.clampSlot(slot)].invertY = value;
        this.save(slot);
    }

    resetDefaults(slot: number = 0): void {
        this.mappings[this.clampSlot(slot)] = { ...DEFAULT_MAPPING };
        this.save(slot);
    }

    private clampSlot(slot: number): number {
        return Math.max(0, Math.min(slot, MAX_MAPPING_SLOTS - 1));
    }

    private save(slot: number = 0): void {
        const s = this.clampSlot(slot);
        try {
            localStorage.setItem(`${STORAGE_KEY_PREFIX}_${s}`, JSON.stringify(this.mappings[s]));
        } catch {
            // localStorage may be unavailable (e.g. private browsing quota)
        }
    }

    private load(): void {
        // Migrate legacy single-key mapping → slot 0
        try {
            const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
            const hasNewFormat = localStorage.getItem(`${STORAGE_KEY_PREFIX}_0`);
            if (legacy && !hasNewFormat) {
                localStorage.setItem(`${STORAGE_KEY_PREFIX}_0`, legacy);
                localStorage.removeItem(LEGACY_STORAGE_KEY);
            }
        } catch {
            // Ignore migration errors
        }

        for (let i = 0; i < MAX_MAPPING_SLOTS; i++) {
            try {
                const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}_${i}`);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    // Merge with defaults to handle schema evolution
                    this.mappings[i] = { ...DEFAULT_MAPPING, ...parsed };
                }
            } catch {
                // Corrupted data — keep defaults
            }
        }
    }
}
