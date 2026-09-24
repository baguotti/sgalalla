import type { Player } from '../entities/Player';
import { attackKey } from '../../shared/AttackData';
import { packInput } from '../../shared/FighterInput';
import { parityValues } from '../../shared/GameSim';
import { hashValues } from '../../shared/StateHash';

/**
 * Dev tool: records a local match from its first step — each fighter's input and a
 * hash of its state per step — so tests/sim.test.ts can replay it through GameSim
 * and check both agree. Enabled with `?record` in the URL; F9 saves it to tests/replays/.
 */
export class MatchRecorder {
    private readonly fighters: { character: string; x: number; y: number }[];
    private readonly inputs: number[][] = [];
    private readonly hashes: number[][] = [];

    constructor(players: readonly Player[]) {
        this.fighters = players.map(p => ({ character: p.character, x: p.x, y: p.y }));
    }

    captureStep(players: readonly Player[]): void {
        this.inputs.push(players.map(p => packInput(p.getCurrentInput())));
        this.hashes.push(players.map(p => hashValues(playerParityValues(p))));
    }

    /** Saves the match so far through the dev server (vite.config.ts) and returns the file name. */
    async save(): Promise<string> {
        const recording = { version: 1, fighters: this.fighters, inputs: this.inputs, hashes: this.hashes };
        const response = await fetch('/__save-replay', { method: 'POST', body: JSON.stringify(recording) });
        const file = await response.text();
        console.log(`[MatchRecorder] Saved tests/replays/${file} (${this.inputs.length} steps)`);
        return file;
    }
}

/** The game's current fighter state, in GameSim's PARITY_FIELDS order. */
function playerParityValues(p: Player): number[] {
    const physics = p.physics;
    const combat = p.combat;
    const attack = combat.currentAttack;
    // Timers are protected on Fighter
    const timers = p as unknown as { hitStunTimer: number; invulnerabilityTimer: number };
    return parityValues({
        x: p.x, y: p.y, vx: p.velocity.x, vy: p.velocity.y, facing: p.getFacingDirection(),
        grounded: physics.isGrounded, jumpsRemaining: physics.jumpsRemaining, airActionCounter: physics.airActionCounter,
        wallSliding: physics.isWallSliding, wallDirection: physics.wallDirection,
        dodging: physics.isDodging, spotDodging: physics.isSpotDodging,
        dodgeTimer: physics.dodgeTimer, dodgeCooldownTimer: physics.dodgeCooldownTimer,
        fastFalling: physics.isFastFalling, recovering: physics.isRecovering,
        recoveryAvailable: physics.recoveryAvailable, recoveryTimer: physics.recoveryTimer,
        running: physics.isRunning, state: p.fsm.getCurrentStateName(),
        damage: p.damagePercent, lives: p.lives, hitStunned: p.isHitStunned, hitStunTimer: timers.hitStunTimer,
        invulnerable: p.isInvulnerable, invulnerabilityTimer: timers.invulnerabilityTimer, attacking: p.isAttacking,
        attackKey: attack ? attackKey(attack.data.type, attack.data.direction, attack.data.isAerial) : null,
        attackPhase: attack?.phase ?? null, attackPhaseTimer: attack?.phaseTimer ?? 0,
        attackCooldownTimer: combat.attackCooldownTimer, charging: combat.isCharging, chargeTime: combat.chargeTime,
        groundPounding: combat.isGroundPounding, groundPoundStartupTimer: combat.groundPoundStartupTimer,
        groundPoundLanding: combat.isGroundPoundLanding,
    });
}
