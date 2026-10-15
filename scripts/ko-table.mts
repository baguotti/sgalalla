/**
 * KO percentages, for balance passes: the lowest damage at which each move
 * KOs a fighter standing at the stage's right edge who then tries to recover
 * (steers home, air jumps, recovery, up-dodge). Run with `npm run balance`;
 * pass another checkout's folder to compare, e.g. an older commit's worktree.
 */
const root = process.argv[2] ?? new URL('..', import.meta.url).pathname;
const { createMatch, stepMatch } = await import(`${root}/shared/GameSim.ts`);
const { emptyInput } = await import(`${root}/shared/FighterInput.ts`);

type Input = ReturnType<typeof emptyInput>;
const GROUND_Y = 870 - 92;

/** Attacker inputs per step: a press, then held buttons for `hold` steps. */
const MOVES: Record<string, (i: number) => Partial<Input>> = {
    'side light': i => i === 0 ? { lightAttack: true, lightAttackHeld: true, aimRight: true } : { aimRight: true },
    'neutral light': i => i === 0 ? { lightAttack: true, lightAttackHeld: true } : {},
    'up light': i => i === 0 ? { lightAttack: true, lightAttackHeld: true, aimUp: true } : { aimUp: true },
    'down light (slide)': i => i === 0 ? { lightAttack: true, lightAttackHeld: true, aimDown: true } : { aimDown: true },
    'side sig, tap': i => i === 0 ? { heavyAttack: true, heavyAttackHeld: true, aimRight: true } : i < 2 ? { heavyAttackHeld: true, aimRight: true } : { aimRight: true },
    'side sig, full charge': i => i === 0 ? { heavyAttack: true, heavyAttackHeld: true, aimRight: true } : i < 95 ? { heavyAttackHeld: true, aimRight: true } : { aimRight: true },
    'up sig, full charge': i => i === 0 ? { heavyAttack: true, heavyAttackHeld: true, aimUp: true } : i < 95 ? { heavyAttackHeld: true, aimUp: true } : { aimUp: true },
    'neutral sig, full charge': i => i === 0 ? { heavyAttack: true, heavyAttackHeld: true } : i < 95 ? { heavyAttackHeld: true } : {},
};

/** The target steers home, then jumps, recovers and up-dodges while below the stage top. */
function recover(f: any, t: number): Partial<Input> {
    const b = f.body;
    if (f.isHitStunned || f.hitstopSteps > 0) return {};
    const home = b.x > 960 ? { moveLeft: true, aimLeft: true } : { moveRight: true, aimRight: true };
    if (b.isGrounded || b.vy < 0 || b.y < 650) return home;
    if (t % 10 === 0 && b.jumpsRemaining > 0) return { ...home, jump: true, jumpHeld: true };
    if (t % 10 === 5 && b.recoveryAvailable) return { ...home, heavyAttack: true, heavyAttackHeld: true, aimUp: true };
    if (t % 10 === 7 && b.dodgeCooldownTimer <= 0) return { ...home, dodge: true, dodgeHeld: true, moveUp: true };
    return home;
}

function kos(move: string, damage: number): boolean {
    const match = createMatch([{ character: 'fok', x: 1380, y: GROUND_Y }, { character: 'fok', x: 1460, y: GROUND_Y }], 1);
    const [attacker, target] = match.fighters;
    const idle = () => ({ ...emptyInput() });
    for (let i = 0; i < 10; i++) stepMatch(match, [idle(), idle()]);
    attacker.body.facingDirection = 1;
    target.damagePercent = damage;
    const lives = target.lives;
    let hit = false;
    for (let t = 0; t < 700; t++) {
        const a = { ...emptyInput(), ...MOVES[move](t) };
        const d = hit ? { ...emptyInput(), ...recover(target, t) } : idle();
        stepMatch(match, [a, d]);
        if (target.isHitStunned) hit = true;
        if (target.lives < lives) return true;
    }
    return false;
}

for (const move of Object.keys(MOVES)) {
    let ko: number | null = null;
    for (let damage = 0; damage <= 400; damage += 10) {
        if (kos(move, damage)) { ko = damage; break; }
    }
    console.log(`${move.padEnd(26)} ${ko === null ? 'no KO by 400%' : `KOs from ${ko}%`}`);
}
