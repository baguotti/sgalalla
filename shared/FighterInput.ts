/**
 * One fighter's input for one simulation step.
 *
 * `jump`, `lightAttack`, `heavyAttack`, `dodge`, `taunt` and `defeat` are presses:
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
    defeat: boolean;
}

/** Bit order of the packed form. Append only: recordings and packets depend on it. */
const INPUT_BITS = [
    'moveLeft', 'moveRight', 'moveUp', 'moveDown',
    'aimLeft', 'aimRight', 'aimUp', 'aimDown',
    'jump', 'jumpHeld',
    'lightAttack', 'lightAttackHeld',
    'heavyAttack', 'heavyAttackHeld',
    'dodge', 'dodgeHeld',
    'taunt', 'defeat',
] as const satisfies readonly (keyof FighterInput)[];

export function emptyInput(): FighterInput {
    return unpackInput(0);
}

export function packInput(input: FighterInput): number {
    let mask = 0;
    for (let i = 0; i < INPUT_BITS.length; i++) {
        if (input[INPUT_BITS[i]]) mask |= 1 << i;
    }
    return mask;
}

export function unpackInput(mask: number, out: FighterInput = {} as FighterInput): FighterInput {
    for (let i = 0; i < INPUT_BITS.length; i++) {
        out[INPUT_BITS[i]] = (mask & (1 << i)) !== 0;
    }
    return out;
}
