/**
 * One fighter's input for one simulation step.
 *
 * `jump`, `lightAttack`, `heavyAttack`, `dodge`, `taunt` and `throw` are presses:
 * true only on the step the button went down. The `*Held` fields and the
 * directions are the button's current state. Aim uses a stricter stick
 * threshold than movement on gamepads, so it has its own bits.
 */
export interface FighterInput {
    moveLeft: boolean;
    moveRight: boolean;
    moveUp: boolean;
    moveDown: boolean;
    aimLeft: boolean;
    aimRight: boolean;
    aimUp: boolean;
    aimDown: boolean;
    jump: boolean;
    jumpHeld: boolean;
    lightAttack: boolean;
    lightAttackHeld: boolean;
    heavyAttack: boolean;
    heavyAttackHeld: boolean;
    dodge: boolean;
    dodgeHeld: boolean;
    taunt: boolean;
    /** Picks up a bomb, or starts charging a throw: held to charge, let go to throw. */
    throw: boolean;
    throwHeld: boolean;
}

/** Bit order of the packed form. Append only: recordings and packets depend on it (null: a retired bit, kept so the later ones stay put). */
const INPUT_BITS = [
    'moveLeft', 'moveRight', 'moveUp', 'moveDown',
    'aimLeft', 'aimRight', 'aimUp', 'aimDown',
    'jump', 'jumpHeld',
    'lightAttack', 'lightAttackHeld',
    'heavyAttack', 'heavyAttackHeld',
    'dodge', 'dodgeHeld',
    'taunt', null,
    'throw', 'throwHeld',
] as const satisfies readonly (keyof FighterInput | null)[];

export function emptyInput(): FighterInput {
    return unpackInput(0);
}

export function packInput(input: FighterInput): number {
    let mask = 0;
    for (let i = 0; i < INPUT_BITS.length; i++) {
        const bit = INPUT_BITS[i];
        if (bit && input[bit]) mask |= 1 << i;
    }
    return mask;
}

export function unpackInput(mask: number, out: FighterInput = {} as FighterInput): FighterInput {
    for (let i = 0; i < INPUT_BITS.length; i++) {
        const bit = INPUT_BITS[i];
        if (bit) out[bit] = (mask & (1 << i)) !== 0;
    }
    return out;
}

/**
 * The one-step presses. A guess of someone's next input repeats their last
 * input without these, since a held button is likely still held but a press
 * is not repeated.
 */
export const PRESS_BITS = packInput({ ...emptyInput(), jump: true, lightAttack: true, heavyAttack: true, dodge: true, taunt: true, throw: true });
