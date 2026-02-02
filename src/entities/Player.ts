import Phaser from 'phaser';
import { PhysicsConfig } from '@shared/physics/PhysicsConfig';
import { PlayerState as PlayerLogic } from '@shared/entities/PlayerState';
import type { Rect } from '@shared/math/Rect';

import { InputManager } from '../input/InputManager';
import type { InputState } from '@shared/input/InputState';
import { Fighter } from './Fighter';
import { PlayerPhysics } from './player/PlayerPhysics';
import { PlayerCombat } from './player/PlayerCombat';
import { Attack, AttackPhase, AttackType, AttackDirection } from '../combat/Attack';
import { PlayerAI } from './player/PlayerAI';
import { NetworkManager } from '../network/NetworkManager';

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
    private sprite!: Phaser.GameObjects.Sprite;
    public physics?: PlayerPhysics; // Legacy - Optional/Disabled // Kept for legacy compatibility if needed, but unused

    // Shared Logic State
    public playerState: PlayerLogic;

    // Networking
    private networkManager: NetworkManager;

    // Combat system delegated to PlayerCombat
    private _isAttacking: boolean = false;
    public get isAttacking(): boolean { return this._isAttacking; }
    public set isAttacking(value: boolean) {
        this._isAttacking = value;
        // Sync to PlayerState
        if (this.playerState) this.playerState.isAttacking = value;
    }

    public combat: PlayerCombat;

    // Dodge system
    public isDodging: boolean = false; // Public for Physics access

    private dodgeCooldownTimer: number = 0;

    // Facing direction
    private facingDirection: number = 1;
    public getFacingDirection(): number { return this.facingDirection; }

    // Unified input system (keyboard + gamepad)
    private inputManager!: InputManager;
    private currentInput!: InputState;

    // AI Control
    public isAI: boolean = false;
    private ai: PlayerAI | null = null;
    private aiInput: any = {}; // Store AI generated input
    public isTrainingDummy: boolean = false; // Toggle for training mode

    // Player ID (0 = P1, 1 = P2, etc.)
    public playerId: number = 0;

    // Character Type
    public character: 'fok' = 'fok';
    private animPrefix: string = 'alchemist';
    private debugRect!: Phaser.GameObjects.Rectangle;
    private showDebugHitboxes: boolean = false;
    public lightAttackVariant: number = 0;

    // Item Holding
    public heldItem: any | null = null; // Typing as any to avoid circular import issues with Bomb for now, or use interface

    public checkItemPickup(): boolean {
        // Access bombs from scene
        const bombs = (this.scene as any).bombs;
        if (!bombs || bombs.length === 0) return false;

        const pickupRange = 60; // Interaction radius

        // Find closest bomb
        let closestBomb = null;
        let minDist = pickupRange;

        for (const bomb of bombs) {
            const dist = Phaser.Math.Distance.Between(this.x, this.y, bomb.x, bomb.y);
            if (dist < minDist) {
                minDist = dist;
                closestBomb = bomb;
            }
        }

        if (closestBomb) {
            this.pickupItem(closestBomb);
            return true;
        }
        return false;
    }

    public pickupItem(item: any): void {
        this.heldItem = item;
        // Disable physics for the item while holding
        item.setSensor(true);
        item.setIgnoreGravity(true);
        item.setVelocity(0, 0);
        item.setAngularVelocity(0);
    }

    public throwItem(velocityX: number, velocityY: number): void {
        if (!this.heldItem) return;

        const item = this.heldItem;
        this.heldItem = null;

        // Re-enable physics
        item.setSensor(false);
        item.setIgnoreGravity(false);

        item.setVelocity(velocityX, velocityY);
        // Add some spin
        item.setAngularVelocity(0.2 * this.getFacingDirection());
    }

    public updateHeldItemPosition(): void {
        if (this.heldItem) {
            // Position in front of the character, towards the bottom
            const offsetForward = 25 * this.getFacingDirection();
            const offsetDown = 25; // Relative to center (Bottom is 45)

            this.heldItem.setPosition(this.x + offsetForward, this.y + offsetDown);
            this.heldItem.setVelocity(0, 0); // Force stay
        }
    }

    public setDebug(visible: boolean): void {
        this.showDebugHitboxes = visible;
        if (this.debugRect) {
            this.debugRect.setVisible(visible);
        }
        if (this.combat) {
            this.combat.setDebug(visible);
        }
    }

    constructor(scene: Phaser.Scene, x: number, y: number, config: { isAI?: boolean, playerId?: number, gamepadIndex?: number | null, useKeyboard?: boolean, character?: 'fok' } = {}) {
        super(scene, x, y);

        this.isAI = config.isAI || false;
        this.playerId = config.playerId || 0;

        // Initialize Shared State
        this.playerState = new PlayerLogic(x, y);

        // Character Type
        this.character = config.character || 'fok';
        this.animPrefix = this.character;

        // Create player sprite
        // Offset Y adjusted to 0 based on user feedback ("+5 is a touch too low", "-22 is too high")
        this.sprite = scene.add.sprite(0, 0, 'fok_idle_0');
        // Auto-scale to fit hitbox height
        const targetHeight = PhysicsConfig.PLAYER_HEIGHT;
        const scale = (targetHeight / 256) * 1.5;
        this.sprite.setScale(scale);
        this.add(this.sprite);

        // Visual distinction
        if (this.isAI) {
            this.sprite.setTint(0xff5555); // Reddish tint for AI
        }
        // Removed hardcoded P2 green tint. Visuals should be handled by name tags or specific character skins.

        // Create Name Tag (Player Indicator)
        let displayName = '';
        if (this.isAI) {
            displayName = `CPU ${this.playerId + 1}`;
        } else {
            displayName = this.character.toUpperCase();
        }

        this.nameTag = scene.add.text(0, -60, displayName, {
            fontSize: '18px',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        });
        this.nameTag.setOrigin(0.5);
        this.add(this.nameTag);

        // Initialize Components
        // this.physics = new PlayerPhysics(this); // Legacy - Disabled to prevent conflicts
        this.combat = new PlayerCombat(this, scene);

        if (this.isAI) {
            this.ai = new PlayerAI(this, scene);
        }

        // Create Debug Hitbox (Hidden by default)
        this.debugRect = scene.add.rectangle(0, 0, this.width, this.height);
        this.debugRect.setStrokeStyle(2, 0x00ff00);
        this.debugRect.setFillStyle(0x00ff00, 0.2);
        this.debugRect.setVisible(false); // Disabled after verification
        this.add(this.debugRect);

        // Setup input manager
        const defaultKeyboard = this.playerId === 0 && !this.isAI;
        const useKeyboard = config.useKeyboard !== undefined ? config.useKeyboard : defaultKeyboard;
        const gamepadIdx = config.gamepadIndex !== undefined ? config.gamepadIndex : (this.playerId === 0 ? null : this.playerId);
        const enableGamepad = gamepadIdx !== null || !useKeyboard;

        this.inputManager = new InputManager(scene, {
            playerId: this.playerId,
            useKeyboard: useKeyboard,
            gamepadIndex: gamepadIdx,
            enableGamepad: enableGamepad
        });

        // Initialize Network
        this.networkManager = NetworkManager.getInstance();

        scene.add.existing(this);
    }

    public setDamage(percent: number): void {
        this.damagePercent = percent;
        this.playerState.health = percent; // Sync
        this.updateDamageDisplay();
    }

    private inputBuffer: Array<{ sequence: number, input: InputState, x: number, y: number, vx: number, vy: number }> = [];
    private nextSequence: number = 0;


    // --- DETACHED UPDATE LOOP ---
    // Physics & Game Logic run on Fixed Timestep from GameScene
    fixedUpdate(delta: number): void {
        const FIXED_STEP = delta; // Should be passed as 16.666 from GameScene

        // 1. Poll / Get Input
        if (this.isAI) {
            if (this.isTrainingDummy) {
                this.currentInput = this.inputManager.getEmptyInput();
            } else {
                this.updateAI(delta);
                this.currentInput = this.aiInput;
            }
        } else {
            this.currentInput = this.inputManager.poll();
        }

        let inputToProcess = this.currentInput;

        // 2. Network Sync
        if (!this.isAI && this.networkManager) {
            // Assign sequence and send
            const inputWithSeq = { ...this.currentInput, sequence: this.nextSequence++ };
            inputToProcess = inputWithSeq;

            // Sync to Network
            this.networkManager.send("input", inputWithSeq);

            // Debug log occasionally
            if (inputWithSeq.sequence % 30 === 0 && (this.currentInput.moveLeft || this.currentInput.moveRight || this.currentInput.jump)) {
                // console.log(`[Input] Sending Seq ${inputWithSeq.sequence}: L:${this.currentInput.moveLeft} R:${this.currentInput.moveRight} J:${this.currentInput.jump}`);
            }
        }

        // 3. Update Logic (Physics + State)
        // Check for item pickup before movement? Or after?
        // Logic relies on internal timers in playerState
        this.playerState.update(FIXED_STEP, inputToProcess);

        // 4. Update Combat Logic (Timers, Hitboxes - must be fixed step)
        this.combat.update(FIXED_STEP);
        this.combat.handleInput(this.currentInput);

        // 5. Store in Prediction Buffer
        if (!this.isAI && this.networkManager) {
            this.inputBuffer.push({
                sequence: inputToProcess.sequence!,
                input: inputToProcess,
                x: this.playerState.x,
                y: this.playerState.y,
                vx: this.playerState.velocity.x,
                vy: this.playerState.velocity.y
            });
            if (this.inputBuffer.length > 200) this.inputBuffer.shift();
        }

        // 6. Sync Visuals to Logic State (Snap Sprite)
        // 6. Sync Visuals to Logic State (Snap Sprite)
        this.updateTimers(FIXED_STEP);
        this.setPosition(this.playerState.x, this.playerState.y);
        this.velocity.set(this.playerState.velocity.x, this.playerState.velocity.y);
        this.isGrounded = this.playerState.isGrounded;
        this.isDodging = this.playerState.isDodging;
        this.isInvincible = this.playerState.isInvincible;
    }

    // Visual / Animation Update (Runs every frame via Phaser)
    preUpdate(time: number, delta: number): void {
        // if (super.preUpdate) super.preUpdate(time, delta); // Container might not have preUpdate, but if it does we call it. Checks safely.

        this.updateFacing();
        this.updateHeldItemPosition();
        this.updateAnimation(); // Animation interpolation could happen here
    }

    // Deprecated: Old update method removed
    update(delta: number): void {
        // No-op or warn if called accidentally
        // console.warn("Player.update called! Should use fixedUpdate defined in GameScene.");
    }


    private updateTimers(delta: number): void {
        this.hitStunTimer -= delta;

        // HitStun handled by Fighter base class mostly, but visual reset here
        if (this.hitStunTimer <= 0 && this.isHitStunned) {
            this.isHitStunned = false;
            this.resetVisuals();
        }

        if (this.dodgeCooldownTimer > 0) {
            this.dodgeCooldownTimer -= delta;
        }
    }

    private updateFacing(): void {
        if (this.isHitStunned) return;

        if (this.combat.isGroundPounding) {
            this.sprite.setFlipX(this.facingDirection > 0);
            return;
        }

        if (this.isAttacking) {
            const currentAttack = this.getCurrentAttack();
            if (currentAttack && currentAttack.phase !== AttackPhase.RECOVERY) {
                return;
            }
        }

        if (this.playerState.isWallSliding) {
            this.facingDirection = -this.playerState.wallDirection; // Look away from wall
        } else if (this.velocity.x > 5) {
            this.facingDirection = 1;
        } else if (this.velocity.x < -5) {
            this.facingDirection = -1;
        }

        this.sprite.setFlipX(this.facingDirection < 0);
    }

    // Visual Helpers
    public visualColor: number = 0xffffff;
    public nameTag: Phaser.GameObjects.Text;

    public setVisualTint(color: number): void {
        this.sprite.setTint(color);
    }

    public resetVisuals(): void {
        this.sprite.setAlpha(1);
        this.sprite.clearTint();

        if (this.nameTag) {
            const colorHex = '#' + this.visualColor.toString(16).padStart(6, '0');
            this.nameTag.setColor(colorHex);
        }

        this.sprite.setPosition(0, 0);
    }

    public setVisualOffset(x: number, y: number): void {
        this.sprite.setPosition(x, y);
    }

    public flashDamageColor(damage: number): void {
        let colorObj: Phaser.Types.Display.ColorObject;
        // Same color logic as before
        if (damage < 50) {
            colorObj = Phaser.Display.Color.Interpolate.ColorWithColor(
                new Phaser.Display.Color(255, 255, 255),
                new Phaser.Display.Color(255, 245, 150),
                50,
                damage
            );
        } else if (damage < 100) {
            colorObj = Phaser.Display.Color.Interpolate.ColorWithColor(
                new Phaser.Display.Color(255, 245, 150),
                new Phaser.Display.Color(255, 200, 150),
                50,
                damage - 50
            );
        } else if (damage < 150) {
            colorObj = Phaser.Display.Color.Interpolate.ColorWithColor(
                new Phaser.Display.Color(255, 200, 150),
                new Phaser.Display.Color(255, 150, 150),
                50,
                damage - 100
            );
        } else {
            colorObj = { r: 255, g: 150, b: 150, a: 255, color: Phaser.Display.Color.GetColor(255, 150, 150) };
        }

        const color = Phaser.Display.Color.GetColor(colorObj.r, colorObj.g, colorObj.b);
        this.sprite.setTint(color);
        this.sprite.setAlpha(1);

        this.scene.time.delayedCall(150, () => {
            this.resetVisuals();
        });
    }

    public checkPlatformCollision(platform: Rect, isSoft: boolean = false): void {
        this.playerState.checkPlatformCollision(platform, isSoft);
    }

    public checkWallCollision(left: number, right: number): void {
        this.playerState.handleWallMechanics(this.currentInput);
        // Need to check generic collision? PlayerState handles logic if inputs are provided?
        // Note: PlayerState.checkWallCollision missing?
        // In PlayerPhysics it was checkWallCollision. I missed moving it to PlayerState!
        // PlayerState handles wall SLIDING logic in update, but it needs to know if it's touching a wall.
        // checkWallCollision in PlayerPhysics sets isTouchingWall.
        // I need to port checkWallCollision logic to PlayerState or shim it.
        // I'll shim it here by setting flags on PlayerState manually for now, or adding method to PlayerState.
        // Let's add the logic here to modify PlayerState directly.

        const bounds = this.getBounds(); // Phaser bounds

        this.playerState.isTouchingWall = false;
        this.playerState.wallDirection = 0;

        if (bounds.left <= left) {
            this.playerState.x = left + PhysicsConfig.PLAYER_WIDTH / 2;
            this.playerState.isTouchingWall = true;
            this.playerState.wallDirection = -1;
        } else if (bounds.right >= right) {
            this.playerState.x = right - PhysicsConfig.PLAYER_WIDTH / 2; // Fixed logic
            this.playerState.isTouchingWall = true;
            this.playerState.wallDirection = 1;
        }
    }

    public checkLedgeGrab(_platforms: Array<{ rect: Phaser.GameObjects.Rectangle; isSoft?: boolean }>): void {
        // Ledge grab skipped for now
    }

    public checkHitAgainst(target: Player): void {
        this.combat.checkAttackCollision(target);
    }

    private updateAnimation(): void {
        if (this.isHitStunned) {
            this.playAnim('hurt', true);
            return;
        }
        if (this.combat.isCharging) {
            this.playAnim('charging', true);
            return;
        }
        if (this.combat.isGroundPounding) {
            this.playAnim('ground_pound', true);
            return;
        }
        if (this.isAttacking) {
            const currentAttack = this.getCurrentAttack();
            if (currentAttack && currentAttack.data.type === AttackType.HEAVY) {
                if (currentAttack.data.direction === AttackDirection.DOWN) {
                    this.playAnim('attack_down', true);
                } else if (currentAttack.data.direction === AttackDirection.SIDE) {
                    this.playAnim('attack_side', true);
                } else {
                    this.playAnim('attack_heavy', true);
                }
            } else if (currentAttack && currentAttack.data.direction === AttackDirection.UP) {
                this.playAnim('attack_up', true);
            } else {
                this.playAnim(`attack_light_${this.lightAttackVariant}`, true);
            }
            return;
        }
        if (this.isDodging) {
            this.playAnim('slide', true);
            return;
        }
        if (!this.isGrounded) {
            if (this.velocity.y < 0) {
                this.playAnim('jump', true);
            } else {
                this.playAnim('fall', true);
            }
            return;
        }

        if (Math.abs(this.velocity.x) > 10) {
            this.playAnim('run', true);
        } else {
            this.playAnim('idle', true);
        }
    }

    private playAnim(key: string, ignoreIfPlaying: boolean = true): void {
        let fullKey = `${this.animPrefix}_${key}`;
        this.sprite.anims.play(fullKey, ignoreIfPlaying);
        if (key === 'attack_side') {
            this.sprite.x = 35;
        } else {
            this.sprite.x = 0;
        }
    }

    private updateDamageDisplay(): void { }

    public get damage(): number { return this.damagePercent; }

    public getVelocity(): Phaser.Math.Vector2 { return this.velocity; }

    setKnockback(x: number, y: number): void {
        // Override Fighter implementation to update PlayerState
        this.velocity.x = x;
        this.velocity.y = y;
        if (this.playerState) {
            this.playerState.velocity.x = x;
            this.playerState.velocity.y = y;
        }
    }

    // Getters
    getState(): PlayerState {
        if (this.isHitStunned) return PlayerState.HIT_STUN;
        if (this.isDodging) return PlayerState.DODGING;
        if (this.combat.isGroundPounding) return PlayerState.GROUND_POUND;
        if (this.isAttacking) return PlayerState.ATTACKING;
        if (this.playerState.isRecovering) return PlayerState.RECOVERING;
        if (this.isGrounded) return PlayerState.GROUNDED;
        if (this.playerState.isFastFalling) return PlayerState.FAST_FALLING;
        return PlayerState.AIRBORNE;
    }

    getRecoveryAvailable(): boolean { return this.playerState.recoveryAvailable; }
    getIsInvincible(): boolean { return this.isInvincible; }
    getCurrentAttack(): Attack | null { return this.combat.currentAttack; }

    public get spriteObject(): any { return this.sprite; }

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

    private updateAI(delta: number): void {
        if (!this.ai) return;
        this.aiInput = this.ai.update(delta);
    }

    public applyHitStun(): void {
        super.applyHitStun();
        this.isAttacking = false;
        if (this.combat) {
            this.combat.isCharging = false;
            this.combat.isGroundPounding = false;
            this.combat.currentAttack = null;
            this.combat.deactivateHitbox();
        }
        this.isDodging = false;
        this.resetVisuals();
        this.flashDamageColor(this.damagePercent);

        // Sync hitstun
        this.playerState.isHitStunned = true;
    }

    public respawn(): void {
        this.setDamage(0);
        this.isHitStunned = false;
        this.isInvincible = false;
        this.resetVisuals();

        this.reset(); // Calls playerState.reset()
    }

    private lastReconciledSequence: number = -1;

    public reconcile(serverState: any): void {
        const lastProcessed = serverState.lastProcessedInput;
        if (lastProcessed === undefined || lastProcessed === -1) return;

        // Optimization: Don't reconcile the same sequence twice
        if (lastProcessed <= this.lastReconciledSequence) return;
        this.lastReconciledSequence = lastProcessed;

        // Find the matching input in our buffer
        const bufferIndex = this.inputBuffer.findIndex(b => b.sequence === lastProcessed);
        if (bufferIndex === -1) {
            // If we don't find it, sync base state anyway
            this.damagePercent = serverState.health;
            this.playerState.health = serverState.health;
            return;
        }

        const bufferedState = this.inputBuffer[bufferIndex];
        const dist = Phaser.Math.Distance.Between(bufferedState.x, bufferedState.y, serverState.x, serverState.y);

        // If server disagrees with our HISTORICAL prediction for that sequence...
        if (dist > 2) {
            console.warn(`[Network] Desync at Seq ${lastProcessed}: ${Math.round(dist)}px.
                [Local]  X:${Math.round(bufferedState.x)} Y:${Math.round(bufferedState.y)} VX:${Math.round(bufferedState.vx)} VY:${Math.round(bufferedState.vy)} G:${this.playerState.isGrounded} W:${this.playerState.isWallSliding} A:${this.playerState.isAttacking} R:${this.playerState.isRunning}
                [Server] X:${Math.round(serverState.x)} Y:${Math.round(serverState.y)} VX:${Math.round(serverState.vx)} VY:${Math.round(serverState.vy)} G:${serverState.isGrounded} W:${serverState.isWallSliding} A:${serverState.isAttacking} R:${serverState.isRunning}`);

            // 1. SNAP to server's reality at that moment
            this.playerState.x = serverState.x;
            this.playerState.y = serverState.y;
            this.playerState.velocity.x = serverState.vx || 0;
            this.playerState.velocity.y = serverState.vy || 0;

            // SNAP Flags (Essential for deterministic re-simulation)
            this.playerState.isGrounded = serverState.isGrounded;
            this.playerState.isWallSliding = serverState.isWallSliding;
            this.playerState.isTouchingWall = serverState.isTouchingWall;
            this.playerState.isDodging = serverState.isDodging;
            this.playerState.isAttacking = serverState.isAttacking;
            this.playerState.isHitStunned = serverState.isHitStunned;
            this.playerState.facingDirection = serverState.facingDirection;
            this.playerState.wallDirection = serverState.wallDirection;
            this.playerState.jumpsRemaining = serverState.jumpsRemaining;
            this.playerState.airActionCounter = serverState.airActionCounter;
            this.playerState.attackTimer = serverState.attackTimer;
            this.playerState.isRunning = serverState.isRunning;
            this.playerState.isFastFalling = serverState.isFastFalling;
            this.playerState.isRecovering = serverState.isRecovering;
            this.playerState.recoveryTimer = serverState.recoveryTimer;
            this.playerState.dodgeTimer = serverState.dodgeTimer;
            this.playerState.dodgeCooldownTimer = serverState.dodgeCooldownTimer;
            this.playerState.wallTouchesExhausted = serverState.wallTouchesExhausted;
            this.playerState.wasJumpHeld = serverState.wasJumpHeld;
            this.playerState.recoveryAvailable = serverState.recoveryAvailable;

            // Sync GameObject Visuals
            this.isAttacking = serverState.isAttacking;
            this.isHitStunned = serverState.isHitStunned;
            this.isDodging = serverState.isDodging;

            this.playerState.health = serverState.health;
            this.damagePercent = serverState.health;

            // 2. REPLAY all inputs from that point onwards to the current head
            // Remove everything BEFORE the reconciled sequence from buffer
            this.inputBuffer = this.inputBuffer.slice(bufferIndex + 1);

            const FIXED_STEP = 1000 / 60;
            for (const item of this.inputBuffer) {
                // Re-run physics for each buffered            // Run Logic (Collisions now internal to update)
                this.playerState.update(FIXED_STEP, item.input);

                // Update buffer state with NEW re-simulated reality
                item.x = this.playerState.x;
                item.y = this.playerState.y;
                item.vx = this.playerState.velocity.x;
                item.vy = this.playerState.velocity.y;
            }

            // 3. Update actual GameObject position to the NEW head
            this.setPosition(this.playerState.x, this.playerState.y);
        } else {
            // Success! Server confirms our prediction. Clean up old buffer.
            this.inputBuffer = this.inputBuffer.slice(bufferIndex + 1);
            // Always sync authoritative health/stun
            this.damagePercent = serverState.health;
            this.playerState.health = serverState.health;
            if (serverState.isHitStunned && !this.playerState.isHitStunned) {
                this.applyHitStun();
            }
        }
    }

    public reset(): void {
        this.playerState.reset();
        // Sync out
        this.velocity.set(0, 0);
        this.isGrounded = false;
        this.isDodging = false;
        this.isAttacking = false;
    }

    public addToCameraIgnore(camera: Phaser.Cameras.Scene2D.Camera): void {
        camera.ignore(this);
    }

    destroy(fromScene?: boolean): void {
        if (this.inputManager) this.inputManager.destroy();
        super.destroy(fromScene);
    }
}
