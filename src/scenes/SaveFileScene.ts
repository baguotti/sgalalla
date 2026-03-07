import Phaser from 'phaser';
import { SaveService } from '../managers/SaveService';
import type { CampaignSaveData } from '../managers/SaveService';
import { CampaignManager } from '../managers/CampaignManager';
import { AudioManager } from '../managers/AudioManager';
import { getConfirmButtonIndex, getBackButtonIndex, getMenuNavY, getMenuNavX } from '../input/JoyConMapper';
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

    // SubMenu
    private isSubMenuOpen: boolean = false;
    private subSelectedIndex: number = 0;
    private subMenuContainer!: Phaser.GameObjects.Container;
    private subMenuTexts: Phaser.GameObjects.Text[] = [];
    private subMenuArrow!: Phaser.GameObjects.Text;
    private subMenuOverlay!: Phaser.GameObjects.Rectangle;

    // Delete Confirmation SubMenu
    private isConfirmMenuOpen: boolean = false;
    private confirmSelectedIndex: number = 0; // 0 = NO, 1 = YES
    private confirmMenuContainer!: Phaser.GameObjects.Container;
    private confirmMenuTexts: Phaser.GameObjects.Text[] = [];
    private confirmMenuArrow!: Phaser.GameObjects.Text;

    // Keyboard
    private upKey!: Phaser.Input.Keyboard.Key;
    private downKey!: Phaser.Input.Keyboard.Key;
    private leftKey!: Phaser.Input.Keyboard.Key;
    private rightKey!: Phaser.Input.Keyboard.Key;
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
        this.isSubMenuOpen = false;
        this.subSelectedIndex = 0;
        this.isConfirmMenuOpen = false;
        this.confirmSelectedIndex = 0;
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

                const sprite = this.add.sprite(-cardWidth / 2 + 117, 0, charKey, frameKey);
                sprite.setScale(0.9);
                if (this.anims.exists(animKey)) {
                    sprite.play(animKey);
                }
                container.add(sprite);

                // Character name
                const charName = this.charLabels[charKey] || charKey.toUpperCase();
                const nameText = this.add.text(-cardWidth / 2 + 190, 0, charName, {
                    fontSize: '36px',
                    fontFamily: '"Pixeloid Sans"',
                    color: '#FFFFFF',
                    fontStyle: 'bold'
                }).setOrigin(0, 0.5);
                container.add(nameText);

                // Time played
                const timeStr = this.formatPlayTime(slotData.playTimeMs || 0);
                const timeText = this.add.text(cardWidth / 2 - 30, 0, `TEMPO ${timeStr}`, {
                    fontSize: '24px',
                    fontFamily: '"Pixeloid Sans"',
                    color: '#FFFFFF'
                }).setOrigin(1, 0.5);
                container.add(timeText);
            } else {
                // ─── Empty Slot ───
                const emptyText = this.add.text(0, 0, 'NUOVA PARTITA', {
                    fontSize: '32px',
                    fontFamily: '"Pixeloid Sans"',
                    color: '#555555'
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

        // --- Create Sub-Menu ---
        this.subMenuOverlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.7).setOrigin(0).setVisible(false).setDepth(100);
        this.subMenuContainer = this.add.container(width / 2, height / 2).setVisible(false).setDepth(101);

        const subCard = this.add.graphics();
        subCard.lineStyle(2, 0xffffff);
        subCard.fillStyle(0x222222, 1);
        subCard.fillRoundedRect(-150, -100, 300, 200, 12);
        subCard.strokeRoundedRect(-150, -100, 300, 200, 12);
        this.subMenuContainer.add(subCard);

        const contText = this.add.text(0, -30, 'CONTINUA', {
            fontSize: '32px', fontFamily: '"Pixeloid Sans"', color: '#FFFFFF'
        }).setOrigin(0.5);
        const delText = this.add.text(0, 30, 'ELIMINA', {
            fontSize: '32px', fontFamily: '"Pixeloid Sans"', color: '#FFFFFF'
        }).setOrigin(0.5);

        this.subMenuTexts = [contText, delText];
        this.subMenuContainer.add(contText);
        this.subMenuContainer.add(delText);

        this.subMenuArrow = this.add.text(-120, -30, '▶', {
            fontSize: '28px', fontFamily: '"Pixeloid Sans"', color: '#FFFFFF'
        }).setOrigin(0.5);
        this.subMenuContainer.add(this.subMenuArrow);

        // --- Create Confirm Delete Sub-Menu ---
        this.confirmMenuContainer = this.add.container(width / 2, height / 2).setVisible(false).setDepth(102);
        
        const confirmCard = this.add.graphics();
        confirmCard.lineStyle(2, 0xff0000); // Red border for delete
        confirmCard.fillStyle(0x222222, 1);
        confirmCard.fillRoundedRect(-350, -120, 700, 240, 12);
        confirmCard.strokeRoundedRect(-350, -120, 700, 240, 12);
        this.confirmMenuContainer.add(confirmCard);

        const promptText = this.add.text(0, -50, 'Sei sicuro di voler cancellare\nil salvataggio?', {
            fontSize: '28px', fontFamily: '"Pixeloid Sans"', color: '#ff5555', align: 'center'
        }).setOrigin(0.5);
        this.confirmMenuContainer.add(promptText);

        const noText = this.add.text(-120, 50, 'NO', {
            fontSize: '32px', fontFamily: '"Pixeloid Sans"', color: '#FFFFFF'
        }).setOrigin(0.5);
        const yesText = this.add.text(120, 50, 'SI', {
            fontSize: '32px', fontFamily: '"Pixeloid Sans"', color: '#888888'
        }).setOrigin(0.5);

        this.confirmMenuTexts = [noText, yesText];
        this.confirmMenuContainer.add(noText);
        this.confirmMenuContainer.add(yesText);

        this.confirmMenuArrow = this.add.text(-170, 50, '▶', {
            fontSize: '28px', fontFamily: '"Pixeloid Sans"', color: '#FFFFFF'
        }).setOrigin(0.5);
        this.confirmMenuContainer.add(this.confirmMenuArrow);

        // Input safety delay
        this.time.delayedCall(400, () => {
            this.canInput = true;
            this.upKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
            this.downKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
            this.leftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
            this.rightKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
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
        if (this.isConfirmMenuOpen) {
            if (Phaser.Input.Keyboard.JustDown(this.leftKey)) {
                this.changeConfirmSelection(-1);
            } else if (Phaser.Input.Keyboard.JustDown(this.rightKey)) {
                this.changeConfirmSelection(1);
            } else if (Phaser.Input.Keyboard.JustDown(this.upKey)) {
                this.changeConfirmSelection(-1);
            } else if (Phaser.Input.Keyboard.JustDown(this.downKey)) {
                this.changeConfirmSelection(1);
            } else if (Phaser.Input.Keyboard.JustDown(this.confirmKey) || Phaser.Input.Keyboard.JustDown(this.enterKey)) {
                this.handleConfirmMenuSubmit();
            } else if (Phaser.Input.Keyboard.JustDown(this.backKey)) {
                this.closeConfirmMenu();
            }
        } else if (this.isSubMenuOpen) {
            if (Phaser.Input.Keyboard.JustDown(this.upKey)) {
                this.changeSubSelection(-1);
            } else if (Phaser.Input.Keyboard.JustDown(this.downKey)) {
                this.changeSubSelection(1);
            } else if (Phaser.Input.Keyboard.JustDown(this.confirmKey) || Phaser.Input.Keyboard.JustDown(this.enterKey)) {
                this.handleSubMenuConfirm();
            } else if (Phaser.Input.Keyboard.JustDown(this.backKey)) {
                this.closeSubMenu();
            }
        } else {
            if (Phaser.Input.Keyboard.JustDown(this.upKey)) {
                this.changeSelection(-1);
            } else if (Phaser.Input.Keyboard.JustDown(this.downKey)) {
                this.changeSelection(1);
            } else if (Phaser.Input.Keyboard.JustDown(this.confirmKey) || Phaser.Input.Keyboard.JustDown(this.enterKey)) {
                this.selectSlot();
            } else if (Phaser.Input.Keyboard.JustDown(this.backKey)) {
                this.goBack();
            }
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
            const navX = getMenuNavX(pad); // Support horizontal selection specifically for YES/NO
            
            // Prioritize horizontal input if the confirm menu is open, otherwise use vertical
            if (this.isConfirmMenuOpen) {
                if (navX < 0 || navY < 0) {
                    this.changeConfirmSelection(-1);
                    this.lastGamepadInputTime = now;
                } else if (navX > 0 || navY > 0) {
                    this.changeConfirmSelection(1);
                    this.lastGamepadInputTime = now;
                }
            } else {
                if (navY < 0) {
                    if (this.isSubMenuOpen) this.changeSubSelection(-1);
                    else this.changeSelection(-1);
                    this.lastGamepadInputTime = now;
                } else if (navY > 0) {
                    if (this.isSubMenuOpen) this.changeSubSelection(1);
                    else this.changeSelection(1);
                    this.lastGamepadInputTime = now;
                }
            }

            const confirmIdx = getConfirmButtonIndex(pad);
            const backIdx = getBackButtonIndex(pad);

            // A button — edge detection
            const aPressed = pad.buttons[confirmIdx]?.pressed || false;
            const wasA = this.prevGamepadA.get(pad.index) ?? false;
            this.prevGamepadA.set(pad.index, aPressed);
            if (aPressed && !wasA) {
                if (this.isConfirmMenuOpen) this.handleConfirmMenuSubmit();
                else if (this.isSubMenuOpen) this.handleSubMenuConfirm();
                else this.selectSlot();
                this.lastGamepadInputTime = now;
            }

            // B button — edge detection
            const bPressed = pad.buttons[backIdx]?.pressed || false;
            const wasB = this.prevGamepadB.get(pad.index) ?? false;
            this.prevGamepadB.set(pad.index, bPressed);
            if (bPressed && !wasB) {
                if (this.isConfirmMenuOpen) this.closeConfirmMenu();
                else if (this.isSubMenuOpen) this.closeSubMenu();
                else this.goBack();
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
        const slotData = this.slots[this.selectedIndex];

        if (slotData && !slotData.completed) {
            // ─── Occupied save: Ask Continue or Delete ───
            this.openSubMenu();
        } else {
            // ─── New game: go to lobby to pick character ───
            this.canInput = false;
            this.scene.start('LobbyScene', {
                ...this.initData,
                mode: 'campaign',
                slotIndex: this.selectedIndex,
            });
        }
    }

    private loadCampaign(): void {
        const slotData = this.slots[this.selectedIndex];
        if (!slotData) return;

        const campaign = CampaignManager.getInstance();
        campaign.loadCampaignFromSlot(this.selectedIndex);

        // Build player data and go to CampaignMapScene
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

        this.scene.start('CampaignMapScene', {
            playerData,
            mode: 'campaign',
            slotIndex: this.selectedIndex,
        });
    }

    private changeSubSelection(dir: number): void {
        AudioManager.getInstance().playSFX('ui_menu_hover', { volume: 0.5 });
        this.subSelectedIndex = (this.subSelectedIndex + dir + 2) % 2;
        this.updateSubSelection();
    }

    private updateSubSelection(): void {
        this.subMenuArrow.setY(this.subSelectedIndex === 0 ? -30 : 30);
        this.subMenuTexts.forEach((text, i) => {
            if (i === this.subSelectedIndex) {
                text.setColor('#ffffff');
                text.setShadow(0, 0, '#ffffff', 10, false, true);
            } else {
                text.setColor('#888888');
                text.setShadow(0, 0, '#000000', 0, false, true);
            }
        });
    }

    private openSubMenu(): void {
        this.isSubMenuOpen = true;
        this.subSelectedIndex = 0;
        this.subMenuOverlay.setVisible(true);
        this.subMenuContainer.setVisible(true);
        this.updateSubSelection();
    }

    private closeSubMenu(): void {
        AudioManager.getInstance().playSFX('ui_back', { volume: 0.5 });
        this.isSubMenuOpen = false;
        this.subMenuOverlay.setVisible(false);
        this.subMenuContainer.setVisible(false);
        this.time.delayedCall(100, () => {
            this.canInput = true; // Wait slightly before accepting main menu input to avoid double-bounce
        });
    }

    private handleSubMenuConfirm(): void {
        AudioManager.getInstance().playSFX('ui_confirm', { volume: 0.5 });
        
        if (this.subSelectedIndex === 0) {
            // Continua
            this.canInput = false;
            this.loadCampaign();
        } else {
            // Elimina - Prompt for confirmation
            this.openConfirmMenu();
        }
    }

    private changeConfirmSelection(dir: number): void {
        AudioManager.getInstance().playSFX('ui_menu_hover', { volume: 0.5 });
        this.confirmSelectedIndex = (this.confirmSelectedIndex + dir + 2) % 2;
        this.updateConfirmSelection();
    }

    private updateConfirmSelection(): void {
        this.confirmMenuArrow.setX(this.confirmSelectedIndex === 0 ? -170 : 70);
        this.confirmMenuTexts.forEach((text, i) => {
            if (i === this.confirmSelectedIndex) {
                text.setColor('#ffffff');
                text.setShadow(0, 0, '#ffffff', 10, false, true);
            } else {
                text.setColor('#888888');
                text.setShadow(0, 0, '#000000', 0, false, true);
            }
        });
    }

    private openConfirmMenu(): void {
        this.isConfirmMenuOpen = true;
        this.confirmSelectedIndex = 0; // Default to NO
        this.subMenuContainer.setVisible(false); // Hide the Continua/Elimina box behind it
        this.confirmMenuContainer.setVisible(true);
        this.updateConfirmSelection();
    }

    private closeConfirmMenu(): void {
        AudioManager.getInstance().playSFX('ui_back', { volume: 0.5 });
        this.isConfirmMenuOpen = false;
        this.confirmMenuContainer.setVisible(false);
        this.subMenuContainer.setVisible(true); // Return to sub-menu
    }

    private handleConfirmMenuSubmit(): void {
        AudioManager.getInstance().playSFX('ui_confirm', { volume: 0.5 });
        
        if (this.confirmSelectedIndex === 1) { // YES, Delete
            this.canInput = false;
            SaveService.deleteSlot(this.selectedIndex);
            this.isConfirmMenuOpen = false;
            this.isSubMenuOpen = false;
            this.confirmMenuContainer.setVisible(false);
            this.subMenuOverlay.setVisible(false);
            this.scene.restart(this.initData);
        } else { // NO, Cancel
            this.closeConfirmMenu();
        }
    }

    private goBack(): void {
        AudioManager.getInstance().playSFX('ui_back', { volume: 0.5 });
        this.scene.start('MainMenuScene');
    }

    private formatPlayTime(ms: number): string {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
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
