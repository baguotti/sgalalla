/**
 * Unified Input State
 * Combines keyboard and gamepad input into a single interface
 */
export interface InputState {
    // Movement
    moveLeft: boolean;
    moveRight: boolean;
    moveUp: boolean;
    moveDown: boolean;
    moveX: number; // -1 to 1 for analog input
    moveY: number; // -1 to 1 for analog input

    // Actions (single press detection)
    jump: boolean;
    jumpHeld: boolean;
    lightAttack: boolean;
    lightAttackHeld: boolean; // For charge throws
    heavyAttack: boolean;
    heavyAttackHeld: boolean; // For charge attacks
    dodge: boolean;
    dodgeHeld: boolean; // For running (dodge key held)
    recovery: boolean;

    // Directional input for attacks
    aimUp: boolean;
    aimDown: boolean;
    aimLeft: boolean;
    aimRight: boolean;

    // Input source
    usingGamepad: boolean;

    // Reconciliation
    sequence?: number;
}
