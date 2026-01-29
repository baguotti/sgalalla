import Phaser from 'phaser';
import { PhysicsConfig } from '../config/PhysicsConfig';

import { InputManager } from '../input/InputManager';
import type { InputState } from '../input/InputManager';
import { Fighter } from './Fighter';
import { PlayerPhysics } from './player/PlayerPhysics';
import { PlayerCombat } from './player/PlayerCombat';
import { Attack } from '../combat/Attack';

export const PlayerState = {
    GROUNDED: 'Grounded',
    AIRBORNE: 'Airborne',
    FAST_FALLING: 'Fast-falling',
    RECOVERING: 'Recovering',
    ATTACKING: 'Attacking',
    DODGING: 'Dodging',
    HIT_STUN: 'Hit-Stun',
    GROUND_POUND: 'Ground-Pound',
} as const;

export type PlayerState = typeof PlayerState[keyof typeof PlayerState];

export class Player extends Fighter {
    private sprite: Phaser.GameObjects.Sprite;
    public physics: PlayerPhysics; // Public for debugging/GameScene access if needed

    // velocity inherited from Fighter (managed by PlayerPhysics)
    // acceleration managed by PlayerPhysics

    // Physics state managed by PlayerPhysics
    // (acceleration, jumps, wall, ledge, platform logic moved to component)

    // Combat system delegated to PlayerCombat
    private _isAttacking: boolean = false;
    public get isAttacking(): boolean { return this._isAttacking; }
    public set isAttacking(value: boolean) { this._isAttacking = value; }

    public combat: PlayerCombat;

    // Dodge system
    public isDodging: boolean = false; // Public for Physics access

    private dodgeCooldownTimer: number = 0;
    // isInvincible inherited from Fighter


    // Hit stun (inherited)

    // Facing direction
    private facingDirection: number = 1;
    public getFacingDirection(): number { return this.facingDirection; }

    // Damage display
    private damageText: Phaser.GameObjects.Text;

    // Unified input system (keyboard + gamepad)
    private inputManager!: InputManager;
    private currentInput!: InputState;

    // AI Control
    public isAI: boolean = false;
    private aiTimer: number = 0;
    private aiState: 'IDLE' | 'CHASE' | 'ATTACK' | 'RECOVER' = 'IDLE';
    private aiInput: any = {}; // Store AI generated input

    constructor(scene: Phaser.Scene, x: number, y: number, isAI: boolean = false) {
        super(scene, x, y);

        this.isAI = isAI;

        // Create player sprite (Phaser Dude)
        this.sprite = scene.add.sprite(0, 0, 'dude');

        // Auto-scale to fit hitbox height (60px)
        const targetHeight = PhysicsConfig.PLAYER_HEIGHT;
        const scale = targetHeight / this.sprite.height;
        this.sprite.setScale(scale);

        this.add(this.sprite);

        // Tint for AI distinction
        if (this.isAI) {
            this.sprite.setTint(0xff5555); // Reddish tint
        }

        // Create damage text
        this.damageText = scene.add.text(0, -40, '0%', {
            fontSize: '16px',
            color: '#ffffff',
            fontFamily: 'Arial',
            stroke: '#000000',
            strokeThickness: 3,
        });
        this.damageText.setOrigin(0.5);
        this.add(this.damageText);

        this.add(this.damageText);

        this.add(this.damageText);

        // Initialize Components
        this.physics = new PlayerPhysics(this);
        this.combat = new PlayerCombat(this, scene);

        // Setup input
        this.setupInput();

        scene.add.existing(this);
    }

    private setupInput(): void {
        this.inputManager = new InputManager(this.scene);
        this.currentInput = this.inputManager.poll();
    }

    update(delta: number): void {
        // Get input
        if (this.isAI) {
            this.updateAI(delta);
            this.currentInput = this.aiInput;
        } else {
            this.currentInput = this.inputManager.poll();
        }

        // Update Physics Component
        this.physics.update(delta, this.currentInput);

        // Update Combat Component
        this.combat.update(delta);

        // Handle input for combat if not stunned/disabled
        // Logic handled inside combat.handleInput but we pass input state
        this.combat.handleInput(this.currentInput);

        // Update Combat/Timers
        this.updateTimers(delta);

        // Handle hit stun (Physics handles movement, but we handle visuals/state blocking)

        // Visuals
        this.updateFacing();
        this.updateAnimation();
        this.updateDamageDisplay();
    }

    private updateTimers(delta: number): void {
        this.hitStunTimer -= delta;

        if (this.hitStunTimer <= 0 && this.isHitStunned) {
            this.isHitStunned = false;
            this.resetVisuals();
        }



        if (this.dodgeCooldownTimer > 0) {
            this.dodgeCooldownTimer -= delta;
        }

        // Attack Cooldown delegated to Combat, but kept here if needed for interface specific logic? 
        // No, let's remove references if PlayerCombat handles it.
    }

    private updateFacing(): void {
        // Don't flip while attacking if using certain attacks, or during stun
        if (this.isHitStunned || (this.isAttacking)) {
            return;
        }

        // Don't flip during wall slide
        if (this.physics.isWallSliding) {
            this.sprite.setFlipX(this.physics.wallDirection === -1);
            return;
        }

        // Normal facing
        if (this.physics.acceleration.x > 0) {
            this.facingDirection = 1;
            this.sprite.setFlipX(false);
        } else if (this.physics.acceleration.x < 0) {
            this.facingDirection = -1;
            this.sprite.setFlipX(true);
        }
    }

    // Visual Helpers
    public setVisualTint(color: number): void {
        this.sprite.setTint(color);
    }

    public resetVisuals(): void {
        this.sprite.setAlpha(1);
        if (this.isAI) {
            this.sprite.setTint(0xff5555);
        } else {
            this.sprite.clearTint();
        }
    }

    // Delegated Methods for GameScene
    public checkPlatformCollision(platform: Phaser.GameObjects.Rectangle, isSoft: boolean = false): void {
        this.physics.checkPlatformCollision(platform, isSoft);
    }

    public checkWallCollision(left: number, right: number): void {
        this.physics.checkWallCollision(left, right);
    }


    // Delegated Methods
    public checkLedgeGrab(platforms: Array<{ rect: Phaser.GameObjects.Rectangle; isSoft?: boolean }>): void {
        this.physics.checkLedgeGrab(platforms);
    }




















    public checkHitAgainst(target: Player): void {
        this.combat.checkAttackCollision(target);
    }





















    private updateAnimation(): void {
        if (this.isHitStunned) {
            this.sprite.setFrame(4); // Turn frame as hit frame?
            return;
        }

        // Airborne
        if (!this.isGrounded) {
            if (this.velocity.y < 0) {
                // Jumping
                this.sprite.setFrame(1); // One leg up (Left)
            } else {
                // Falling
                this.sprite.setFrame(6); // One leg up (Right)
            }
            return;
        }

        // Grounded
        if (Math.abs(this.velocity.x) > 10) {
            if (this.velocity.x > 0) {
                this.sprite.anims.play('right', true);
            } else {
                this.sprite.anims.play('left', true);
            }
        } else {
            // Idle - sideways (use directional frame)
            if (this.facingDirection > 0) {
                this.sprite.setFrame(5); // Right idle
            } else {
                this.sprite.setFrame(0); // Left idle
            }
            this.sprite.anims.stop();
        }
    }

    private updateDamageDisplay(): void {
        this.damageText.setText(`${Math.floor(this.damagePercent)}%`);

        // Color based on damage
        if (this.damagePercent < 50) {
            this.damageText.setColor('#ffffff');
        } else if (this.damagePercent < 100) {
            this.damageText.setColor('#ffff00');
        } else if (this.damagePercent < 150) {
            this.damageText.setColor('#ff8800');
        } else {
            this.damageText.setColor('#ff0000');
        }
    }

    // Called by GameScene to check hits against other players




    setKnockback(x: number, y: number): void {
        this.velocity.x = x;
        this.velocity.y = y;
    }



    // Platform collision handling


    // Getters
    getVelocity(): Phaser.Math.Vector2 {
        return this.velocity;
    }

    getState(): PlayerState {
        if (this.isHitStunned) return PlayerState.HIT_STUN;
        if (this.isDodging) return PlayerState.DODGING;
        if (this.combat.isGroundPounding) return PlayerState.GROUND_POUND;
        if (this.isAttacking) return PlayerState.ATTACKING;
        if (this.physics.isRecovering) return PlayerState.RECOVERING;
        if (this.isGrounded) return PlayerState.GROUNDED;
        if (this.physics.isFastFalling) return PlayerState.FAST_FALLING;
        return PlayerState.AIRBORNE;
    }

    getRecoveryAvailable(): boolean {
        return this.physics.recoveryAvailable;
    }


    getIsInvincible(): boolean {
        return this.isInvincible;
    }

    getCurrentAttack(): Attack | null {
        return this.combat.currentAttack;
    }

    public get spriteObject(): Phaser.GameObjects.Sprite {
        return this.sprite;
    }



    getBounds(): Phaser.Geom.Rectangle {
        return new Phaser.Geom.Rectangle(
            this.x - PhysicsConfig.PLAYER_WIDTH / 2,
            this.y - PhysicsConfig.PLAYER_HEIGHT / 2,
            PhysicsConfig.PLAYER_WIDTH,
            PhysicsConfig.PLAYER_HEIGHT
        );
    }

    isGamepadConnected(): boolean {
        return this.inputManager.isGamepadConnected();
    }

    // Simple AI Implementation
    private updateAI(delta: number): void {
        this.aiTimer -= delta;

        // Find Target
        const players = this.scene.children.list.filter(c => c instanceof Player && c !== this && !(c as Player).isAI) as Player[];
        const target = players[0];

        // Reset Inputs
        this.aiInput = {
            moveLeft: false, moveRight: false, moveUp: false, moveDown: false,
            moveX: 0, moveY: 0,
            jump: false, jumpHeld: false,
            lightAttack: false, heavyAttack: false, heavyAttackHeld: false,
            dodge: false, dodgeHeld: false, recovery: false,
            aimUp: false, aimDown: false, aimLeft: false, aimRight: false,
            usingGamepad: false
        };

        if (!target) return; // No target

        const dx = target.x - this.x;
        // dy removed (unused)

        // Update decision every random interval (simulating reaction time)
        if (this.aiTimer <= 0) {
            this.aiTimer = 500 + Math.random() * 500; // Decision every 0.5-1s

            // Basic behavior state machine
            if (Math.abs(dx) > 150) {
                this.aiState = 'CHASE';
            } else {
                this.aiState = 'ATTACK';
            }
        }

        // Execute based on state
        if (this.aiState === 'CHASE') {
            if (dx > 0) {
                this.aiInput.moveRight = true;
                this.aiInput.moveX = 1;
                this.aiInput.aimRight = true;
            } else {
                this.aiInput.moveLeft = true;
                this.aiInput.moveX = -1;
                this.aiInput.aimLeft = true;
            }

            // Jump if stuck or target is higher
            if ((this.y > target.y + 100 && this.isGrounded) || (this.velocity.x === 0 && this.isGrounded && Math.abs(dx) > 50)) {
                this.aiInput.jump = true;
                this.aiInput.jumpHeld = true;
            }
        } else if (this.aiState === 'ATTACK') {
            // Face target
            if (dx > 0) {
                this.aiInput.aimRight = true;
            } else {
                this.aiInput.aimLeft = true;
            }

            // Randomly attack
            if (Math.random() > 0.95) {
                this.aiInput.lightAttack = true;
            } else if (Math.random() > 0.98) {
                this.aiInput.heavyAttack = true;
                // Sometimes hold heavy
                if (Math.random() > 0.5) this.aiInput.heavyAttackHeld = true;
            }
        }

        // Recover if falling
        if (this.y > 600) {
            this.aiInput.jump = true;
            this.aiInput.jumpHeld = true;
            this.aiInput.aimUp = true;
            this.aiInput.recovery = true; // Attempt recovery
            if (this.y > 650) this.aiInput.heavyAttack = true; // Use recovery attack
        }
    }
    // Inherited from Fighter, but we override to add specific logic or keep implementation
    public applyHitStun(): void {
        super.applyHitStun();

        // Cancel any active states
        // Cancel any active states
        this.isAttacking = false;
        // isCharging, isGroundPounding managed by Combat now, we should reset them
        // this.combat.reset() ?
        if (this.combat) {
            this.combat.isCharging = false;
            this.combat.isGroundPounding = false;
            this.combat.currentAttack = null;
            this.combat.deactivateHitbox();
        }
        this.isDodging = false;


        // Reset visuals (clears attack tints)
        this.resetVisuals();

        // Flash white for hit feedback
        this.sprite.setTintFill(0xffffff);
    }

    public respawn(): void {
        // Reset state
        this.velocity.set(0, 0);
        this.physics.acceleration.set(0, 0);
        this.damagePercent = 0;
        this.isHitStunned = false;
        this.isInvincible = false;
        this.resetVisuals();
        this.physics.resetOnGround();
    }

}
