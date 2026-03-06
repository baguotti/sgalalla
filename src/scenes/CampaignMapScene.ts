import Phaser from 'phaser';
import { CampaignManager } from '../managers/CampaignManager';
import { ISLAND_NAMES } from '../data/CampaignIslandData';
import { charConfigs, ANIM_FRAME_RATES } from '../config/CharacterConfig';
import { AudioManager } from '../managers/AudioManager';
import { getConfirmButtonIndex, getMenuNavX } from '../input/JoyConMapper';

interface IslandNode {
    x: number;
    y: number;
    character: string;       // Opponent character key
    revealed: boolean;       // Name & color visible
    defeated: boolean;       // Player has beaten this opponent
    container: Phaser.GameObjects.Container;  // Container for floating animation
    icon: Phaser.GameObjects.Sprite;
    label: Phaser.GameObjects.Text;
}

/**
 * Super Mario World-style campaign minimap.
 * Player moves between floating islands in a black void.
 * Each island represents an opponent fight.
 */
export class CampaignMapScene extends Phaser.Scene {
    private islands: IslandNode[] = [];
    private playerSprite!: Phaser.GameObjects.Sprite;
    private playerCharKey: string = 'fok';
    private currentIslandIndex: number = 0;
    private isMoving: boolean = false;
    private canInput: boolean = false;

    private playerData: any[] = [];
    private slotIndex: number = 0;

    // Gamepad edge detection
    private prevGamepadA: Map<number, boolean> = new Map();
    private lastGamepadInputTime: number = 0;

    // Path lines
    private pathGraphics!: Phaser.GameObjects.Graphics;

    // Island visual config
    private static readonly ISLAND_SIZE = 240;
    private static readonly ISLAND_SPACING = 450;
    private static readonly BASE_Y = 620;     // Path line Y (where player walks)
    private static readonly ISLAND_FLOAT_OFFSET = 220; // How far islands float above the path
    private static readonly START_X = 250;    // Left margin

    constructor() {
        super({ key: 'CampaignMapScene' });
    }

    preload() {
        // Load assets for the map
        this.load.image('island_adria', 'assets/images/island_adria.png');
    }

    init(data: Record<string, any>) {
        this.playerData = data.playerData || [];
        this.slotIndex = data.slotIndex ?? CampaignManager.getInstance().getActiveSlotIndex();
        this.islands = [];
        this.currentIslandIndex = 0;
        this.isMoving = false;
        this.canInput = false;
        this.prevGamepadA.clear();
    }

    create() {
        const { width, height } = this.scale;
        const campaign = CampaignManager.getInstance();

        // Background image
        const bg = this.add.image(width / 2, height / 2, 'minimap_bg').setScrollFactor(0);
        bg.setTint(0x666666); // Subtle dark tint
        const scaleX = width / bg.width;
        const scaleY = height / bg.height;
        const scale = Math.max(scaleX, scaleY);
        bg.setScale(scale);

        // Elegant 16-bit rounded rectangle frame
        const framePadding = 20;
        const frameGraphics = this.add.graphics().setScrollFactor(0).setDepth(100);
        
        // Outer border (dark)
        frameGraphics.lineStyle(6, 0x111111, 1);
        frameGraphics.strokeRoundedRect(framePadding, framePadding, width - framePadding * 2, height - framePadding * 2, 20);
        
        // Main frame (light highlight)
        frameGraphics.lineStyle(3, 0xdddddd, 0.8);
        frameGraphics.strokeRoundedRect(framePadding + 3, framePadding + 3, width - (framePadding + 3) * 2, height - (framePadding + 3) * 2, 17);
        
        // Bevel effect (inner shadow)
        frameGraphics.lineStyle(2, 0x000000, 0.3);
        frameGraphics.strokeRoundedRect(framePadding + 6, framePadding + 6, width - (framePadding + 6) * 2, height - (framePadding + 6) * 2, 14);

        // Glassy overlay hint (very subtle)
        frameGraphics.fillStyle(0xffffff, 0.02);
        frameGraphics.fillRoundedRect(framePadding, framePadding, width - framePadding * 2, height - framePadding * 2, 20);

        // Determine player character from playerData
        const selectedChar = this.playerData[0]?.character || 'fok';

        // Initialize campaign if needed (was previously done in GameScene.create)
        if (campaign.hasActiveCampaign() && campaign.getPlayerCharacter() !== selectedChar) {
            campaign.resetCampaign();
        }
        if (!campaign.hasActiveCampaign()) {
            campaign.startNewCampaign(selectedChar, this.slotIndex);
        }

        this.playerCharKey = campaign.getPlayerCharacter();

        // Ensure idle & run animations exist
        this.ensureAnimations();

        // Build island nodes from the campaign ladder
        const ladder = campaign.ladder;
        const currentLevel = (campaign as any).currentData?.currentLevel ?? 0;

        // Calculate layout - center the islands horizontally
        const totalWidth = (ladder.length - 1) * CampaignMapScene.ISLAND_SPACING;
        const startX = Math.max(CampaignMapScene.START_X, (width - totalWidth) / 2);

        // Set camera bounds
        this.cameras.main.setBounds(0, 0, Math.max(width, startX + totalWidth + CampaignMapScene.START_X), height);

        // Draw path lines first (behind islands)
        this.pathGraphics = this.add.graphics();
        this.pathGraphics.lineStyle(3, 0x333333, 0.6);

        for (let i = 0; i < ladder.length; i++) {
            const opponent = ladder[i];
            const ix = startX + i * CampaignMapScene.ISLAND_SPACING;
            // Slight vertical stagger for visual interest
            const iy = CampaignMapScene.BASE_Y + Math.sin(i * 1.2) * 30;

            const defeated = i < currentLevel;
            const revealed = defeated; // Previously defeated = revealed

            // Draw a subtle, professional path of stars to the next island
            if (i < ladder.length - 1) {
                const nextX = startX + (i + 1) * CampaignMapScene.ISLAND_SPACING;
                const nextY = CampaignMapScene.BASE_Y + Math.sin((i + 1) * 1.2) * 30;
                
                const dist = Phaser.Math.Distance.Between(ix, iy, nextX, nextY);
                const starSpacing = 45; // Pixels between stars
                const numStars = Math.floor(dist / starSpacing);
                
                for (let j = 1; j < numStars; j++) {
                    const t = j / numStars;
                    const starX = Phaser.Math.Interpolation.Linear([ix, nextX], t);
                    const starY = Phaser.Math.Interpolation.Linear([iy, nextY], t);
                    
                    // Draw a subtle 16-bit star (a small cross with a bright center)
                    this.pathGraphics.fillStyle(0xaaaaaa, 0.4);
                    this.pathGraphics.fillRect(starX - 1, starY - 3, 2, 6);
                    this.pathGraphics.fillRect(starX - 3, starY - 1, 6, 2);
                    this.pathGraphics.fillStyle(0xffffff, 0.7);
                    this.pathGraphics.fillRect(starX - 1, starY - 1, 2, 2);
                }
            }
            // Island container — floats ABOVE the path line
            const islandY = iy - CampaignMapScene.ISLAND_FLOAT_OFFSET;
            const container = this.add.container(ix, islandY);

            // Island icon (placeholder Adria icon)
            const icon = this.add.sprite(0, 0, 'island_adria').setDisplaySize(CampaignMapScene.ISLAND_SIZE, CampaignMapScene.ISLAND_SIZE);
            
            // Silhouette effect: tint black if not revealed
            if (!revealed) {
                icon.setTint(0x000000);
            }
            container.add(icon);

            // Label (name or ???)
            const displayName = revealed ? (ISLAND_NAMES[opponent.character] || opponent.character) : '???';
            // Position above the icon, closer (lowered by 30px)
            const label = this.add.text(0, -CampaignMapScene.ISLAND_SIZE / 2 + 15, displayName, {
                fontSize: '24px',
                fontFamily: '"Pixeloid Sans"',
                color: revealed ? '#ffffff' : '#666666',
                align: 'center'
            }).setOrigin(0.5);
            container.add(label);

            // Floating hover animation — each island bobs at a slightly different phase
            this.tweens.add({
                targets: container,
                y: islandY - 10,
                duration: 1200 + i * 100,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
                delay: i * 150
            });

            this.islands.push({
                x: ix,
                y: iy,
                character: opponent.character,
                revealed,
                defeated,
                container,
                icon,
                label
            });
        }

        // Set player starting position
        // Start player on the most recently defeated island, unless returning from defeat/training where currentLevel wasn't advanced
        // Actually, just always start on Math.max(0, currentLevel - 1) so player has to manually move right to the new challenge.
        // Wait, if they just started a new save, currentLevel is 0.
        // If they just beat level 0, currentLevel is 1. We want to spawn on 0.
        this.currentIslandIndex = Math.max(0, currentLevel - 1); // Position on the next target

        // Clamp to valid range
        this.currentIslandIndex = Math.min(this.currentIslandIndex, this.islands.length - 1);

        // Create player character sprite — walks ON the path line
        const startIsland = this.islands[this.currentIslandIndex];
        const idleFrame = `${this.playerCharKey}_idle_000`;
        this.playerSprite = this.add.sprite(
            startIsland.x,
            startIsland.y - 30, // Slight offset so feet touch the line
            this.playerCharKey,
            idleFrame
        ).setScale(0.9);

        // Play idle animation
        const idleAnim = `${this.playerCharKey}_idle`;
        if (this.anims.exists(idleAnim)) {
            this.playerSprite.play(idleAnim);
        }

        // Center camera on player and follow
        this.cameras.main.startFollow(this.playerSprite, true, 0.08, 0.08);

        // Title text always visible
        this.add.text(width / 2, 60, 'ROAD TO LAMICIZIA', {
            fontSize: '48px',
            fontFamily: '"Pixeloid Sans"',
            color: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5).setScrollFactor(0);

        // Player UI (Bottom Left)
        const uiPaddingX = framePadding + 10;
        const uiPaddingY = height - framePadding - 3; // Align flush with the bottom inner frame
        
        const playerIconFrame = `00_${this.playerCharKey}_icon`;
        const playerIcon = this.add.sprite(uiPaddingX, uiPaddingY, this.playerCharKey, playerIconFrame)
            .setOrigin(0, 1)
            .setScale(0.7)
            .setScrollFactor(0)
            .setDepth(105);

        const playerName = this.playerCharKey === 'pe' ? 'PÈ' : this.playerCharKey.toUpperCase();
        this.add.text(uiPaddingX + playerIcon.displayWidth * 0.75, uiPaddingY - 25, playerName, {
            fontSize: '32px',
            fontFamily: '"Pixeloid Sans"',
            color: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0, 1).setScrollFactor(0).setDepth(105);

        if (currentLevel === 0) {
            // Instructions only on fresh campaign
            const instrText = this.add.text(width / 2, height - 50, '◀ ▶  Muoviti   |   [A] / [SPAZIO]  Entra', {
                fontSize: '22px',
                fontFamily: '"Pixeloid Sans"',
                color: '#888888'
            }).setOrigin(0.5).setScrollFactor(0);

            this.tweens.add({
                targets: instrText,
                alpha: { from: 1, to: 0.4 },
                duration: 1200,
                yoyo: true,
                repeat: -1
            });
        }

        // Fade in
        this.cameras.main.fadeIn(800, 0, 0, 0);

        // Input safety delay
        this.time.delayedCall(600, () => {
            this.canInput = true;
        });

        // Initial visual update
        this.updateIslandVisuals();

        // Cleanup
        this.events.once('shutdown', () => {
            if (this.input.gamepad && Array.isArray(this.input.gamepad.gamepads)) {
                // @ts-ignore
                this.input.gamepad.gamepads = this.input.gamepad.gamepads.filter((p: any) => !!p);
            }
        });
    }

    update() {
        this.pollGamepadEdge();
        if (!this.canInput || this.isMoving) return;

        // --- Keyboard Input ---
        const leftKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT, false);
        const rightKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT, false);
        const aKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.A, false);
        const dKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.D, false);
        const spaceKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE, false);
        const enterKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER, false);
        const escKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC, false);

        if ((leftKey && Phaser.Input.Keyboard.JustDown(leftKey)) || (aKey && Phaser.Input.Keyboard.JustDown(aKey))) {
            this.movePlayer(-1);
        } else if ((rightKey && Phaser.Input.Keyboard.JustDown(rightKey)) || (dKey && Phaser.Input.Keyboard.JustDown(dKey))) {
            this.movePlayer(1);
        } else if ((spaceKey && Phaser.Input.Keyboard.JustDown(spaceKey)) || (enterKey && Phaser.Input.Keyboard.JustDown(enterKey))) {
            this.enterIsland();
        } else if (escKey && Phaser.Input.Keyboard.JustDown(escKey)) {
            this.goBack();
        }

        // --- Gamepad Input ---
        this.handleGamepad();
    }

    private pollGamepadEdge(): void {
        const gamepads = navigator.getGamepads();
        for (let i = 0; i < gamepads.length; i++) {
            const pad = gamepads[i];
            if (!pad) continue;
            const confirmIdx = getConfirmButtonIndex(pad);
            const aPressed = pad.buttons[confirmIdx]?.pressed || false;
            if (!this.canInput) {
                this.prevGamepadA.set(pad.index, aPressed);
            }
        }
    }

    private handleGamepad(): void {
        const gamepads = navigator.getGamepads();
        const now = Date.now();
        if (now - this.lastGamepadInputTime < 200) return;

        for (let i = 0; i < gamepads.length; i++) {
            const pad = gamepads[i];
            if (!pad) continue;

            const navX = getMenuNavX(pad);
            if (navX < 0) {
                this.movePlayer(-1);
                this.lastGamepadInputTime = now;
            } else if (navX > 0) {
                this.movePlayer(1);
                this.lastGamepadInputTime = now;
            }

            // A button edge detection
            const confirmIdx = getConfirmButtonIndex(pad);
            const aPressed = pad.buttons[confirmIdx]?.pressed || false;
            const wasA = this.prevGamepadA.get(pad.index) ?? false;
            this.prevGamepadA.set(pad.index, aPressed);
            if (aPressed && !wasA) {
                this.enterIsland();
                this.lastGamepadInputTime = now;
            }
        }
    }

    private movePlayer(dir: number): void {
        const targetIndex = this.currentIslandIndex + dir;

        // Can't move before first island
        if (targetIndex < 0) return;

        // Can't move past the current target (undefeated) island
        const campaign = CampaignManager.getInstance();
        const currentLevel = (campaign as any).currentData?.currentLevel ?? 0;
        if (targetIndex > currentLevel) return;

        // Can't move beyond last island
        if (targetIndex >= this.islands.length) return;

        AudioManager.getInstance().playSFX('ui_menu_hover', { volume: 0.5 });

        this.isMoving = true;
        this.currentIslandIndex = targetIndex;
        const target = this.islands[targetIndex];

        // Play run animation
        const runAnim = `${this.playerCharKey}_run`;
        if (this.anims.exists(runAnim)) {
            this.playerSprite.play(runAnim);
        }

        // Flip sprite based on movement direction
        this.playerSprite.setFlipX(dir < 0);

        // Tween player to target island position (on the path line)
        this.tweens.add({
            targets: this.playerSprite,
            x: target.x,
            y: target.y - 30,
            duration: 400,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                this.isMoving = false;
                // Return to idle
                const idleAnim = `${this.playerCharKey}_idle`;
                if (this.anims.exists(idleAnim)) {
                    this.playerSprite.play(idleAnim);
                }
                this.playerSprite.setFlipX(false);
                this.updateIslandVisuals();
            }
        });
    }

    private updateIslandVisuals(): void {
        for (let i = 0; i < this.islands.length; i++) {
            const island = this.islands[i];
            
            if (!island.revealed) continue; // Keep ??? style

            if (i === this.currentIslandIndex) {
                // Standing on this island — make text glow (subtle)
                island.label.setColor('#ffffff');
                island.label.setStroke('#ffffff', 1);
                island.label.setShadow(0, 0, '#ffffff', 4, false, true);
            } else {
                // Dimmer, no glow
                island.label.setColor('#dddddd');
                island.label.setStroke('#000000', 0);
                island.label.setShadow(0, 0, '#000000', 0, false, false);
            }
        }
    }

    private enterIsland(): void {
        const island = this.islands[this.currentIslandIndex];
        const campaign = CampaignManager.getInstance();
        const currentLevel = (campaign as any).currentData?.currentLevel ?? 0;

        AudioManager.getInstance().playSFX('ui_confirm', { volume: 0.5 });
        this.canInput = false;

        if (this.currentIslandIndex === currentLevel) {
            // New fight
            if (!island.revealed) {
                // Reveal animation: silhouette → colored + name appears
                this.revealIsland(island, () => {
                    this.transitionToFight(false);
                });
            } else {
                this.transitionToFight(false);
            }
        } else if (this.currentIslandIndex < currentLevel) {
            // Training fight
            this.promptTrainingDialogue(island);
        }
    }

    private promptTrainingDialogue(island: IslandNode): void {
        const charKey = island.character;
        const campaign = CampaignManager.getInstance();
        const opponentIndex = this.currentIslandIndex;
        const opponent = campaign.ladder[opponentIndex];

        // Get training prompt text from dialogue data
        const promptLines = opponent?.dialogueTrainingPrompt ?? [];
        const promptText = promptLines.length > 0
            ? promptLines[0].text
            : 'Want to train here?';
        const speakerName = promptLines.length > 0
            ? promptLines[0].speaker
            : (ISLAND_NAMES[charKey] || charKey);

        // Build inline prompt UI
        const { width, height } = this.scale;

        // Darken overlay
        const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6)
            .setScrollFactor(0).setDepth(50);

        // Dialogue box
        const boxWidth = width * 0.7;
        const boxHeight = 200;
        const boxX = width / 2;
        const boxY = height - boxHeight - 50; // Match DialogueScene: 50px from bottom

        const box = this.add.graphics().setScrollFactor(0).setDepth(51);
        box.fillStyle(0x1a1a1a, 0.9);
        box.fillRoundedRect(boxX - boxWidth / 2, boxY - boxHeight / 2, boxWidth, boxHeight, 16);
        box.lineStyle(3, 0x444444);
        box.strokeRoundedRect(boxX - boxWidth / 2, boxY - boxHeight / 2, boxWidth, boxHeight, 16);

        // Opponent icon — matches DialogueScene right portrait positioning
        const boxRight = boxX + boxWidth / 2;
        const portraitY = boxY - boxHeight / 2 - 256; // bottom of icon aligns with top of box
        const iconFrame = `00_${charKey}_icon`;
        const iconSprite = this.add.sprite(boxRight - 256, portraitY, charKey, iconFrame)
            .setScale(2)
            .setFlipX(true)
            .setScrollFactor(0).setDepth(52);

        // Speaker name below the icon — matches DialogueScene exactly
        const nameText = this.add.text(boxRight - 256, portraitY + (iconSprite.displayHeight / 2) - 5, speakerName, {
            fontFamily: '"Pixeloid Sans"',
            fontSize: '32px',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(52);

        // Prompt text
        const msgText = this.add.text(boxX, boxY - 30, promptText, {
            fontFamily: '"Pixeloid Sans"',
            fontSize: '24px',
            color: '#ffffff',
            wordWrap: { width: boxWidth - 60 },
            align: 'center'
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(52);

        // YES / NO buttons
        const btnY = boxY + boxHeight / 2 - 40;
        const yesBtn = this.add.text(boxX - 80, btnY, 'YES', {
            fontFamily: '"Pixeloid Sans"',
            fontSize: '32px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0).setDepth(52);

        const noBtn = this.add.text(boxX + 80, btnY, 'NO', {
            fontFamily: '"Pixeloid Sans"',
            fontSize: '32px',
            color: '#888888',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0).setDepth(52);

        let selectedIndex = 0; // 0 = YES, 1 = NO
        const allUI: Phaser.GameObjects.GameObject[] = [overlay, box, iconSprite, nameText, msgText, yesBtn, noBtn];

        const updateHighlight = () => {
            if (selectedIndex === 0) {
                yesBtn.setColor('#ffffff').setScale(1.1);
                noBtn.setColor('#888888').setScale(1.0);
            } else {
                yesBtn.setColor('#888888').setScale(1.0);
                noBtn.setColor('#ffffff').setScale(1.1);
            }
        };

        const cleanup = () => {
            allUI.forEach(obj => obj.destroy());
            this.input.keyboard?.off('keydown-LEFT', onLeft);
            this.input.keyboard?.off('keydown-RIGHT', onRight);
            this.input.keyboard?.off('keydown-A', onLeft);
            this.input.keyboard?.off('keydown-D', onRight);
            this.input.keyboard?.off('keydown-SPACE', onConfirm);
            this.input.keyboard?.off('keydown-ENTER', onConfirm);
        };

        const onLeft = () => { selectedIndex = 0; updateHighlight(); };
        const onRight = () => { selectedIndex = 1; updateHighlight(); };
        const onConfirm = () => {
            cleanup();
            if (selectedIndex === 0) {
                // YES — start training fight
                this.transitionToFight(true);
            } else {
                // NO — delay re-enabling input so the same Space press
                // doesn't immediately re-trigger enterIsland()
                this.time.delayedCall(300, () => {
                    this.canInput = true;
                });
            }
        };

        this.input.keyboard?.on('keydown-LEFT', onLeft, this);
        this.input.keyboard?.on('keydown-RIGHT', onRight, this);
        this.input.keyboard?.on('keydown-A', onLeft, this);
        this.input.keyboard?.on('keydown-D', onRight, this);

        // Delay confirm listener registration so the Space/Enter that opened
        // this prompt doesn't immediately trigger onConfirm
        this.time.delayedCall(200, () => {
            this.input.keyboard?.on('keydown-SPACE', onConfirm, this);
            this.input.keyboard?.on('keydown-ENTER', onConfirm, this);
        });

        // Mouse/touch support
        yesBtn.setInteractive();
        noBtn.setInteractive();
        yesBtn.on('pointerover', () => { selectedIndex = 0; updateHighlight(); });
        noBtn.on('pointerover', () => { selectedIndex = 1; updateHighlight(); });
        yesBtn.on('pointerdown', () => { selectedIndex = 0; onConfirm(); });
        noBtn.on('pointerdown', () => { selectedIndex = 1; onConfirm(); });

        updateHighlight();
    }

    private revealIsland(island: IslandNode, onComplete: () => void): void {
        island.revealed = true;

        // Silhouette reveal: transition tint from black to white/color
        const counter = { t: 0 };
        this.tweens.add({
            targets: counter,
            t: 1,
            duration: 800,
            ease: 'Quad.easeOut',
            onUpdate: () => {
                const t = counter.t;
                // Interpolate from 0x000000 (black) to 0xffffff (white/normal)
                const val = Math.round(t * 255);
                const color = (val << 16) | (val << 8) | val;
                island.icon.setTint(color);
            }
        });

        // Show real name
        const realName = ISLAND_NAMES[island.character] || island.character;
        island.label.setText(realName);
        island.label.setAlpha(0);
        this.tweens.add({
            targets: island.label,
            alpha: 1,
            duration: 600,
            onUpdate: () => {
                island.label.setColor('#ffffff');
            },
            onComplete: () => {
                // Short pause after reveal before entering fight
                this.time.delayedCall(500, onComplete);
            }
        });
    }

    private transitionToFight(isTraining: boolean = false): void {
        // Fade to black then start GameScene
        this.cameras.main.fadeOut(1000, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('GameScene', {
                playerData: this.playerData,
                mode: 'campaign',
                slotIndex: this.slotIndex,
                isTraining: isTraining,
                trainingOpponentIndex: isTraining ? this.currentIslandIndex : undefined
            });
        });
    }

    private goBack(): void {
        AudioManager.getInstance().playSFX('ui_back', { volume: 0.5 });
        this.scene.start('SaveFileScene', { mode: 'campaign' });
    }

    private ensureAnimations(): void {
        const charKey = this.playerCharKey;
        const config = charConfigs[charKey];
        if (!config) return;

        // Idle
        const idleKey = `${charKey}_idle`;
        if (!this.anims.exists(idleKey) && config.idle) {
            const cfg = config.idle;
            const frames: { key: string; frame: string }[] = [];
            for (let f = 0; f < cfg.count; f++) {
                frames.push({ key: charKey, frame: `${cfg.prefix}${String(f).padStart(3, '0')}` });
            }
            this.anims.create({
                key: idleKey,
                frames,
                frameRate: ANIM_FRAME_RATES.DEFAULT,
                repeat: -1
            });
        }

        // Run
        const runKey = `${charKey}_run`;
        if (!this.anims.exists(runKey) && config.run) {
            const cfg = config.run;
            const frames: { key: string; frame: string }[] = [];
            for (let f = 0; f < cfg.count; f++) {
                frames.push({ key: charKey, frame: `${cfg.prefix}${String(f).padStart(3, '0')}` });
            }
            this.anims.create({
                key: runKey,
                frames,
                frameRate: ANIM_FRAME_RATES.RUN,
                repeat: -1
            });
        }
    }
}
