import { emptyInput, type FighterInput } from '../../../shared/FighterInput';
import { isInPlay, type FighterState } from '../../../shared/FighterState';
import type { MatchState } from '../../../shared/GameSim';

type AIState = 'IDLE' | 'CHASE' | 'SPACING' | 'ATTACK' | 'DEFEND' | 'RECOVER';

/** CPU opponent: picks a fighter's inputs from the match state each step. */
export class PlayerAI {
    private readonly fighterIndex: number;
    private state: AIState = 'IDLE';
    private stateTimer = 0;
    private reactionTimer = 0;

    private readonly input: FighterInput = emptyInput();
    private self!: FighterState;
    private target: FighterState | null = null;

    constructor(fighterIndex: number) {
        this.fighterIndex = fighterIndex;
    }

    public update(match: MatchState, delta: number): FighterInput {
        Object.assign(this.input, emptyInput());
        this.self = match.fighters[this.fighterIndex];
        this.findTarget(match);

        if (this.reactionTimer > 0) {
            this.reactionTimer -= delta;
        }

        this.updateState(delta);
        this.executeStateLogic();
        return this.input;
    }

    /** Closest opponent in play. */
    private findTarget(match: MatchState): void {
        const { x, y } = this.self.body;
        let closestDist = Infinity;
        this.target = null;
        for (const f of match.fighters) {
            if (f === this.self || !isInPlay(f)) continue;
            const dist = Math.hypot(f.body.x - x, f.body.y - y);
            if (dist < closestDist) {
                closestDist = dist;
                this.target = f;
            }
        }
    }

    private distanceToTarget(): number {
        const a = this.self.body;
        const b = this.target!.body;
        return Math.hypot(b.x - a.x, b.y - a.y);
    }

    private updateState(delta: number): void {
        this.stateTimer -= delta;
        const self = this.self.body;

        // Survival first: off-stage and falling means recover
        const stageLeft = 200;
        const stageRight = 1720;
        const stageBottom = 900;
        if (self.y > stageBottom || (self.y > 600 && (self.x < stageLeft || self.x > stageRight))) {
            if (this.state !== 'RECOVER') this.enterState('RECOVER');
            return;
        }

        // Back on safe ground
        if (this.state === 'RECOVER' && self.isGrounded && self.y < 800 && self.x > stageLeft && self.x < stageRight) {
            this.enterState('CHASE');
            return;
        }

        // Sometimes react to a close attacker
        if (this.target && this.target.isAttacking && this.state !== 'DEFEND' && this.state !== 'RECOVER') {
            if (this.distanceToTarget() < 200 && this.reactionTimer <= 0 && Math.random() < 0.2) {
                this.enterState('DEFEND');
                this.reactionTimer = 500;
                return;
            }
        }

        if (this.stateTimer <= 0) {
            this.decideNextState();
        }
    }

    private decideNextState(): void {
        if (!this.target) {
            this.enterState('IDLE');
            return;
        }

        // Counter-attack after defending
        if (this.state === 'DEFEND') {
            this.enterState('ATTACK');
            return;
        }

        const dist = this.distanceToTarget();
        if (dist > 400) {
            this.enterState('CHASE');
        } else if (dist < 80) {
            this.enterState('ATTACK');
        } else {
            const rand = Math.random();
            if (rand < 0.6) this.enterState('CHASE');
            else if (rand < 0.8) this.enterState('SPACING');
            else this.enterState('ATTACK');
        }
    }

    private enterState(newState: AIState): void {
        this.state = newState;
        this.stateTimer = 300 + Math.random() * 500;
        if (newState === 'DEFEND') {
            this.stateTimer = 200;
        } else if (newState === 'ATTACK') {
            this.stateTimer = 400;
        } else if (newState === 'RECOVER') {
            this.stateTimer = 1000;
        }
    }

    private executeStateLogic(): void {
        const input = this.input;
        const self = this.self.body;
        const target = this.target?.body;
        if (!target && this.state !== 'RECOVER') return;

        // Aim at the target
        if (target && this.state !== 'RECOVER') {
            const dx = target.x - self.x;
            const dy = target.y - self.y;
            input.aimRight = dx > 0;
            input.aimLeft = dx < 0;
            input.aimUp = dy < -50;
            input.aimDown = dy > 50;
        }

        switch (this.state) {
            case 'IDLE':
                if (Math.random() < 0.01) input.jump = true;
                break;

            case 'CHASE': {
                if (!target) break;
                const dx = target.x - self.x;
                const dy = target.y - self.y;
                input.moveRight = dx > 20;
                input.moveLeft = dx < -20;
                input.dodgeHeld = true;

                // Jump up to a higher target, or over whatever stops us
                if (dy < -100 && self.isGrounded) {
                    input.jump = true;
                    input.jumpHeld = true;
                }
                if (self.isGrounded && (input.moveLeft || input.moveRight) && Math.abs(self.vx) < 1) {
                    input.jump = true;
                }
                break;
            }

            case 'SPACING': {
                if (!target) break;
                // Back off when closer than 150
                if (Math.abs(target.x - self.x) < 150) {
                    const retreat = self.x < target.x ? -1 : 1;
                    input.moveLeft = retreat === -1;
                    input.moveRight = retreat === 1;
                }
                break;
            }

            case 'DEFEND':
                input.dodge = true;
                break;

            case 'ATTACK': {
                if (!target) break;
                const dy = target.y - self.y;
                if (dy < -80) {
                    input.aimUp = true;
                    input.lightAttack = true;
                } else if (dy > 80 && !self.isGrounded) {
                    // Ground pound onto a target below
                    input.aimDown = true;
                    input.heavyAttack = true;
                } else {
                    if (Math.random() > 0.4) input.lightAttack = true;
                    else input.heavyAttack = true;
                    input.aimRight = target.x > self.x;
                    input.aimLeft = !input.aimRight;
                }
                break;
            }

            case 'RECOVER': {
                // Head for the stage centre
                const dx = 960 - self.x;
                input.moveRight = dx > 0;
                input.moveLeft = dx < 0;

                if (self.vy > 0) {
                    if (self.jumpsRemaining > 0) {
                        // Spread the jumps out
                        if (Math.random() < 0.1) input.jump = true;
                    } else if (self.y > 600) {
                        input.aimUp = true;
                        input.heavyAttack = true;
                    }
                }
                break;
            }
        }
    }
}
