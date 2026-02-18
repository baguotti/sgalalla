import Phaser from 'phaser';
import { Player } from '../Player';
import type { InputState } from '../../input/InputManager'; // Fix type import

export class PlayerAI {
    private player: Player;
    private scene: Phaser.Scene;

    // AI Configuration
    // private difficultyLevel: number = 1.0; // Unused for now

    // State Machine
    private state: 'IDLE' | 'CHASE' | 'SPACING' | 'ATTACK' | 'DEFEND' | 'RECOVER' = 'IDLE';
    private stateTimer: number = 0;

    // Input Store
    private currentInput: any = {}; // Mutable input state

    // Reaction Control
    // private reactionDelay: number = 0; // Unused for now
    private reactionTimer: number = 0;

    // Target tracking
    private target: Player | null = null;

    constructor(player: Player, scene: Phaser.Scene) {
        this.player = player;
        this.scene = scene;
        this.resetInput();
    }

    public update(delta: number): InputState {
        this.resetInput(); // Reset inputs every frame to avoid sticky keys

        this.findTarget();

        // Update reaction timer
        if (this.reactionTimer > 0) {
            this.reactionTimer -= delta;
        }

        this.updateState(delta);
        this.executeStateLogic();

        return this.formatInput();
    }

    private findTarget(): void {
        // Find closest opponent (Human or other AI)
        const players = this.scene.children.list.filter(c => c instanceof Player && c !== this.player) as Player[];

        let closestDist = Infinity;
        let closestTarget: Player | null = null;

        players.forEach(p => {
            // Ignore dead players if we had that state
            const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, p.x, p.y);
            if (dist < closestDist) {
                closestDist = dist;
                closestTarget = p;
            }
        });

        this.target = closestTarget;
    }

    private updateState(delta: number): void {
        this.stateTimer -= delta;

        // HIGH PRIORITY: RECOVERY (Survival is #1)
        // If off-stage and falling, force RECOVER state
        const stageLeft = 200;
        const stageRight = 1720;
        const stageBottom = 900;

        // If below stage or far out
        if (this.player.y > stageBottom ||
            (this.player.y > 600 && (this.player.x < stageLeft || this.player.x > stageRight))) {

            if (this.state !== 'RECOVER') {
                this.enterState('RECOVER');
            }
            return;
        }

        // If recovering and back on safe ground, switch to IDLE/CHASE
        if (this.state === 'RECOVER' && this.player.isGrounded && this.player.y < 800 && this.player.x > stageLeft && this.player.x < stageRight) {
            this.enterState('CHASE');
            return;
        }

        // HIGH PRIORITY: DEFENSE
        // If target is attacking and close, chance to dodge or jump
        if (this.target && this.target.isAttacking && this.state !== 'DEFEND' && this.state !== 'RECOVER') {
            const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.target.x, this.target.y);

            // Reaction check (based on "difficulty" or randomness)
            if (dist < 200 && this.reactionTimer <= 0) {
                if (Math.random() < 0.2) { // 20% chance to react per check interval
                    this.enterState('DEFEND');
                    this.reactionTimer = 500; // Cooldown on reaction
                    return;
                }
            }
        }

        // State Transition Logic
        if (this.stateTimer <= 0) {
            this.decideNextState();
        }
    }

    private decideNextState(): void {
        if (!this.target) {
            this.enterState('IDLE');
            return;
        }

        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.target.x, this.target.y);

        // Behavior logic
        if (this.state === 'DEFEND') {
            // After defending, counter-attack
            this.enterState('ATTACK');
            return;
        }

        if (dist > 400) {
            this.enterState('CHASE');
        } else if (dist < 80) {
            // Very close
            this.enterState('ATTACK');
        } else {
            // Mid range: 80 - 400
            const rand = Math.random();
            if (rand < 0.6) this.enterState('CHASE'); // Aggressive!
            else if (rand < 0.8) this.enterState('SPACING');
            else this.enterState('ATTACK'); // Dash attack?
        }
    }

    private enterState(newState: typeof this.state): void {
        this.state = newState;
        // Randomize duration
        this.stateTimer = 300 + Math.random() * 500;

        // State initialization
        if (newState === 'DEFEND') {
            this.stateTimer = 200;
        } else if (newState === 'ATTACK') {
            this.stateTimer = 400; // Commit to attack for a bit
        } else if (newState === 'RECOVER') {
            this.stateTimer = 1000; // Try to recover for at least 1s
        }
    }

    private executeStateLogic(): void {
        if (!this.target && this.state !== 'RECOVER') return;

        // Always face target if not recovering or defending specially
        if (this.target && this.state !== 'RECOVER') {
            const dx = this.target.x - this.player.x;
            this.currentInput.moveX = dx > 0 ? 0.1 : -0.1; // Slight nudge to aim
            // Explicit aim for attacks
            this.currentInput.aimRight = dx > 0;
            this.currentInput.aimLeft = dx < 0;

            // Aim up/down
            const dy = this.target.y - this.player.y;
            this.currentInput.aimUp = dy < -50;
            this.currentInput.aimDown = dy > 50;
        }

        switch (this.state) {
            case 'IDLE':
                // Just stand there or patrol?
                // Random jump 
                if (Math.random() < 0.01) this.currentInput.jump = true;
                break;

            case 'CHASE':
                if (!this.target) break;
                // Run towards target
                const dx = this.target.x - this.player.x;
                const dy = this.target.y - this.player.y;

                this.currentInput.moveX = dx > 20 ? 1 : (dx < -20 ? -1 : 0);
                this.currentInput.moveRight = dx > 20;
                this.currentInput.moveLeft = dx < -20;

                // Run enabled
                this.currentInput.dodgeHeld = true;

                // Jump if target is above or we hit a wall
                if (dy < -100 && this.player.isGrounded) {
                    this.currentInput.jump = true;
                    this.currentInput.jumpHeld = true;
                }

                // Platforms/Gaps: If grounded and moving but velocity is 0, jump (stuck logic)
                if (this.player.isGrounded && this.currentInput.moveX !== 0 && Math.abs(this.player.velocity.x) < 1) {
                    this.currentInput.jump = true;
                }
                break;

            case 'SPACING':
                if (!this.target) break;
                // Try to hover around 150-200 dist
                const distSpacing = Math.abs(this.target.x - this.player.x);
                if (distSpacing < 150) {
                    // Back off
                    const retreatDir = this.player.x < this.target.x ? -1 : 1;
                    this.currentInput.moveX = retreatDir;
                    this.currentInput.moveLeft = retreatDir === -1;
                    this.currentInput.moveRight = retreatDir === 1;
                } else {
                    // Shimmy
                    this.currentInput.moveX = 0;
                }
                break;

            case 'DEFEND':
                this.currentInput.dodge = true;
                // Choose direction
                this.currentInput.moveX = Math.random() > 0.5 ? 1 : -1;
                break;

            case 'ATTACK':
                if (!this.target) break;

                // Stop moving to attack stability (unless aerial)
                if (this.player.isGrounded) {
                    this.currentInput.moveX = 0;
                } else {
                    // Drift towards target in air
                    const airDx = this.target.x - this.player.x;
                    this.currentInput.moveX = airDx > 0 ? 1 : -1;
                }

                // Choose attack based on position
                const distY = this.target.y - this.player.y;

                if (distY < -80) { // Target above
                    this.currentInput.aimUp = true;
                    this.currentInput.lightAttack = true; // Up Light
                } else if (distY > 80 && !this.player.isGrounded) { // Target below
                    this.currentInput.aimDown = true;
                    this.currentInput.heavyAttack = true; // Ground pound!
                } else {
                    // Neutral / Side
                    if (Math.random() > 0.4) {
                        this.currentInput.lightAttack = true; // Side Light
                        // Ensure aim is correct
                        this.currentInput.aimRight = this.target.x > this.player.x;
                        this.currentInput.aimLeft = !this.currentInput.aimRight;
                    } else {
                        this.currentInput.heavyAttack = true; // Side Heavy
                        this.currentInput.aimRight = this.target.x > this.player.x;
                        this.currentInput.aimLeft = !this.currentInput.aimRight;
                    }
                }
                break;

            case 'RECOVER':
                // navigate to center stage (x = 960, y = 300)
                const centerX = 960;
                const recDx = centerX - this.player.x;

                this.currentInput.moveX = recDx > 0 ? 1 : -1;
                this.currentInput.moveRight = recDx > 0;
                this.currentInput.moveLeft = recDx < 0;

                // Vertical Recovery
                // If we have jumps, use them periodically
                if (this.player.velocity.y > 0) { // Falling
                    if (this.player.physics.jumpsRemaining > 0) {
                        // Don't burn all jumps instantly, wait for peak fall
                        if (Math.random() < 0.1) this.currentInput.jump = true;
                    } else {
                        // Use Recovery (Up Special)
                        // Only if we really need it
                        if (this.player.y > 600) {
                            this.currentInput.aimUp = true;
                            this.currentInput.heavyAttack = true; // Recovery
                        }
                    }
                }
                break;
        }
    }

    private resetInput(): void {
        this.currentInput = {
            moveLeft: false, moveRight: false, moveUp: false, moveDown: false,
            moveX: 0, moveY: 0,
            jump: false, jumpHeld: false,
            lightAttack: false, heavyAttack: false, heavyAttackHeld: false,
            dodge: false, dodgeHeld: false, recovery: false,
            aimUp: false, aimDown: false, aimLeft: false, aimRight: false,
            usingGamepad: false
        };
    }

    private formatInput(): InputState {
        // Return a copy to avoid mutation downstream issues?
        // InputState interface compliance
        return { ...this.currentInput };
    }
}
