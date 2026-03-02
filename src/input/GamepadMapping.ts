/**
 * GamepadMapping — Persistent, user-configurable gamepad button mapping.
 *
 * Default layout follows the Brawlhalla Xbox convention:
 *   A(0)=Jump, X(2)=Light, B(1)/Y(3)=Heavy, LT(6)/RT(7)=Dodge, R3(11)=Taunt
 *
 * Mappings are persisted to localStorage under `gamepad_mapping`.
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
    8: 'BACK',
    9: 'START',
    10: 'L3',
    11: 'R3',
    12: 'D-UP',
    13: 'D-DOWN',
    14: 'D-LEFT',
    15: 'D-RIGHT',
};

/** Label shown in the settings UI for each action. */
export const ACTION_LABELS: Record<GameAction, string> = {
    jump: 'JUMP',
    lightAttack: 'LIGHT ATTACK',
    heavyAttack: 'HEAVY ATTACK',
    heavyAttack2: 'HEAVY ATK 2',
    dodge: 'DODGE',
    taunt: 'TAUNT',
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

const STORAGE_KEY = 'gamepad_mapping';

export class GamepadMapping {
    private static instance: GamepadMapping;
    private mapping: GamepadMappingData;

    private constructor() {
        this.mapping = { ...DEFAULT_MAPPING };
        this.load();
    }

    static getInstance(): GamepadMapping {
        if (!GamepadMapping.instance) {
            GamepadMapping.instance = new GamepadMapping();
        }
        return GamepadMapping.instance;
    }

    getMapping(): GamepadMappingData {
        return { ...this.mapping };
    }

    getButtonForAction(action: GameAction): number {
        return this.mapping[action];
    }

    setButtonForAction(action: GameAction, buttonIndex: number): void {
        this.mapping[action] = buttonIndex;
        this.save();
    }

    getInvertY(): boolean {
        return this.mapping.invertY;
    }

    setInvertY(value: boolean): void {
        this.mapping.invertY = value;
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
            // localStorage may be unavailable (e.g. private browsing quota)
        }
    }

    private load(): void {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                // Merge with defaults to handle schema evolution
                this.mapping = { ...DEFAULT_MAPPING, ...parsed };
            }
        } catch {
            // Corrupted data — keep defaults
        }
    }
}
