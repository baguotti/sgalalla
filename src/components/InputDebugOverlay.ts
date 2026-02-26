import Phaser from 'phaser';
import type { Player } from '../entities/Player';
import type { InputState } from '../input/InputManager';

/**
 * InputDebugOverlay — Toggled by F2
 * 
 * Shows each player's controller type, key bindings, and live input state.
 * Positioned on the right side of the screen.
 */
export class InputDebugOverlay {
    private scene: Phaser.Scene;
    private visible: boolean = false;
    private bgPanel: Phaser.GameObjects.Graphics;
    private playerTexts: Phaser.GameObjects.Text[] = [];
    private titleText: Phaser.GameObjects.Text;

    // Styling
    private static readonly PANEL_PADDING = 10;
    private static readonly LINE_HEIGHT = 16;
    private static readonly FONT_SIZE = '11px';
    private static readonly FONT_FAMILY = '"Pixeloid Sans"';
    private static readonly BG_COLOR = 0x0a0a0a;
    private static readonly BG_ALPHA = 0.75;
    private static readonly BORDER_COLOR = 0x444444;
    private static readonly CORNER_RADIUS = 6;

    // Max players to display
    private static readonly MAX_PLAYERS = 6;

    // Key binding labels per mapping
    private static readonly WASD_KEYS = {
        move: 'WASD',
        jump: 'Space',
        light: 'J',
        heavy: 'K',
        dodge: 'L',
        taunt: 'P',
        recovery: 'Shift',
    };

    private static readonly ARROWS_KEYS = {
        move: 'Arrows',
        jump: 'G',
        light: 'C',
        heavy: 'V',
        dodge: 'B',
        taunt: 'M',
        recovery: '—',
    };

    private static readonly GAMEPAD_KEYS = {
        move: 'Stick/DPad',
        jump: 'A',
        light: 'X',
        heavy: 'B/Y',
        dodge: 'LT/RT',
        taunt: 'R3',
        recovery: 'RB',
    };

    constructor(scene: Phaser.Scene) {
        this.scene = scene;

        // Background panel
        this.bgPanel = scene.add.graphics();
        this.bgPanel.setDepth(999);
        this.bgPanel.setScrollFactor(0);
        this.bgPanel.setVisible(false);

        // Title
        this.titleText = scene.add.text(0, 0, '[ INPUT DEBUG ]', {
            fontSize: '12px',
            fontFamily: InputDebugOverlay.FONT_FAMILY,
            color: '#64b5f6',
        }).setDepth(1000).setScrollFactor(0).setVisible(false);

        // Pre-create text objects for each player slot
        for (let i = 0; i < InputDebugOverlay.MAX_PLAYERS; i++) {
            const text = scene.add.text(0, 0, '', {
                fontSize: InputDebugOverlay.FONT_SIZE,
                fontFamily: InputDebugOverlay.FONT_FAMILY,
                color: '#ffffff',
            }).setDepth(1000).setScrollFactor(0).setVisible(false);
            this.playerTexts.push(text);
        }
    }

    toggle(): void {
        this.visible = !this.visible;
        this.setVisible(this.visible);
    }

    isVisible(): boolean {
        return this.visible;
    }

    update(players: Player[]): void {
        if (!this.visible) return;

        const panelX = this.scene.scale.width - 320 - InputDebugOverlay.PANEL_PADDING;
        const panelY = 8;
        const contentX = panelX + InputDebugOverlay.PANEL_PADDING;
        let currentY = panelY + InputDebugOverlay.PANEL_PADDING;

        // Title
        this.titleText.setPosition(contentX, currentY);
        currentY += 22;

        // Update each player
        for (let i = 0; i < InputDebugOverlay.MAX_PLAYERS; i++) {
            const text = this.playerTexts[i];

            if (i < players.length) {
                const player = players[i];
                const input = player.getCurrentInput();
                const { label, keys } = this.getControllerInfo(player);
                const inputStr = this.formatInputState(input, keys);

                text.setText(
                    `P${player.playerId + 1} ${label}  ${keys.move}\n${inputStr}`
                );
                text.setPosition(contentX, currentY);
                text.setVisible(true);
                currentY += InputDebugOverlay.LINE_HEIGHT * 2.8;
            } else {
                text.setVisible(false);
            }
        }

        // Draw background panel
        this.drawPanel(panelX, panelY, currentY);
    }

    private getControllerInfo(player: Player): {
        label: string;
        keys: typeof InputDebugOverlay.WASD_KEYS;
    } {
        if (player.inputType === 'ai') {
            return { label: '[ CPU ]', keys: InputDebugOverlay.WASD_KEYS };
        }
        if (player.inputType === 'gamepad') {
            return { label: '[ GAMEPAD ]', keys: InputDebugOverlay.GAMEPAD_KEYS };
        }
        // Keyboard — determine layout
        if (player.keyboardMapping === 'arrows') {
            return { label: '[ KB ARROWS ]', keys: InputDebugOverlay.ARROWS_KEYS };
        }
        return { label: '[ KB WASD ]', keys: InputDebugOverlay.WASD_KEYS };
    }

    private formatInputState(
        input: InputState,
        keys: typeof InputDebugOverlay.WASD_KEYS
    ): string {
        if (!input) return '—';

        const parts: string[] = [];

        // Movement arrows
        const arrows = [
            input.moveLeft ? '◄' : '·',
            input.moveDown ? '▼' : '·',
            input.moveUp ? '▲' : '·',
            input.moveRight ? '►' : '·',
        ].join('');
        parts.push(arrows);

        // Actions with key labels — CAPS = fresh press, lowercase = held
        if (input.jump) parts.push(`${keys.jump}↓`);
        else if (input.jumpHeld) parts.push(`${keys.jump.toLowerCase()}`);

        if (input.lightAttack) parts.push(`${keys.light}↓`);
        else if (input.lightAttackHeld) parts.push(`${keys.light.toLowerCase()}`);

        if (input.heavyAttack) parts.push(`${keys.heavy}↓`);
        else if (input.heavyAttackHeld) parts.push(`${keys.heavy.toLowerCase()}`);

        if (input.dodge) parts.push(`${keys.dodge}↓`);
        else if (input.dodgeHeld) parts.push(`${keys.dodge.toLowerCase()}`);

        if (input.recovery) parts.push(`${keys.recovery}↓`);
        if (input.taunt) parts.push(`${keys.taunt}↓`);

        return parts.join(' ');
    }

    private drawPanel(panelX: number, panelY: number, bottomY: number): void {
        this.bgPanel.clear();

        const panelWidth = 320;
        const panelHeight = bottomY - panelY + InputDebugOverlay.PANEL_PADDING;

        // Semi-transparent background
        this.bgPanel.fillStyle(InputDebugOverlay.BG_COLOR, InputDebugOverlay.BG_ALPHA);
        this.bgPanel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, InputDebugOverlay.CORNER_RADIUS);

        // Subtle border
        this.bgPanel.lineStyle(1, InputDebugOverlay.BORDER_COLOR, 0.5);
        this.bgPanel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, InputDebugOverlay.CORNER_RADIUS);
    }

    private setVisible(visible: boolean): void {
        this.bgPanel.setVisible(visible);
        this.titleText.setVisible(visible);
        this.playerTexts.forEach(t => t.setVisible(visible));
    }

    setCameraIgnore(camera: Phaser.Cameras.Scene2D.Camera): void {
        camera.ignore([
            this.bgPanel,
            this.titleText,
            ...this.playerTexts,
        ]);
    }

    getElements(): Phaser.GameObjects.GameObject[] {
        return [this.bgPanel, this.titleText, ...this.playerTexts];
    }

    destroy(): void {
        this.bgPanel.destroy();
        this.titleText.destroy();
        this.playerTexts.forEach(t => t.destroy());
    }
}
