import Phaser from 'phaser';

export class DebugOverlay {
    private scene: Phaser.Scene;
    private velocityText: Phaser.GameObjects.Text;
    private stateText: Phaser.GameObjects.Text;
    private fpsText: Phaser.GameObjects.Text;
    private pingText: Phaser.GameObjects.Text;
    private recoveryText: Phaser.GameObjects.Text;
    private attackText: Phaser.GameObjects.Text;
    private gamepadText: Phaser.GameObjects.Text;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;

        // Create text objects
        this.velocityText = scene.add.text(10, 10, '', {
            fontSize: '14px',
            color: '#00ff00',
            fontFamily: '"Pixeloid Sans"',
            backgroundColor: '#000000',
            padding: { x: 5, y: 3 },
        });
        this.velocityText.setDepth(1000);

        this.stateText = scene.add.text(10, 35, '', {
            fontSize: '14px',
            color: '#00ff00',
            fontFamily: '"Pixeloid Sans"',
            backgroundColor: '#000000',
            padding: { x: 5, y: 3 },
        });
        this.stateText.setDepth(1000);

        this.fpsText = scene.add.text(10, 60, '', {
            fontSize: '14px',
            color: '#00ff00',
            fontFamily: '"Pixeloid Sans"',
            backgroundColor: '#000000',
            padding: { x: 5, y: 3 },
        });
        this.fpsText.setDepth(1000);

        this.pingText = scene.add.text(10, 85, '', {
            fontSize: '14px',
            color: '#00ff00',
            fontFamily: '"Pixeloid Sans"',
            backgroundColor: '#000000',
            padding: { x: 5, y: 3 },
        });
        this.pingText.setDepth(1000);

        this.recoveryText = scene.add.text(10, 110, '', {
            fontSize: '14px',
            color: '#00ff00',
            fontFamily: '"Pixeloid Sans"',
            backgroundColor: '#000000',
            padding: { x: 5, y: 3 },
        });
        this.recoveryText.setDepth(1000);

        this.attackText = scene.add.text(10, 135, '', {
            fontSize: '14px',
            color: '#ffff00',
            fontFamily: '"Pixeloid Sans"',
            backgroundColor: '#000000',
            padding: { x: 5, y: 3 },
        });
        this.attackText.setDepth(1000);

        this.gamepadText = scene.add.text(10, 160, '', {
            fontSize: '14px',
            color: '#00ffff',
            fontFamily: '"Pixeloid Sans"',
            backgroundColor: '#000000',
            padding: { x: 5, y: 3 },
        });
        this.gamepadText.setDepth(1000);

        // Fix UI to screen
        this.velocityText.setScrollFactor(0);
        this.stateText.setScrollFactor(0);
        this.fpsText.setScrollFactor(0);
        this.pingText.setScrollFactor(0);
        this.recoveryText.setScrollFactor(0);
        this.attackText.setScrollFactor(0);
        this.gamepadText.setScrollFactor(0);
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
        this.velocityText.setText(
            `Vel: X=${velocityX.toFixed(0)} Y=${velocityY.toFixed(0)}`
        );
        this.stateText.setText(`State: ${state}`);
        this.fpsText.setText(`FPS: ${Math.round(this.scene.game.loop.actualFps)}`);

        const pingColor = ping > 100 ? '#ff0000' : (ping > 50 ? '#ffff00' : '#00ff00');
        this.pingText.setText(`Ping: ${ping}ms`).setColor(pingColor);

        this.recoveryText.setText(`Recovery: ${recoveryAvailable ? 'Ready' : 'Used'}`);
        this.attackText.setText(`Attack: ${attackInfo}`);
        this.gamepadText.setText(`Gamepad: ${gamepadConnected ? '🎮 Connected' : 'Not connected'}`);
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
            this.velocityText,
            this.stateText,
            this.fpsText,
            this.pingText,
            this.recoveryText,
            this.attackText,
            this.gamepadText
        ]);
    }

    destroy(): void {
        this.velocityText.destroy();
        this.stateText.destroy();
        this.fpsText.destroy();
        this.pingText.destroy();
        this.recoveryText.destroy();
        this.attackText.destroy();
        this.gamepadText.destroy();
    }
}
