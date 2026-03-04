import Phaser from 'phaser';
import { SaveService } from '../managers/SaveService';
import type { CampaignSaveData } from '../managers/SaveService';
import { CampaignManager } from '../managers/CampaignManager';
import { AudioManager } from '../managers/AudioManager';
import { getConfirmButtonIndex, getBackButtonIndex, getMenuNavY } from '../input/JoyConMapper';
import { charConfigs } from '../config/CharacterConfig';

/**
 * Pokémon-style save file selection screen.
 * Shows 3 slots — occupied ones display character, time, and progress.
 * Empty slots show "NUOVA PARTITA".
 */
export class SaveFileScene extends Phaser.Scene {
    private selectedIndex: number = 0;
    private canInput: boolean = false;
    private initData: Record<string, any> = {};
    private slotContainers: Phaser.GameObjects.Container[] = [];
    private slots: (CampaignSaveData | null)[] = [];

    // Gamepad state
    private prevGamepadA: Map<number, boolean> = new Map();
    private prevGamepadB: Map<number, boolean> = new Map();
    private lastGamepadInputTime: number = 0;

    // Keyboard
    private upKey!: Phaser.Input.Keyboard.Key;
    private downKey!: Phaser.Input.Keyboard.Key;
    private confirmKey!: Phaser.Input.Keyboard.Key;
    private enterKey!: Phaser.Input.Keyboard.Key;
    private backKey!: Phaser.Input.Keyboard.Key;

    // Character labels for display
    private charLabels: Record<string, string> = {
        fok: 'Fok', sgu: 'Sgu', sga: 'Sga',
        pe: 'Pe', nock: 'Nock', greg: 'Greg'
    };

    constructor() {
        super({ key: 'SaveFileScene' });
    }

    init(data: Record<string, any>) {
        this.initData = data || {};
        this.selectedIndex = 0;
        this.canInput = false;
        this.slotContainers = [];
        this.prevGamepadA.clear();
        this.prevGamepadB.clear();
    }

    create() {
        const { width, height } = this.scale;

        // Black background
        this.add.rectangle(0, 0, width, height, 0x000000).setOrigin(0);

        // Title
        this.add.text(width / 2, 100, 'SALVATAGGI', {
            fontSize: '56px',
            fontFamily: '"Pixeloid Sans"',
            color: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Load slots
        this.slots = SaveService.loadAllSlots();

        // Ensure idle animations exist
        this.ensureIdleAnimations();

        // Create 3 slot cards
        const cardWidth = 600;
        const cardHeight = 140;
        const spacing = 30;
        const totalHeight = 3 * cardHeight + 2 * spacing;
        const startY = height / 2 - totalHeight / 2 + 40;

        for (let i = 0; i < 3; i++) {
            const cy = startY + i * (cardHeight + spacing);
            const container = this.add.container(width / 2, cy);

            // Card background
            const card = this.add.graphics();
            card.lineStyle(2, 0x444444);
            card.fillStyle(0x1a1a1a, 0.9);
            card.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 12);
            card.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 12);
            container.add(card);

            // Slot label
            const slotLabel = this.add.text(-cardWidth / 2 + 20, -cardHeight / 2 + 12, `FILE ${i + 1}`, {
                fontSize: '18px',
                fontFamily: '"Pixeloid Sans"',
                color: '#666666'
            });
            container.add(slotLabel);

            const slotData = this.slots[i];

            if (slotData && !slotData.completed) {
                // ─── Occupied Slot ───
                // Character sprite
                const charKey = slotData.playerCharacter || 'fok';
                const animKey = `${charKey}_idle`;
                const config = charConfigs[charKey as keyof typeof charConfigs];
                let frameKey = `${charKey}_idle_000`;
                if (config?.idle) {
                    frameKey = `${config.idle.prefix}000`;
                }

                const sprite = this.add.sprite(-cardWidth / 2 + 90, 10, charKey, frameKey);
                sprite.setScale(0.8);
                if (this.anims.exists(animKey)) {
                    sprite.play(animKey);
                }
                container.add(sprite);

                // Character name
                const charName = this.charLabels[charKey] || charKey.toUpperCase();
                const nameText = this.add.text(-cardWidth / 2 + 160, -20, charName, {
                    fontSize: '32px',
                    fontFamily: '"Pixeloid Sans"',
                    color: '#FFFFFF',
                    fontStyle: 'bold'
                });
                container.add(nameText);

                // Progress
                const progress = `${slotData.currentLevel}/${slotData.ladderOrder?.length ?? 6}`;
                const progressText = this.add.text(-cardWidth / 2 + 160, 20, `Avversari sconfitti: ${progress}`, {
                    fontSize: '20px',
                    fontFamily: '"Pixeloid Sans"',
                    color: '#aaaaaa'
                });
                container.add(progressText);

                // Time played
                const timeStr = this.formatPlayTime(slotData.playTimeMs || 0);
                const timeText = this.add.text(cardWidth / 2 - 20, 20, timeStr, {
                    fontSize: '20px',
                    fontFamily: '"Pixeloid Sans"',
                    color: '#888888'
                }).setOrigin(1, 0);
                container.add(timeText);
            } else {
                // ─── Empty Slot ───
                const emptyText = this.add.text(0, 5, 'NUOVA PARTITA', {
                    fontSize: '28px',
                    fontFamily: '"Pixeloid Sans"',
                    color: '#666666'
                }).setOrigin(0.5);
                container.add(emptyText);
            }

            // Selection indicator (arrow)
            const arrow = this.add.text(-cardWidth / 2 - 30, 0, '▶', {
                fontSize: '28px',
                fontFamily: '"Pixeloid Sans"',
                color: '#FFFFFF'
            }).setOrigin(0.5);
            container.add(arrow);
            container.setData('arrow', arrow);
            container.setData('card', card);

            this.slotContainers.push(container);
        }

        this.updateSelection();

        // Input safety delay
        this.time.delayedCall(400, () => {
            this.canInput = true;
            this.upKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
            this.downKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
            this.confirmKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
            this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
            this.backKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        });

        // Cleanup
        this.events.once('shutdown', () => {
            if (this.input.gamepad && Array.isArray(this.input.gamepad.gamepads)) {
                // @ts-ignore
                this.input.gamepad.gamepads = this.input.gamepad.gamepads.filter((p: any) => !!p);
            }
        });
    }

    update() {
        // Poll gamepad states
        this.pollGamepadEdge();

        if (!this.canInput) return;

        // Keyboard
        if (Phaser.Input.Keyboard.JustDown(this.upKey)) {
            this.changeSelection(-1);
        } else if (Phaser.Input.Keyboard.JustDown(this.downKey)) {
            this.changeSelection(1);
        } else if (Phaser.Input.Keyboard.JustDown(this.confirmKey) || Phaser.Input.Keyboard.JustDown(this.enterKey)) {
            this.selectSlot();
        } else if (Phaser.Input.Keyboard.JustDown(this.backKey)) {
            this.goBack();
        }

        // Gamepad
        this.handleGamepad();
    }

    private pollGamepadEdge(): void {
        const gamepads = navigator.getGamepads();
        for (let i = 0; i < gamepads.length; i++) {
            const pad = gamepads[i];
            if (!pad) continue;
            const confirmIdx = getConfirmButtonIndex(pad);
            const backIdx = getBackButtonIndex(pad);
            const aPressed = pad.buttons[confirmIdx]?.pressed || false;
            const bPressed = pad.buttons[backIdx]?.pressed || false;
            if (!this.canInput) {
                this.prevGamepadA.set(pad.index, aPressed);
                this.prevGamepadB.set(pad.index, bPressed);
            }
        }
    }

    private handleGamepad(): void {
        const gamepads = navigator.getGamepads();
        const now = Date.now();
        if (now - this.lastGamepadInputTime < 150) return;

        for (let i = 0; i < gamepads.length; i++) {
            const pad = gamepads[i];
            if (!pad) continue;

            const navY = getMenuNavY(pad);
            if (navY < 0) {
                this.changeSelection(-1);
                this.lastGamepadInputTime = now;
            } else if (navY > 0) {
                this.changeSelection(1);
                this.lastGamepadInputTime = now;
            }

            const confirmIdx = getConfirmButtonIndex(pad);
            const backIdx = getBackButtonIndex(pad);

            // A button — edge detection
            const aPressed = pad.buttons[confirmIdx]?.pressed || false;
            const wasA = this.prevGamepadA.get(pad.index) ?? false;
            this.prevGamepadA.set(pad.index, aPressed);
            if (aPressed && !wasA) {
                this.selectSlot();
                this.lastGamepadInputTime = now;
            }

            // B button — edge detection
            const bPressed = pad.buttons[backIdx]?.pressed || false;
            const wasB = this.prevGamepadB.get(pad.index) ?? false;
            this.prevGamepadB.set(pad.index, bPressed);
            if (bPressed && !wasB) {
                this.goBack();
                this.lastGamepadInputTime = now;
            }
        }
    }

    private changeSelection(dir: number): void {
        AudioManager.getInstance().playSFX('ui_menu_hover', { volume: 0.5 });
        this.selectedIndex = (this.selectedIndex + dir + 3) % 3;
        this.updateSelection();
    }

    private updateSelection(): void {
        this.slotContainers.forEach((container, index) => {
            const arrow = container.getData('arrow') as Phaser.GameObjects.Text;
            const card = container.getData('card') as Phaser.GameObjects.Graphics;

            if (index === this.selectedIndex) {
                arrow.setAlpha(1);
                // Redraw card with highlight
                card.clear();
                card.lineStyle(2, 0xffffff);
                card.fillStyle(0x222222, 0.95);
                card.fillRoundedRect(-300, -70, 600, 140, 12);
                card.strokeRoundedRect(-300, -70, 600, 140, 12);
            } else {
                arrow.setAlpha(0);
                // Redraw card normally
                card.clear();
                card.lineStyle(2, 0x444444);
                card.fillStyle(0x1a1a1a, 0.9);
                card.fillRoundedRect(-300, -70, 600, 140, 12);
                card.strokeRoundedRect(-300, -70, 600, 140, 12);
            }
        });
    }

    private selectSlot(): void {
        AudioManager.getInstance().playSFX('ui_confirm', { volume: 0.5 });
        this.canInput = false;

        const slotData = this.slots[this.selectedIndex];

        if (slotData && !slotData.completed) {
            // ─── Continue existing save ───
            const campaign = CampaignManager.getInstance();
            campaign.loadCampaignFromSlot(this.selectedIndex);

            // Build player data and go straight to GameScene
            const playerData = [{
                playerId: 0,
                joined: true,
                ready: true,
                input: {
                    type: this.initData.inputType || 'KEYBOARD',
                    gamepadIndex: this.initData.gamepadIndex ?? null,
                    keyboardMapping: 'all'
                },
                character: slotData.playerCharacter,
            }];

            this.scene.start('GameScene', {
                playerData,
                mode: 'campaign',
                slotIndex: this.selectedIndex,
            });
        } else {
            // ─── New game: go to lobby to pick character ───
            this.scene.start('LobbyScene', {
                ...this.initData,
                mode: 'campaign',
                slotIndex: this.selectedIndex,
            });
        }
    }

    private goBack(): void {
        AudioManager.getInstance().playSFX('ui_back', { volume: 0.5 });
        this.scene.start('MainMenuScene');
    }

    private formatPlayTime(ms: number): string {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        if (hours > 0) {
            return `${hours}h ${String(minutes).padStart(2, '0')}m`;
        }
        return `${minutes}m`;
    }

    private ensureIdleAnimations(): void {
        for (const [charKey, config] of Object.entries(charConfigs)) {
            const animKey = `${charKey}_idle`;
            if (!this.anims.exists(animKey) && config.idle) {
                const cfg = config.idle;
                const frames: { key: string; frame: string }[] = [];
                for (let f = 0; f < cfg.count; f++) {
                    frames.push({ key: charKey, frame: `${cfg.prefix}${String(f).padStart(3, '0')}` });
                }
                this.anims.create({
                    key: animKey,
                    frames,
                    frameRate: 10,
                    repeat: -1
                });
            }
        }
    }
}
