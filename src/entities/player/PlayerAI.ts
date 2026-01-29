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
        this.findTarget();

        // Update reaction timer
        if (this.reactionTimer > 0) {
            this.reactionTimer -= delta;
            // If reacting to something, we might delay state changes?
            // For now, let's just run logic every frame but smooth inputs
        }

        this.updateState(delta);
        this.executeStateLogic();

        return this.formatInput();
    }

    private findTarget(): void {
        // Simple 1v1 targeting logic for now
        const players = this.scene.children.list.filter(c => c instanceof Player && c !== this.player && !(c as Player).isAI) as Player[];
        if (players.length > 0) {
            this.target = players[0];
        }
    }

    private updateState(delta: number): void {
        this.stateTimer -= delta;

        // HIGH PRIORITY: RECOVERY
        // If off-stage and falling, force RECOVER state
        const stageLeft = 100; // Approx stage bounds
        const stageRight = 700;
        const stageBottom = 600;

        if (this.player.y > stageBottom ||
            (this.player.y > 480 && (this.player.x < stageLeft || this.player.x > stageRight))) {
            if (this.state !== 'RECOVER') {
                this.enterState('RECOVER');
            }
            return;
        }

        // If currently recovering but safe, switch to IDLE
        if (this.state === 'RECOVER' && this.player.isGrounded && this.player.y < 500) {
            this.enterState('IDLE');
        }

        // HIGH PRIORITY: DEFENSE
        // If target is attacking and close, chance to dodge
        if (this.target && this.target.isAttacking && this.state !== 'DEFEND' && this.state !== 'RECOVER') {
            const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.target.x, this.target.y);
            if (dist < 150) {
                // Reaction check
                if (Math.random() < 0.1) { // 10% chance per frame to notice? fast!
                    this.enterState('DEFEND');
                    return;
                }
            }
        }

        // Timer based state switching for normal behaviors
        if (this.stateTimer <= 0) {
            this.decideNextState();
        }
    }

    private decideNextState(): void {
        if (!this.target) {
            this.enterState('IDLE');
            return;
        }

        const dist = Math.abs(this.target.x - this.player.x);

        // Behavior logic
        if (this.state === 'DEFEND') {
            // After defending, counter-attack or space
            this.enterState(Math.random() > 0.5 ? 'ATTACK' : 'SPACING');
            return;
        }

        if (dist > 300) {
            this.enterState('CHASE');
        } else if (dist < 100) {
            // Too close, attack or back off
            this.enterState(Math.random() > 0.3 ? 'ATTACK' : 'SPACING');
        } else {
            // Mid range: Mix of spacing and attacking
            const rand = Math.random();
            if (rand < 0.4) this.enterState('SPACING');
            else if (rand < 0.8) this.enterState('CHASE');
            else this.enterState('ATTACK');
        }
    }

    private enterState(newState: typeof this.state): void {
        this.state = newState;
        // Randomize duration for organic feel
        this.stateTimer = 200 + Math.random() * 800;

        // Reset sub-state inputs
        this.resetInput();

        // Initial setup for state
        if (newState === 'DEFEND') {
            this.stateTimer = 200; // Short defend window
            this.currentInput.dodge = true; // Instant dodge

            // Directional dodge?
            if (Math.random() > 0.5) {
                // Spaced dodge away
                this.currentInput.moveX = this.player.x < this.target!.x ? -1 : 1;
            }
        }
    }

    private executeStateLogic(): void {
        if (!this.target && this.state !== 'RECOVER') return;

        // Always face target if not recovering
        if (this.target && this.state !== 'RECOVER') {
            if (this.target.x > this.player.x) {
                this.currentInput.aimRight = true;
                this.currentInput.aimLeft = false;
            } else {
                this.currentInput.aimLeft = true;
                this.currentInput.aimRight = false;
            }
        }

        switch (this.state) {
            case 'IDLE':
                // Do nothing, maybe teabag?
                break;

            case 'CHASE':
                if (!this.target) break;
                // Run towards target
                const dx = this.target.x - this.player.x;
                this.currentInput.moveX = dx > 0 ? 1 : -1;
                this.currentInput.moveRight = dx > 0;
                this.currentInput.moveLeft = dx < 0;

                // Sprinting: Hold dodge while moving to run
                if (Math.abs(dx) > 200) {
                    this.currentInput.dodgeHeld = true; // Trigger run
                }

                // Jump obstacles
                if (this.player.isGrounded && this.player.velocity.x === 0 && Math.abs(dx) > 50) {
                    this.currentInput.jump = true;
                }
                break;

            case 'SPACING':
                if (!this.target) break;
                // Try to stay just outside attack range (~150px)
                const idealDist = 180;
                const dist = Math.abs(this.target.x - this.player.x);

                if (dist < idealDist - 50) {
                    // Retreat
                    const retreatDir = this.player.x < this.target.x ? -1 : 1;
                    this.currentInput.moveX = retreatDir;
                    this.currentInput.moveLeft = retreatDir === -1;
                    this.currentInput.moveRight = retreatDir === 1;
                } else if (dist > idealDist + 50) {
                    // Approach slowly
                    const approachDir = this.player.x < this.target.x ? 1 : -1;
                    this.currentInput.moveX = approachDir;
                    this.currentInput.moveLeft = approachDir === -1;
                    this.currentInput.moveRight = approachDir === 1;
                }
                // Else stand still and wait
                break;

            case 'ATTACK':
                if (!this.target) break;

                // Move into range if needed
                const atkDist = Math.abs(this.target.x - this.player.x);
                if (atkDist > 80) {
                    const dir = this.target.x - this.player.x > 0 ? 1 : -1;
                    this.currentInput.moveX = dir;
                    this.currentInput.moveRight = dir === 1;
                    this.currentInput.moveLeft = dir === -1;
                } else {
                    // In range, attack!
                    // Random mix of light/heavy and aerials
                    this.currentInput.moveX = 0; // Stop to attack ground

                    if (Math.random() > 0.7) {
                        this.currentInput.heavyAttack = true;
                        // Aim?
                        if (Math.random() > 0.5) this.currentInput.aimUp = true; // Neutral/Recovery
                    } else {
                        this.currentInput.lightAttack = true;
                        // Side light usually
                        if (Math.random() > 0.3) this.currentInput.aimRight = this.target.x > this.player.x;
                    }
                }
                break;

            case 'RECOVER':
                // navigate to center stage (x = 400, y = 200)
                const targetX = 400;
                const targetY = 200;

                const recDx = targetX - this.player.x;
                const recDy = targetY - this.player.y; // Negative means target is ABOVE

                // Horizontal movement
                this.currentInput.moveX = recDx > 0 ? 1 : -1;
                this.currentInput.moveRight = recDx > 0;
                this.currentInput.moveLeft = recDx < 0;

                // Vertical Recovery
                if (this.player.y > 500 || recDy < -100) {
                    // Need height
                    if (this.player.physics.jumpsRemaining > 0) {
                        this.currentInput.jump = true;
                        this.currentInput.jumpHeld = true;
                    } else if (this.player.getRecoveryAvailable()) {
                        // Use Recovery Move
                        this.currentInput.aimUp = true;
                        this.currentInput.heavyAttack = true;
                    } else {
                        // Panic dodge up?
                        this.currentInput.aimUp = true;
                        this.currentInput.dodge = true;
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
