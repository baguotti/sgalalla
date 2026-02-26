import Phaser from 'phaser';

/**
 * DebugOverlay - Premium styled debug/performance HUD
 * 
 * Minimal mode (online/versus): FPS + Ping only
 * Full mode (training): All debug stats
 */
export class DebugOverlay {
    private scene: Phaser.Scene;

    // Background panel
    private bgPanel: Phaser.GameObjects.Graphics;

    // Text elements
    private fpsText: Phaser.GameObjects.Text;
    private pingText: Phaser.GameObjects.Text;
    private velocityText: Phaser.GameObjects.Text;
    private stateText: Phaser.GameObjects.Text;
    private recoveryText: Phaser.GameObjects.Text;
    private attackText: Phaser.GameObjects.Text;
    private gamepadText: Phaser.GameObjects.Text;

    // Styling constants
    private static readonly PANEL_X = 8;
    private static readonly PANEL_Y = 8;
    private static readonly PANEL_PADDING = 10;
    private static readonly LINE_HEIGHT = 20;
    private static readonly FONT_SIZE = '12px';
    private static readonly FONT_FAMILY = '"Pixeloid Sans"';
    private static readonly BG_COLOR = 0x0a0a0a;
    private static readonly BG_ALPHA = 0.7;
    private static readonly BORDER_COLOR = 0x333333;
    private static readonly CORNER_RADIUS = 6;

    // Color palette (matches game's aesthetic)
    private static readonly COLOR_VALUE = '#e0e0e0';
    private static readonly COLOR_FPS_GOOD = '#8bef8b';
    private static readonly COLOR_FPS_WARN = '#f0c040';
    private static readonly COLOR_FPS_BAD = '#ef5350';
    private static readonly COLOR_PING_GOOD = '#8bef8b';
    private static readonly COLOR_PING_WARN = '#f0c040';
    private static readonly COLOR_PING_BAD = '#ef5350';
    private static readonly COLOR_ATTACK = '#f0c040';
    private static readonly COLOR_GAMEPAD = '#64b5f6';

    constructor(scene: Phaser.Scene) {
        this.scene = scene;

        const x = DebugOverlay.PANEL_X + DebugOverlay.PANEL_PADDING;
        const startY = DebugOverlay.PANEL_Y + DebugOverlay.PANEL_PADDING;
        const lh = DebugOverlay.LINE_HEIGHT;

        const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
            fontSize: DebugOverlay.FONT_SIZE,
            fontFamily: DebugOverlay.FONT_FAMILY,
            color: DebugOverlay.COLOR_VALUE,
        };

        // Background panel (drawn after we know size)
        this.bgPanel = scene.add.graphics();
        this.bgPanel.setDepth(999);
        this.bgPanel.setScrollFactor(0);

        // Create text elements
        this.fpsText = scene.add.text(x, startY, '', textStyle).setDepth(1000).setScrollFactor(0);
        this.pingText = scene.add.text(x, startY + lh, '', textStyle).setDepth(1000).setScrollFactor(0);
        this.velocityText = scene.add.text(x, startY + lh * 2.5, '', textStyle).setDepth(1000).setScrollFactor(0);
        this.stateText = scene.add.text(x, startY + lh * 3.5, '', textStyle).setDepth(1000).setScrollFactor(0);
        this.recoveryText = scene.add.text(x, startY + lh * 4.5, '', textStyle).setDepth(1000).setScrollFactor(0);
        this.attackText = scene.add.text(x, startY + lh * 5.5, '', { ...textStyle, color: DebugOverlay.COLOR_ATTACK }).setDepth(1000).setScrollFactor(0);
        this.gamepadText = scene.add.text(x, startY + lh * 6.5, '', { ...textStyle, color: DebugOverlay.COLOR_GAMEPAD }).setDepth(1000).setScrollFactor(0);

        // Start hidden
        this.setVisible(false);
    }

    update(
        velocityX: number,
        velocityY: number,
        state: string,
        recoveryAvailable: boolean,
        attackInfo: string = 'None',
        gamepadConnected: boolean = false,
        ping: number = 0
    ): void {
        const fps = Math.round(this.scene.game.loop.actualFps);

        // FPS coloring
        const fpsColor = fps >= 55 ? DebugOverlay.COLOR_FPS_GOOD
            : fps >= 30 ? DebugOverlay.COLOR_FPS_WARN
                : DebugOverlay.COLOR_FPS_BAD;
        this.fpsText.setText(`FPS  ${fps}`).setColor(fpsColor);

        // Ping coloring
        const pingColor = ping <= 50 ? DebugOverlay.COLOR_PING_GOOD
            : ping <= 100 ? DebugOverlay.COLOR_PING_WARN
                : DebugOverlay.COLOR_PING_BAD;
        this.pingText.setText(`PNG  ${ping}ms`).setColor(pingColor);

        // Full debug fields
        this.velocityText.setText(`VEL  ${velocityX.toFixed(0)} / ${velocityY.toFixed(0)}`);
        this.stateText.setText(`FSM  ${state}`);
        this.recoveryText.setText(`RCV  ${recoveryAvailable ? '● Ready' : '○ Used'}`);
        this.attackText.setText(`ATK  ${attackInfo}`);
        this.gamepadText.setText(`PAD  ${gamepadConnected ? '● Connected' : '○ None'}`);

        // Redraw background panel
        this.drawPanel();
    }

    private drawPanel(): void {
        this.bgPanel.clear();

        // Determine how many lines are visible to size the panel
        const visibleTexts = this.getVisibleTexts();
        if (visibleTexts.length === 0) return;

        const lastText = visibleTexts[visibleTexts.length - 1];

        // Dynamic width: measure the widest visible text + padding
        let maxWidth = 0;
        for (const t of visibleTexts) {
            if (t.width > maxWidth) maxWidth = t.width;
        }
        const panelWidth = maxWidth + DebugOverlay.PANEL_PADDING * 2;
        const panelHeight = (lastText.y + lastText.height) - DebugOverlay.PANEL_Y + DebugOverlay.PANEL_PADDING;

        // Semi-transparent background
        this.bgPanel.fillStyle(DebugOverlay.BG_COLOR, DebugOverlay.BG_ALPHA);
        this.bgPanel.fillRoundedRect(
            DebugOverlay.PANEL_X, DebugOverlay.PANEL_Y,
            panelWidth, panelHeight,
            DebugOverlay.CORNER_RADIUS
        );

        // Subtle border
        this.bgPanel.lineStyle(1, DebugOverlay.BORDER_COLOR, 0.5);
        this.bgPanel.strokeRoundedRect(
            DebugOverlay.PANEL_X, DebugOverlay.PANEL_Y,
            panelWidth, panelHeight,
            DebugOverlay.CORNER_RADIUS
        );
    }

    private getVisibleTexts(): Phaser.GameObjects.Text[] {
        return [
            this.fpsText, this.pingText,
            this.velocityText, this.stateText,
            this.recoveryText, this.attackText, this.gamepadText
        ].filter(t => t.visible);
    }

    private _minimalMode: boolean = false;

    /** When true, only FPS and Ping are shown (for versus/online). Full debug is training-only. */
    public setMinimalMode(minimal: boolean): void {
        this._minimalMode = minimal;
    }

    public isMinimalMode(): boolean {
        return this._minimalMode;
    }

    setVisible(visible: boolean): void {
        // FPS and Ping always follow the toggle
        this.fpsText.setVisible(visible);
        this.pingText.setVisible(visible);
        this.bgPanel.setVisible(visible);

        // Full debug fields only visible in non-minimal mode
        const fullVisible = visible && !this._minimalMode;
        this.velocityText.setVisible(fullVisible);
        this.stateText.setVisible(fullVisible);
        this.recoveryText.setVisible(fullVisible);
        this.attackText.setVisible(fullVisible);
        this.gamepadText.setVisible(fullVisible);
    }

    // Set which camera renders these UI elements
    setCameraIgnore(camera: Phaser.Cameras.Scene2D.Camera): void {
        camera.ignore([
            this.bgPanel,
            this.fpsText,
            this.pingText,
            this.velocityText,
            this.stateText,
            this.recoveryText,
            this.attackText,
            this.gamepadText,
        ]);
    }

    destroy(): void {
        this.bgPanel.destroy();
        this.fpsText.destroy();
        this.pingText.destroy();
        this.velocityText.destroy();
        this.stateText.destroy();
        this.recoveryText.destroy();
        this.attackText.destroy();
        this.gamepadText.destroy();
    }
}
