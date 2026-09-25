import Phaser from 'phaser';
import { PhysicsConfig } from '../config/PhysicsConfig';
import { InputManager } from '../input/InputManager';
import type { TouchController } from '../components/TouchController';
import { AudioManager } from '../managers/AudioManager';
import type { GameSceneInterface } from '../scenes/GameSceneInterface';
import { PlayerAI } from './player/PlayerAI';
import { AttackDirection, AttackRegistry, AttackType } from '../../shared/AttackData';
import { GHOST_FADE_MS, GHOST_TRAVEL_MS, HURTBOX_HEIGHT, HURTBOX_WIDTH, currentDamage } from '../../shared/Combat';
import { emptyInput, type FighterInput } from '../../shared/FighterInput';
import { isInPlay, type FighterState, type GhostHitbox } from '../../shared/FighterState';
import { SIM_STEP_MS } from '../../shared/FixedStepClock';
import type { MatchState } from '../../shared/GameSim';

export interface PlayerConfig {
    /** Lobby slot: picks the colour, HUD slot and default controls. */
    playerId: number;
    character: string;
    isAI?: boolean;
    isTrainingDummy?: boolean;
    gamepadIndex?: number | null;
    useKeyboard?: boolean;
    keyboardMapping?: 'wasd' | 'arrows' | 'all';
    mappingSlot?: number;
}

const DAMAGE_FLASH_MS = 150;

/**
 * A fighter on screen and the input that drives it. The match simulation owns
 * all gameplay state: `render` draws match.fighters[fighterIndex] each frame,
 * and the scene forwards simulation events for sounds and effects.
 */
export class Player extends Phaser.GameObjects.Container {
    readonly fighterIndex: number;
    readonly playerId: number;
    readonly character: string;
    readonly isAI: boolean;
    /** A CPU that stands still (training). */
    isTrainingDummy: boolean;
    readonly inputType: 'keyboard' | 'gamepad' | 'ai';
    readonly keyboardMapping: 'wasd' | 'arrows' | 'all';

    /** Mirrored from the simulation for the HUD. */
    damagePercent = 0;
    lives = 0;

    private readonly sprite: Phaser.GameObjects.Sprite;
    private readonly nameTag: Phaser.GameObjects.Text;
    private readonly hurtboxRect: Phaser.GameObjects.Rectangle;
    private hitboxRect: Phaser.GameObjects.Rectangle | null = null;
    private damageLabel: Phaser.GameObjects.Text | null = null;
    private showDebug = false;

    private readonly inputManager: InputManager | null;
    private readonly ai: PlayerAI | null;
    private currentInput: FighterInput = emptyInput();

    /** Set during cutscenes and the victory pose: shown instead of the state's animation, even out of play. */
    private pose: string | null = null;

    private damageFlashMs = 0;
    private isCharging = false;
    private chargeGhost: Phaser.GameObjects.Sprite | null = null;
    private chargeBlurFx: Phaser.FX.Blur | null = null;
    private chargeSounds: Phaser.Sound.BaseSound[] = [];
    private isRecovering = false;
    private recoveryGhost: Phaser.GameObjects.Sprite | null = null;

    constructor(scene: Phaser.Scene, fighter: FighterState, config: PlayerConfig, touchController?: TouchController) {
        super(scene, fighter.body.x, fighter.body.y);

        this.fighterIndex = fighter.id;
        this.playerId = config.playerId;
        this.character = config.character;
        this.isAI = config.isAI ?? false;
        this.isTrainingDummy = config.isTrainingDummy ?? false;
        this.keyboardMapping = config.keyboardMapping ?? 'all';

        this.sprite = scene.add.sprite(0, 0, this.character, `${this.character}_idle_000`);
        this.add(this.sprite);
        // Above the stage platforms (depth 0); ghosts sit at depth - 1
        this.setDepth(10);

        this.nameTag = scene.add.text(0, -100, this.isAI ? `CPU ${this.playerId + 1}` : this.character.toUpperCase(), {
            fontSize: '18px',
            fontFamily: '"Pixeloid Sans"',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4,
        });
        this.nameTag.setOrigin(0.5);
        this.nameTag.setVisible(false);
        this.add(this.nameTag);

        this.hurtboxRect = scene.add.rectangle(0, 0, HURTBOX_WIDTH, HURTBOX_HEIGHT);
        this.hurtboxRect.setStrokeStyle(2, 0x00ff00);
        this.hurtboxRect.setFillStyle(0x00ff00, 0.2);
        this.hurtboxRect.setVisible(false);
        this.add(this.hurtboxRect);

        if (this.isAI) {
            this.inputType = 'ai';
            this.inputManager = null;
            this.ai = new PlayerAI(this.fighterIndex);
        } else {
            const useKeyboard = config.useKeyboard ?? this.playerId === 0;
            const gamepadIndex = config.gamepadIndex ?? null;
            this.inputType = gamepadIndex !== null && !useKeyboard ? 'gamepad' : 'keyboard';
            this.inputManager = new InputManager(scene, {
                playerId: this.playerId,
                useKeyboard,
                gamepadIndex,
                enableGamepad: gamepadIndex !== null,
                keyboardMapping: this.keyboardMapping as 'all' | undefined,
                mappingSlot: config.mappingSlot ?? 0,
            }, touchController);
            this.ai = null;
        }

        scene.add.existing(this);
    }

    public get spriteObject(): Phaser.GameObjects.Sprite {
        return this.sprite;
    }

    public setColor(color: number): void {
        this.nameTag.setColor('#' + color.toString(16).padStart(6, '0'));
    }

    // ─── Input ───

    /** This step's input: the controller's, the CPU's, or none for a training dummy. */
    public readInput(match: MatchState): FighterInput {
        if (this.ai) {
            this.currentInput = this.isTrainingDummy ? emptyInput() : this.ai.update(match, SIM_STEP_MS);
        } else {
            this.currentInput = this.inputManager!.poll();
        }
        return this.currentInput;
    }

    public getCurrentInput(): FighterInput {
        return this.currentInput;
    }

    public isGamepadConnected(): boolean {
        return this.inputManager?.isGamepadConnected() ?? false;
    }

    // ─── Drawing ───

    public render(match: MatchState, deltaMs: number): void {
        const f = match.fighters[this.fighterIndex];
        const inPlay = isInPlay(f);
        this.damagePercent = f.damagePercent;
        this.lives = f.lives;

        this.setPosition(f.body.x, f.body.y);
        this.setVisible(inPlay || this.pose !== null);

        this.updateCharge(f, inPlay);
        this.updateRecoveryGhost(f, inPlay);
        this.updateFacing(f);
        this.updateAnimation(f);
        this.updateAlpha(f);

        if (this.damageFlashMs > 0) {
            this.damageFlashMs -= deltaMs;
            if (this.damageFlashMs <= 0) this.sprite.clearTint();
        }

        if (this.showDebug) this.drawHitbox(f, inPlay);
    }

    /** Holds an animation (cutscenes, victory) until cleared with null. */
    public setPose(animation: string | null): void {
        this.pose = animation;
    }

    public setDebug(visible: boolean): void {
        this.showDebug = visible;
        this.hurtboxRect.setVisible(visible);
        this.nameTag.setVisible(visible);
        if (!visible) {
            this.hitboxRect?.setVisible(false);
            this.damageLabel?.setVisible(false);
        }
    }

    private updateFacing(f: FighterState): void {
        // Knockback doesn't turn the sprite
        if (f.isHitStunned) return;
        const c = f.combat;
        const facing = f.body.facingDirection;
        // The ground pound frames are drawn facing the other way
        const groundPoundPose = c.isGroundPounding || c.isGroundPoundLanding || isGroundPoundCharge(f);
        this.sprite.setFlipX(groundPoundPose ? facing > 0 : facing < 0);
    }

    private updateAnimation(f: FighterState): void {
        const key = this.pose ?? animationFor(f);
        this.playAnim(key);

        // The run cycle speeds up with running speed
        this.sprite.anims.timeScale = key === 'run' && f.body.isRunning ? 0.8 + Math.abs(f.body.vx) / 3000 : 1;

        if (this.pose === null && isGroundPoundCharge(f)) {
            this.sprite.setFrame(`${this.character}_ground_pound_000`);
        }
    }

    private updateAlpha(f: FighterState): void {
        const b = f.body;
        if (f.invulnerabilityTimer > 0) {
            // Respawn invulnerability blinks, except while dashing
            const isDashing = f.isDodging && Math.abs(b.vx) > 10;
            const blinkOff = Math.floor(f.invulnerabilityTimer / 50) % 2 === 0;
            this.sprite.setAlpha(!isDashing && blinkOff ? 0.5 : 1);
        } else {
            this.sprite.setAlpha(b.isSpotDodging ? PhysicsConfig.SPOT_DODGE_ALPHA : 1);
        }
    }

    private playAnim(key: string): void {
        const fullKey = `${this.character}_${key}`;
        if (this.sprite.anims.currentAnim?.key === fullKey) return;
        if (!this.scene.anims.exists(fullKey)) {
            console.warn(`[Player ${this.playerId}] Animation missing: ${fullKey}`);
            return;
        }
        this.sprite.anims.play(fullKey, true);
    }

    private drawHitbox(f: FighterState, inPlay: boolean): void {
        const hitbox = f.combat.hitbox;
        const active = inPlay && hitbox.active;
        if (active && !this.hitboxRect) {
            this.hitboxRect = this.scene.add.rectangle(0, 0, hitbox.w, hitbox.h, 0xff0000, 0.3);
            this.hitboxRect.setStrokeStyle(2, 0xff0000);
            this.hitboxRect.setDepth(999);
            this.damageLabel = this.scene.add.text(0, 0, '', {
                fontSize: '14px',
                color: '#ff0000',
                backgroundColor: '#ffffff',
                padding: { x: 2, y: 2 },
            });
            this.damageLabel.setDepth(100);
            this.ignoreInUiCamera(this.hitboxRect);
            this.ignoreInUiCamera(this.damageLabel);
        }
        if (!this.hitboxRect || !this.damageLabel) return;

        this.hitboxRect.setVisible(active);
        this.damageLabel.setVisible(active);
        if (!active) return;
        this.hitboxRect.setPosition(hitbox.x, hitbox.y);
        this.hitboxRect.setSize(hitbox.w, hitbox.h);
        this.damageLabel.setText(`${currentDamage(f)}`);
        this.damageLabel.setPosition(hitbox.x, hitbox.y - hitbox.h / 2 - 20);
    }

    // ─── Charge ───

    private updateCharge(f: FighterState, inPlay: boolean): void {
        const c = f.combat;
        const charging = inPlay && c.isCharging;
        if (charging !== this.isCharging) {
            this.isCharging = charging;
            if (charging) this.startChargeSounds();
            else this.endCharge();
        }
        if (!charging) return;

        const chargePercent = Math.min(c.chargeTime / PhysicsConfig.CHARGE_MAX_TIME, 1);
        if (isGroundPoundCharge(f)) {
            this.shakeSprite(chargePercent * 2.5);
            return;
        }

        // Signature charges fade in a ghost in front of the fighter
        if (!this.chargeGhost) this.chargeGhost = this.createChargeGhost();
        const facing = f.body.facingDirection;
        this.chargeGhost.setScale(facing, 1);
        this.chargeGhost.setPosition(
            f.body.x + ghostOffset(this.character) * facing + (Math.random() - 0.5),
            f.body.y + (Math.random() - 0.5),
        );
        this.chargeGhost.setAlpha(chargePercent * 0.7);
        if (this.chargeBlurFx) {
            this.chargeBlurFx.x = (1 - chargePercent) * 1.5;
            this.chargeBlurFx.y = (1 - chargePercent) * 1.5;
        }
        this.shakeSprite(chargePercent * 1.5);
    }

    private createChargeGhost(): Phaser.GameObjects.Sprite {
        const ghost = this.scene.add.sprite(this.x, this.y, this.character, `${this.character}_side_sig_ghost_000`);
        ghost.setDepth(this.depth - 1);
        ghost.setAlpha(0);
        if (ghost.preFX) {
            ghost.preFX.addGlow(0xffffff, 0.4, 0, false, 0.05, 5);
            this.chargeBlurFx = ghost.preFX.addBlur(0, 1.5, 1.5, 1);
        }
        this.ignoreInUiCamera(ghost);
        return ghost;
    }

    private startChargeSounds(): void {
        const keys = this.character === 'pe' ? ['sfx_fight_charge', 'sfx_pe_charge'] : ['sfx_fight_charge'];
        for (const key of keys) {
            const sound = this.scene.sound.add(key, { volume: 0.6, loop: true });
            sound.play();
            this.chargeSounds.push(sound);
        }
    }

    private endCharge(): void {
        this.chargeGhost?.destroy();
        this.chargeGhost = null;
        this.chargeBlurFx = null;
        this.sprite.setPosition(0, 0);

        // Fade the charge hum out
        for (const sound of this.chargeSounds) {
            const stop = () => {
                sound.stop();
                sound.destroy();
            };
            this.scene.tweens.add({ targets: sound, volume: 0, duration: 200, onComplete: stop });
        }
        this.chargeSounds = [];
    }

    private shakeSprite(intensity: number): void {
        this.sprite.setPosition((Math.random() - 0.5) * 2 * intensity, (Math.random() - 0.5) * 2 * intensity);
    }

    // ─── Ghosts ───

    /** A signature attack threw its ghost: it flies out, lingers, then fades. */
    public spawnSignatureGhost(ghost: GhostHitbox): void {
        const char = this.character;
        const kind = ghost.vertical ? 'up' : 'side';
        const sprite = this.effects().spawnGhost(ghost.startX, ghost.startY, char, `${char}_${kind}_sig_ghost_000`, `${char}_${kind}_sig_ghost`, ghost.facing);
        if (!sprite) return;

        const scale = char === 'nock' && ghost.vertical ? 1.2 : 1;
        sprite.setDepth(this.depth - 1);
        sprite.setScale(ghost.facing * scale, scale);
        sprite.setAngle(0);
        sprite.setPosition(ghost.startX, ghost.startY);
        this.ignoreInUiCamera(sprite);
        const blurFx = this.addGhostFx(sprite);

        this.scene.tweens.add({
            targets: sprite,
            ...(ghost.vertical ? { y: ghost.startY - ghost.travel } : { x: ghost.startX + ghost.travel * ghost.facing }),
            duration: GHOST_TRAVEL_MS,
            ease: 'Cubic.easeOut',
        });
        this.scene.tweens.add({
            targets: sprite,
            alpha: 0,
            delay: ghost.lifetime - GHOST_FADE_MS,
            duration: GHOST_FADE_MS,
            onUpdate: () => setGhostBlur(blurFx, sprite),
            onComplete: () => this.effects().releaseGhost(sprite),
        });
    }

    private updateRecoveryGhost(f: FighterState, inPlay: boolean): void {
        const recovering = inPlay && f.body.isRecovering;
        if (recovering === this.isRecovering) return;
        this.isRecovering = recovering;
        if (recovering) this.spawnRecoveryGhost(f.body.facingDirection);
        else this.clearRecoveryGhost();
    }

    /** The recovery move flashes an up-signature ghost that follows the fighter. */
    private spawnRecoveryGhost(facing: number): void {
        const char = this.character;
        const sprite = this.effects().spawnGhost(this.x, this.y, char, `${char}_up_sig_ghost_000`, `${char}_up_sig_ghost`, facing);
        if (!sprite) return;

        const scale = char === 'nock' ? 1.2 : 1;
        sprite.setDepth(this.depth - 1);
        sprite.setScale(facing * scale, scale);
        sprite.setAngle(0);
        sprite.setPosition(this.x, this.y - 30);
        this.ignoreInUiCamera(sprite);
        const blurFx = this.addGhostFx(sprite);
        this.recoveryGhost = sprite;

        this.scene.tweens.add({
            targets: sprite,
            alpha: 0,
            delay: 150,
            duration: 250,
            onUpdate: () => {
                sprite.setPosition(this.x, this.y - 30);
                setGhostBlur(blurFx, sprite);
            },
            onComplete: () => {
                if (this.recoveryGhost === sprite) this.recoveryGhost = null;
                this.effects().releaseGhost(sprite);
            },
        });
    }

    private clearRecoveryGhost(): void {
        const sprite = this.recoveryGhost;
        if (!sprite) return;
        this.recoveryGhost = null;
        this.scene.tweens.killTweensOf(sprite);
        this.scene.tweens.add({
            targets: sprite,
            alpha: 0,
            duration: 150,
            onComplete: () => this.effects().releaseGhost(sprite),
        });
    }

    private addGhostFx(sprite: Phaser.GameObjects.Sprite): Phaser.FX.Blur | null {
        if (!sprite.preFX) return null;
        sprite.preFX.clear();
        sprite.preFX.addGlow(0xffffff, 0.4, 0, false, 0.05, 5);
        return sprite.preFX.addBlur(0, 0, 0, 1);
    }

    // ─── Event feedback ───

    /** Whiff sound for a light attack, signature sound for a released charge. */
    public playAttackSound(attackKey: string, charged: boolean): void {
        const data = AttackRegistry[attackKey];
        let key = 'sfx_sigs_hurt';
        if (charged) key = `sfx_${this.character}_sig`;
        else if (data.type === AttackType.LIGHT) key = data.direction === AttackDirection.RUN ? 'sfx_run_light_miss' : 'sfx_side_light_miss';
        AudioManager.getInstance().playSFX(key, { volume: 0.5, randomPitchRange: 600 });
    }

    /** Impact sound when one of this fighter's moves lands; `attackKey` is null for the recovery move. */
    public playHitSound(attackKey: string | null): void {
        const data = attackKey ? AttackRegistry[attackKey] : null;
        let key = 'sfx_sigs_hurt';
        if (data?.type === AttackType.LIGHT) key = data.direction === AttackDirection.RUN ? 'sfx_run_light_hit' : 'sfx_side_light_hit';
        AudioManager.getInstance().playSFX(key, { volume: 0.6, randomPitchRange: 600 });
    }

    /** Tints the fighter briefly, from white towards red as damage grows. */
    public flashDamage(damage: number): void {
        const stops = [[255, 255, 255], [255, 245, 150], [255, 200, 150], [255, 150, 150]];
        const band = Math.min(Math.floor(damage / 50), 3);
        let color = Phaser.Display.Color.GetColor(255, 150, 150);
        if (band < 3) {
            const [from, to] = [stops[band], stops[band + 1]];
            const c = Phaser.Display.Color.Interpolate.ColorWithColor(
                new Phaser.Display.Color(from[0], from[1], from[2]),
                new Phaser.Display.Color(to[0], to[1], to[2]),
                50,
                damage - band * 50,
            );
            color = Phaser.Display.Color.GetColor(c.r, c.g, c.b);
        }
        this.sprite.setTint(color);
        this.damageFlashMs = DAMAGE_FLASH_MS;
    }

    // ─── Scene helpers ───

    private effects() {
        return (this.scene as GameSceneInterface).effectManager;
    }

    private ignoreInUiCamera(object: Phaser.GameObjects.GameObject): void {
        (this.scene as GameSceneInterface).uiCamera?.ignore(object);
    }

    public destroy(fromScene?: boolean): void {
        this.inputManager?.destroy();
        for (const sound of this.chargeSounds) sound.destroy();
        this.chargeSounds = [];
        this.chargeGhost?.destroy();
        this.hitboxRect?.destroy();
        this.damageLabel?.destroy();
        super.destroy(fromScene);
    }
}

function isGroundPoundCharge(f: FighterState): boolean {
    const c = f.combat;
    return c.isCharging && c.chargeDirection === AttackDirection.DOWN && !f.body.isGrounded;
}

/** Signature ghosts start this far in front of the fighter. */
function ghostOffset(character: string): number {
    return character === 'nock' ? 35 : 25;
}

/** Ghosts blur as they fade. */
function setGhostBlur(blurFx: Phaser.FX.Blur | null, sprite: Phaser.GameObjects.Sprite): void {
    if (!blurFx) return;
    blurFx.x = 0.5 + (1 - sprite.alpha) * 3;
    blurFx.y = 0.5 + (1 - sprite.alpha) * 3;
}

/** The animation for a fighter's state. */
function animationFor(f: FighterState): string {
    switch (f.state) {
        case 'Run': return 'run';
        case 'Jump': return 'jump';
        case 'Fall': return 'fall';
        case 'WallSlide': return 'wall_slide';
        case 'Attack': return attackAnimation(f);
        case 'Charging': return 'charging';
        case 'HitStun': return 'hurt';
        case 'Dodge':
        case 'AirDodge': return Math.abs(f.body.vx) > 10 ? 'dash' : 'spot_dodge';
        case 'Recovery': return 'recovery';
        case 'GroundPound': return 'ground_pound';
        case 'Taunt': return 'taunt';
        case 'Defeat': return 'defeat';
        default: return 'idle';
    }
}

function attackAnimation(f: FighterState): string {
    const attack = f.combat.attack;
    if (!attack) return 'idle';
    const { type, direction } = AttackRegistry[attack.key];
    const grounded = f.body.isGrounded;

    if (type === AttackType.HEAVY) {
        switch (direction) {
            case AttackDirection.DOWN: return 'attack_heavy_down';
            case AttackDirection.SIDE: return 'attack_heavy_side';
            case AttackDirection.UP: return 'attack_heavy_up';
            default: return 'attack_heavy_neutral';
        }
    }
    switch (direction) {
        case AttackDirection.RUN: return 'attack_light_run';
        case AttackDirection.UP: return grounded ? 'attack_light_up' : 'attack_light_up_air';
        case AttackDirection.DOWN: return 'attack_light_down';
        case AttackDirection.SIDE: return grounded ? 'attack_light_side' : 'attack_light_side_air';
        default: return 'attack_light_neutral';
    }
}
