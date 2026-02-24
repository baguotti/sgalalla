/**
 * JoyConMapper — Centralized detection and remapping for individual Joy-Cons held sideways.
 *
 * When a single Joy-Con is connected via Bluetooth, the browser sees it as an independent
 * gamepad. Held sideways, the stick axes are rotated 90° and the face buttons act as a D-pad.
 * This module provides utilities to normalize those inputs so the rest of the codebase
 * can treat a sideways Joy-Con identically to any other controller.
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  Sideways Left Joy-Con        │  Sideways Right Joy-Con             │
 * │  ← (down on stick = left)     │  ← (up on stick = left)            │
 * │  → (up on stick = right)      │  → (down on stick = right)         │
 * │  SL (4) = Dodge               │  SL (4) = Dodge                    │
 * │  SR (5) = Heavy Attack        │  SR (5) = Heavy Attack             │
 * │  Top face btn  = Jump (A)     │  Top face btn  = Jump (A)          │
 * │  Left face btn = Light Atk    │  Left face btn = Light Atk         │
 * └──────────────────────────────────────────────────────────────────────┘
 */

// ─── Detection ───

/** True if the gamepad id indicates a Nintendo Switch controller (Pro, paired, or single Joy-Con). */
export function isSwitchController(id: string): boolean {
    const lower = id.toLowerCase();
    return lower.includes('nintendo') ||
        lower.includes('switch') ||
        lower.includes('pro controller') ||
        lower.includes('joy-con');
}

/** True if the gamepad is a SINGLE left Joy-Con (not a paired set). */
export function isLeftJoyCon(id: string): boolean {
    return id.toLowerCase().includes('joy-con (l)') ||
        id.toLowerCase().includes('joy-con l');
}

/** True if the gamepad is a SINGLE right Joy-Con (not a paired set). */
export function isRightJoyCon(id: string): boolean {
    return id.toLowerCase().includes('joy-con (r)') ||
        id.toLowerCase().includes('joy-con r');
}

/** True if the gamepad is an individual Joy-Con (left or right). */
export function isSingleJoyCon(id: string): boolean {
    return isLeftJoyCon(id) || isRightJoyCon(id);
}

// ─── Axis Remapping ───

/**
 * Returns the movement axes for the gamepad, accounting for sideways Joy-Con rotation.
 *
 * - Left Joy-Con sideways: physical stick rotated 90° CW → swap and negate
 * - Right Joy-Con sideways: physical stick rotated 90° CCW → swap and negate
 * - Pro Controller / paired: passthrough
 */
export function getMovementAxes(gamepad: Gamepad): { moveX: number; moveY: number } {
    const rawX = gamepad.axes[0] || 0;
    const rawY = gamepad.axes[1] || 0;

    if (isLeftJoyCon(gamepad.id)) {
        // Left Joy-Con held sideways (SL/SR on top):
        // physical "up" on stick → rawY negative → we want moveRight (positive X)
        // physical "right" on stick → rawX positive → we want moveDown (positive Y)
        return { moveX: -rawY, moveY: rawX };
    }

    if (isRightJoyCon(gamepad.id)) {
        // Right Joy-Con held sideways (SL/SR on top):
        // physical "up" on stick → rawY negative → we want moveLeft (negative X)
        // physical "right" on stick → rawX positive → we want moveUp (negative Y)
        return { moveX: rawY, moveY: -rawX };
    }

    // Standard controller or paired Joy-Cons
    return { moveX: rawX, moveY: rawY };
}

// ─── Button Mapping ───

/**
 * Normalized button results for Brawlhalla-style controls.
 * These are the raw pressed states, NOT edge-detected.
 */
export interface NormalizedButtons {
    jump: boolean;
    lightAttack: boolean;
    heavyAttack: boolean;
    dodge: boolean;
    pause: boolean;
    taunt: boolean;
    dpadUp: boolean;
    dpadDown: boolean;
    dpadLeft: boolean;
    dpadRight: boolean;
}

/**
 * Returns normalized button states from the gamepad.
 *
 * For individual Joy-Cons held sideways, the face buttons are remapped:
 *   - Top face button → Jump (A)
 *   - Left face button → Light Attack (X)
 *   - SL (rail button) → Dodge
 *   - SR (rail button) → Heavy Attack
 *
 * For Pro Controllers / paired Joy-Cons, the existing A/B X/Y swap logic is applied.
 */
export function getNormalizedButtons(gamepad: Gamepad): NormalizedButtons {
    const btn = (i: number) => gamepad.buttons[i]?.pressed || false;

    if (isLeftJoyCon(gamepad.id)) {
        // Left Joy-Con sideways mapping:
        // Button 0 = physical Down (originally Left on vertical) → not used for action
        // Button 1 = physical Right (originally Down on vertical) → not used for action
        // Button 2 = physical Up (originally Right on vertical) → Jump
        // Button 3 = physical Left (originally Up on vertical) → Light Attack
        // Button 4 = SL → Dodge
        // Button 5 = SR → Heavy Attack
        // Button 8 = Minus → Pause
        // Button 10 = Stick Click → Taunt
        // D-pad from face buttons (held sideways):
        // Physical Up = btn 2, Down = btn 0, Left = btn 3, Right = btn 1
        return {
            jump: btn(2),        // top face button
            lightAttack: btn(3), // left face button
            heavyAttack: btn(5), // SR
            dodge: btn(4),       // SL
            pause: btn(8),       // Minus
            taunt: btn(10),      // Stick click
            dpadUp: btn(2),
            dpadDown: btn(0),
            dpadLeft: btn(3),
            dpadRight: btn(1),
        };
    }

    if (isRightJoyCon(gamepad.id)) {
        // Right Joy-Con sideways mapping:
        // Button 0 = physical A (top when sideways) → Jump
        // Button 1 = physical X (left when sideways) → Light Attack
        // Button 2 = physical B (right when sideways) → not primary
        // Button 3 = physical Y (bottom when sideways) → not primary
        // Button 4 = SL → Dodge
        // Button 5 = SR → Heavy Attack
        // Button 9 = Plus → Pause
        // Button 11 = Stick Click → Taunt
        return {
            jump: btn(0),        // physical A = top
            lightAttack: btn(1), // physical X = left
            heavyAttack: btn(5), // SR
            dodge: btn(4),       // SL
            pause: btn(9),       // Plus
            taunt: btn(11),      // Stick click
            dpadUp: btn(0),
            dpadDown: btn(2),
            dpadLeft: btn(1),
            dpadRight: btn(3),
        };
    }

    // ─── Standard / Pro Controller ───
    const isSwitch = isSwitchController(gamepad.id);

    // A/B and X/Y swap for Nintendo layout
    let aPressed = btn(0);
    let bPressed = btn(1);
    let xPressed = btn(2);
    let yPressed = btn(3);

    if (isSwitch) {
        const tempA = aPressed;
        aPressed = bPressed;
        bPressed = tempA;
        const tempX = xPressed;
        xPressed = yPressed;
        yPressed = tempX;
    }

    const ltValue = gamepad.buttons[6]?.value || 0;
    const rtValue = gamepad.buttons[7]?.value || 0;
    const triggerPressed = ltValue > 0.5 || rtValue > 0.5;

    return {
        jump: aPressed,
        lightAttack: xPressed,
        heavyAttack: bPressed || yPressed,
        dodge: triggerPressed,
        pause: btn(9),    // START
        taunt: btn(11),   // R3
        dpadUp: btn(12),
        dpadDown: btn(13),
        dpadLeft: btn(14),
        dpadRight: btn(15),
    };
}

// ─── Menu Helpers ───

/**
 * Returns the button index to use as "confirm" (A equivalent) for menu scenes.
 * This avoids the scattered `logicalAIndex` pattern.
 */
export function getConfirmButtonIndex(gamepad: Gamepad): number {
    if (isLeftJoyCon(gamepad.id)) return 2;  // top face button sideways
    if (isRightJoyCon(gamepad.id)) return 0; // physical A
    if (isSwitchController(gamepad.id)) return 1; // Nintendo layout: physical A is index 1
    return 0; // Standard: A is index 0
}

/**
 * Returns the button index to use as "back" (B equivalent) for menu scenes.
 */
export function getBackButtonIndex(gamepad: Gamepad): number {
    if (isLeftJoyCon(gamepad.id)) return 0;  // bottom face button sideways
    if (isRightJoyCon(gamepad.id)) return 2; // physical B
    if (isSwitchController(gamepad.id)) return 0; // Nintendo layout: physical B is index 0
    return 1; // Standard: B is index 1
}

/**
 * Returns the vertical navigation value from stick + dpad, properly rotated for Joy-Cons.
 * Returns -1 (up), 0 (neutral), or 1 (down).
 */
export function getMenuNavY(gamepad: Gamepad): number {
    const axes = getMovementAxes(gamepad);
    const deadzone = 0.5;

    if (axes.moveY < -deadzone) return -1;
    if (axes.moveY > deadzone) return 1;

    // D-pad fallback
    if (isSingleJoyCon(gamepad.id)) {
        const btns = getNormalizedButtons(gamepad);
        if (btns.dpadUp) return -1;
        if (btns.dpadDown) return 1;
    } else {
        if (gamepad.buttons[12]?.pressed) return -1; // D-pad Up
        if (gamepad.buttons[13]?.pressed) return 1;  // D-pad Down
    }

    return 0;
}

/**
 * Returns the horizontal navigation value from stick + dpad, properly rotated for Joy-Cons.
 * Returns -1 (left), 0 (neutral), or 1 (right).
 */
export function getMenuNavX(gamepad: Gamepad): number {
    const axes = getMovementAxes(gamepad);
    const deadzone = 0.5;

    if (axes.moveX < -deadzone) return -1;
    if (axes.moveX > deadzone) return 1;

    // D-pad fallback
    if (isSingleJoyCon(gamepad.id)) {
        const btns = getNormalizedButtons(gamepad);
        if (btns.dpadLeft) return -1;
        if (btns.dpadRight) return 1;
    } else {
        if (gamepad.buttons[14]?.pressed) return -1; // D-pad Left
        if (gamepad.buttons[15]?.pressed) return 1;  // D-pad Right
    }

    return 0;
}
