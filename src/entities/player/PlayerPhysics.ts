/**
 * PlayerPhysics — Thin Wrapper (Phase 4)
 *
 * Delegates all physics logic to shared/PhysicsSimulation.ts.
 * Handles Phaser-specific visuals (recovery ghost, SFX, FSM) via events.
 * Keeps public field interface for backward compatibility.
 */
import Phaser from 'phaser';
import { Player } from '../Player';
import { PhysicsConfig } from '../../config/PhysicsConfig';
import type { InputState } from '../../input/InputManager';
import { AttackPhase, AttackType } from '../../combat/Attack';
import { AudioManager } from '../../managers/AudioManager';
import type { GameSceneInterface } from '../../scenes/GameSceneInterface';
import {
    type SimBody, type SimInput, type PhysicsEvent,
    createBody, stepPhysics,
    checkSinglePlatformCollision, resetWallState, checkSingleWallCollision,
    doJump, startRecovery as sharedStartRecovery,
    ATTACK_PHASE_NONE, ATTACK_PHASE_STARTUP, ATTACK_PHASE_ACTIVE, ATTACK_PHASE_RECOVERY,
    ATTACK_TYPE_NONE, ATTACK_TYPE_LIGHT, ATTACK_TYPE_HEAVY,
} from '../../../shared/PhysicsSimulation';

export class PlayerPhysics {
    private player: Player;

    /** The shared SimBody — single source of truth for physics state. */
    public body: SimBody;

    // ── Public fields (read from body, kept for backward compat) ──
    // These are synced TO body before stepPhysics and FROM body after.
    public acceleration: Phaser.Math.Vector2; // Legacy — only .set(0,0) used externally
    public isGrounded: boolean = false;
    public wasGroundedLastFrame: boolean = false;
    public isFastFalling: boolean = false;

    public jumpsRemaining: number = 3;
    public airActionCounter: number = 0;
    public jumpHoldTime: number = 0;
    public wasJumpHeld: boolean = false;

    public isRecovering: boolean = false;
    public recoveryAvailable: boolean = true;
    public lastRecoveryTime: number = 0;
    public recoveryTimer: number = 0;
    public recoveryGhost: Phaser.GameObjects.Sprite | null = null;

    public isWallSliding: boolean = false;
    public wallDirection: number = 0;
    public isTouchingWall: boolean = false;
    public wallTouchesExhausted: boolean = false;
    public lastWallTouchFrame: boolean = false;
    public lastWallTouchTimer: number = 0;
    public lastWallDirection: number = 0;

    public isDodging: boolean = false;
    public isSpotDodging: boolean = false;
    public dodgeTimer: number = 0;
    public dodgeCooldownTimer: number = 0;
    public dodgeDirection: number = 0;

    public droppingThroughPlatform: Phaser.GameObjects.Rectangle | null = null;
    public droppingThroughY: number | null = null;
    public dropGraceTimer: number = 0;
    public currentPlatform: Phaser.GameObjects.Rectangle | null = null;

    public isRunning: boolean = false;

    // ── Platform index mapping (Phaser object → stable int) ──
    private platformMap: Map<Phaser.GameObjects.Rectangle, number> = new Map();
    private indexToPlatform: Map<number, Phaser.GameObjects.Rectangle> = new Map();
    private nextPlatIdx: number = 0;

    constructor(player: Player) {
        this.player = player;
        this.acceleration = new Phaser.Math.Vector2(0, 0);
        this.body = createBody(player.x, player.y, player.getFacingDirection());
    }

    // ═══════════════════════════════════════════════════════
    //  MAIN UPDATE — delegates to shared stepPhysics
    // ═══════════════════════════════════════════════════════

    public update(delta: number, input: InputState): void {
        // Sync state → body
        this.syncToBody();

        // Map InputState → SimInput
        const simInput: SimInput = {
            moveLeft: input.moveLeft,
            moveRight: input.moveRight,
            moveDown: input.moveDown,
            moveUp: input.moveUp,
            jumpBuffered: this.player.inputBuffer.has('jump'),
            jumpHeld: input.jumpHeld,
            dodgeBuffered: this.player.inputBuffer.has('dodge'),
            aimUp: input.aimUp,
            aimDown: input.aimDown,
            recoveryRequested: false, // Handled by PlayerCombat on client
        };

        // Run shared physics
        const events = stepPhysics(this.body, simInput, delta / 1000);

        // Sync body → state
        this.syncFromBody();

        // Process events (SFX, input consumption, FSM)
        this.processEvents(events);
    }

    // ═══════════════════════════════════════════════════════
    //  COLLISION — delegates to shared per-element functions
    // ═══════════════════════════════════════════════════════

    public checkPlatformCollision(platform: Phaser.GameObjects.Rectangle, isSoft: boolean = false): void {
        this.syncToBody();

        const platIdx = this.getPlatformIdx(platform);
        // Platform center coordinates (Phaser Rectangle origin is 0.5, 0.5)
        const cx = platform.x;
        const cy = platform.y;
        const w = platform.displayWidth;
        const h = platform.displayHeight;

        // Track droppingThroughY from platform center Y
        if (this.body.droppingThroughPlatformIdx === platIdx) {
            this.body.droppingThroughY = cy;
        }

        const events = checkSinglePlatformCollision(this.body, platIdx, cx, cy, w, h, isSoft);

        this.syncFromBody();

        // Sync Phaser platform references
        if (this.body.currentPlatformIdx === platIdx) {
            this.currentPlatform = platform;
        } else if (this.currentPlatform === platform) {
            this.currentPlatform = null;
        }

        this.processEvents(events);
    }

    public checkWallCollision(walls: Phaser.Geom.Rectangle[]): void {
        this.syncToBody();
        resetWallState(this.body);

        for (const wall of walls) {
            // Phaser.Geom.Rectangle uses top-left origin → convert to center
            const cx = wall.x + wall.width / 2;
            const cy = wall.y + wall.height / 2;
            checkSingleWallCollision(this.body, cx, cy, wall.width, wall.height);
        }

        this.syncFromBody();
    }

    // ═══════════════════════════════════════════════════════
    //  RECOVERY (external trigger from combat)
    // ═══════════════════════════════════════════════════════

    public startRecovery(): void {
        this.syncToBody();
        const events = sharedStartRecovery(this.body);
        this.syncFromBody();

        if (events.length > 0) {
            this.player.fsm.changeState('Recovery', this.player);
            this.processEvents(events);

            this.spawnRecoveryGhost();

            // Emit event for network sync
            this.player.scene.events.emit('recovery_start', this.player);
        }
    }

    // ═══════════════════════════════════════════════════════
    //  JUMP (external trigger)
    // ═══════════════════════════════════════════════════════

    public performJump(): void {
        this.syncToBody();
        const events = doJump(this.body);
        this.syncFromBody();
        this.processEvents(events);
    }

    // ═══════════════════════════════════════════════════════
    //  RESET
    // ═══════════════════════════════════════════════════════

    public resetOnGround(): void {
        this.player.isGrounded = true;
        this.isGrounded = true;
        this.jumpsRemaining = PhysicsConfig.MAX_JUMPS - 1;
        this.airActionCounter = 0;
        this.isFastFalling = false;
        this.isWallSliding = false;
        this.wallTouchesExhausted = false;
        this.droppingThroughPlatform = null;
        this.droppingThroughY = null;
        this.clearRecoveryGhost();
        this.syncToBody();
    }

    public reset(): void {
        if (this.player.body) {
            this.player.body.velocity.x = 0;
            this.player.body.velocity.y = 0;
        }
        this.player.velocity.set(0, 0);
        this.acceleration.set(0, 0);
        this.isGrounded = false;
        this.jumpsRemaining = PhysicsConfig.MAX_JUMPS;
        this.airActionCounter = 0;
        this.isFastFalling = false;
        this.isWallSliding = false;
        this.wallTouchesExhausted = false;
        this.droppingThroughPlatform = null;
        this.droppingThroughY = null;
        this.recoveryAvailable = true;
        this.dodgeTimer = 0;
        this.dodgeCooldownTimer = 0;
        this.clearRecoveryGhost();
        this.body = createBody(this.player.x, this.player.y, this.player.getFacingDirection());
    }

    // ═══════════════════════════════════════════════════════
    //  STATE SYNC (PlayerPhysics ↔ SimBody)
    // ═══════════════════════════════════════════════════════

    private syncToBody(): void {
        const b = this.body;

        // Position & velocity from Player
        b.x = this.player.x;
        b.y = this.player.y;
        b.vx = this.player.velocity.x;
        b.vy = this.player.velocity.y;
        b.facingDirection = this.player.getFacingDirection();

        // Physics state from this
        b.isGrounded = this.isGrounded;
        b.wasGroundedLastFrame = this.wasGroundedLastFrame;
        b.isFastFalling = this.isFastFalling;
        b.jumpsRemaining = this.jumpsRemaining;
        b.airActionCounter = this.airActionCounter;
        b.jumpHoldTime = this.jumpHoldTime;
        b.wasJumpHeld = this.wasJumpHeld;
        b.isRecovering = this.isRecovering;
        b.recoveryAvailable = this.recoveryAvailable;
        b.recoveryTimer = this.recoveryTimer;
        b.isWallSliding = this.isWallSliding;
        b.wallDirection = this.wallDirection;
        b.isTouchingWall = this.isTouchingWall;
        b.wallTouchesExhausted = this.wallTouchesExhausted;
        b.lastWallTouchTimer = this.lastWallTouchTimer;
        b.lastWallDirection = this.lastWallDirection;
        b.isDodging = this.isDodging;
        b.isSpotDodging = this.isSpotDodging;
        b.dodgeTimer = this.dodgeTimer;
        b.dodgeCooldownTimer = this.dodgeCooldownTimer;
        b.dodgeDirection = this.dodgeDirection;
        b.isInvincible = this.player.isInvincible;
        b.droppingThroughY = this.droppingThroughY ?? NaN;
        b.dropGraceTimer = this.dropGraceTimer;
        b.isRunning = this.isRunning;

        // Platform references → indices
        b.currentPlatformIdx = this.currentPlatform ? (this.platformMap.get(this.currentPlatform) ?? -1) : -1;
        b.droppingThroughPlatformIdx = this.droppingThroughPlatform ? (this.platformMap.get(this.droppingThroughPlatform) ?? -1) : -1;

        // Combat state (read-only by physics)
        b.isAttacking = this.player.isAttacking;
        b.isHitStunned = this.player.isHitStunned;
        b.isCharging = this.player.combat?.isCharging ?? false;
        b.isThrowCharging = this.player.combat?.isThrowCharging ?? false;

        const attack = this.player.getCurrentAttack();
        if (attack) {
            b.attackPhase = attack.phase === AttackPhase.STARTUP ? ATTACK_PHASE_STARTUP :
                attack.phase === AttackPhase.ACTIVE ? ATTACK_PHASE_ACTIVE :
                    attack.phase === AttackPhase.RECOVERY ? ATTACK_PHASE_RECOVERY :
                        ATTACK_PHASE_NONE;
            b.attackType = attack.data.type === AttackType.LIGHT ? ATTACK_TYPE_LIGHT :
                attack.data.type === AttackType.HEAVY ? ATTACK_TYPE_HEAVY :
                    ATTACK_TYPE_NONE;
            b.shouldStallInAir = !!attack.data.shouldStallInAir;
        } else {
            b.attackPhase = ATTACK_PHASE_NONE;
            b.attackType = ATTACK_TYPE_NONE;
            b.shouldStallInAir = false;
        }
    }

    private syncFromBody(): void {
        const b = this.body;

        // Position & velocity → Player
        this.player.x = b.x;
        this.player.y = b.y;
        this.player.velocity.x = b.vx;
        this.player.velocity.y = b.vy;

        // Physics state → this
        this.isGrounded = b.isGrounded;
        this.wasGroundedLastFrame = b.wasGroundedLastFrame;
        this.isFastFalling = b.isFastFalling;
        this.jumpsRemaining = b.jumpsRemaining;
        this.airActionCounter = b.airActionCounter;
        this.jumpHoldTime = b.jumpHoldTime;
        this.wasJumpHeld = b.wasJumpHeld;
        this.isRecovering = b.isRecovering;
        this.recoveryAvailable = b.recoveryAvailable;
        this.recoveryTimer = b.recoveryTimer;
        this.isWallSliding = b.isWallSliding;
        this.wallDirection = b.wallDirection;
        this.isTouchingWall = b.isTouchingWall;
        this.wallTouchesExhausted = b.wallTouchesExhausted;
        this.lastWallTouchTimer = b.lastWallTouchTimer;
        this.lastWallDirection = b.lastWallDirection;
        this.isDodging = b.isDodging;
        this.isSpotDodging = b.isSpotDodging;
        this.dodgeTimer = b.dodgeTimer;
        this.dodgeCooldownTimer = b.dodgeCooldownTimer;
        this.dodgeDirection = b.dodgeDirection;
        this.droppingThroughY = isNaN(b.droppingThroughY) ? null : b.droppingThroughY;
        this.dropGraceTimer = b.dropGraceTimer;
        this.isRunning = b.isRunning;

        // Sync back to Player
        this.player.isGrounded = b.isGrounded;
        this.player.isInvincible = b.isInvincible;
        this.player.isDodging = b.isDodging;

        // Platform index → Phaser reference
        if (b.currentPlatformIdx >= 0) {
            this.currentPlatform = this.indexToPlatform.get(b.currentPlatformIdx) ?? null;
        } else {
            this.currentPlatform = null;
        }
        if (b.droppingThroughPlatformIdx >= 0) {
            this.droppingThroughPlatform = this.indexToPlatform.get(b.droppingThroughPlatformIdx) ?? null;
        } else {
            this.droppingThroughPlatform = null;
        }

        // Recovery ghost tracking (visual only)
        if (this.isRecovering && this.recoveryGhost && this.recoveryGhost.active) {
            this.recoveryGhost.setPosition(this.player.x, this.player.y - 30);
        }
    }

    // ═══════════════════════════════════════════════════════
    //  EVENT PROCESSING
    // ═══════════════════════════════════════════════════════

    private processEvents(events: PhysicsEvent[]): void {
        for (const evt of events) {
            switch (evt.type) {
                case 'sfx':
                    AudioManager.getInstance().playSFX(evt.key, { volume: evt.volume });
                    break;
                case 'consume':
                    this.player.inputBuffer.consume(evt.input);
                    break;
                case 'dodge_start':
                    this.player.fsm.changeState(
                        evt.isGrounded ? 'Dodge' : 'AirDodge',
                        this.player
                    );
                    if (evt.isSpot) {
                        this.player.setVisualTint(0xffffff);
                        this.player.spriteObject.setAlpha(PhysicsConfig.SPOT_DODGE_ALPHA);
                    }
                    break;
                case 'dodge_end':
                    this.player.resetVisuals();
                    this.player.spriteObject.setAlpha(1);
                    break;
                case 'recovery_end':
                    this.player.resetVisuals();
                    this.clearRecoveryGhost();
                    break;
                case 'landing':
                    // Landing visuals handled elsewhere (animation system)
                    break;
            }
        }
    }

    // ═══════════════════════════════════════════════════════
    //  PLATFORM INDEX MAPPING
    // ═══════════════════════════════════════════════════════

    private getPlatformIdx(platform: Phaser.GameObjects.Rectangle): number {
        let idx = this.platformMap.get(platform);
        if (idx === undefined) {
            idx = this.nextPlatIdx++;
            this.platformMap.set(platform, idx);
            this.indexToPlatform.set(idx, platform);
        }
        return idx;
    }

    // ═══════════════════════════════════════════════════════
    //  VISUAL EFFECTS (Phaser-only, not in shared physics)
    // ═══════════════════════════════════════════════════════

    public spawnRecoveryGhost(): void {
        const char = this.player.character;
        const facing = this.player.getFacingDirection();
        const scene = this.player.scene as GameSceneInterface;

        const initialFrame = `${char}_up_sig_ghost_000`;
        const animKey = `${char}_up_sig_ghost`;

        let ghost: Phaser.GameObjects.Sprite | null = null;

        if (scene.effectManager) {
            ghost = scene.effectManager.spawnGhost(this.player.x, this.player.y, char, initialFrame, animKey, facing);
        } else {
            ghost = scene.add.sprite(this.player.x, this.player.y, char, initialFrame);
            ghost.setDepth(this.player.depth - 1);
            ghost.play(animKey);
            ghost.setScale(facing, 1);
        }

        if (!ghost) return;

        ghost.setDepth(this.player.depth - 1);

        if (char === 'nock') {
            ghost.setScale(facing * 1.2, 1.2);
        }

        if (scene.uiCamera) {
            scene.uiCamera.ignore(ghost);
        }

        let startX = this.player.x;
        let startY = this.player.y - 30;
        ghost.setAngle(0);
        ghost.setPosition(startX, startY);

        let blurFx: any = null;
        if (ghost.preFX) {
            ghost.preFX.clear();
            ghost.preFX.addGlow(0xffffff, 0.4, 0, false, 0.05, 5);
            blurFx = ghost.preFX.addBlur(0, 0, 0, 1);
        }

        const baseScaleX = (char === 'nock') ? facing * 1.2 : facing;
        const baseScaleY = (char === 'nock') ? 1.2 : 1;
        ghost.setScale(baseScaleX, baseScaleY);

        this.recoveryGhost = ghost;

        scene.tweens.add({
            targets: ghost,
            alpha: 0,
            delay: 150,
            duration: 250,
            onUpdate: () => {
                if (ghost) {
                    // Follow the player during recovery
                    ghost.setPosition(this.player.x, this.player.y - 30);
                }
                if (blurFx && ghost) {
                    blurFx.x = 0.5 + (1 - ghost.alpha) * 3;
                    blurFx.y = 0.5 + (1 - ghost.alpha) * 3;
                }
            },
            onComplete: () => {
                if (this.recoveryGhost === ghost) {
                    this.recoveryGhost = null;
                }
                if (scene.effectManager) {
                    scene.effectManager.releaseGhost(ghost!);
                } else {
                    ghost!.destroy();
                }
            }
        });
    }

    private clearRecoveryGhost(): void {
        const scene = this.player.scene as GameSceneInterface;
        if (this.recoveryGhost) {
            const ghostToClear = this.recoveryGhost;
            this.recoveryGhost = null;

            scene.tweens.add({
                targets: ghostToClear,
                alpha: 0,
                duration: 150,
                onComplete: () => {
                    if (scene.effectManager) {
                        scene.effectManager.releaseGhost(ghostToClear);
                    } else {
                        ghostToClear.destroy();
                    }
                }
            });
        }
    }
}
