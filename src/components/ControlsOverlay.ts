import Phaser from 'phaser';

export class ControlsOverlay {
    private scene: Phaser.Scene;
    private container!: Phaser.GameObjects.Container;
    private overlayBg!: Phaser.GameObjects.Graphics;
    private isVisible: boolean = false;
    private previousLBPressed: boolean = false;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.createOverlay();
        this.setupInput();
    }

    private createOverlay(): void {
        this.container = this.scene.add.container(0, 0);
        this.container.setScrollFactor(0);
        this.container.setDepth(1001);
        this.container.setVisible(false);

        // Dark background overlay
        this.overlayBg = this.scene.add.graphics();
        this.overlayBg.fillStyle(0x000000, 0.88);
        this.overlayBg.fillRect(0, 0, this.scene.scale.width, this.scene.scale.height);
        this.container.add(this.overlayBg);

        const centerX = this.scene.scale.width / 2;

        const titleText = this.scene.add.text(centerX, 60, 'COMANDI DI GIOCO', {
            fontSize: '44px',
            color: '#ffffff',
            fontStyle: 'bold',
            fontFamily: '"Pixeloid Sans"'
        }).setOrigin(0.5);
        this.container.add(titleText);

        const hintText = this.scene.add.text(centerX, this.scene.scale.height - 40, '[F1 / LB] tieni premuto per visualizzare', {
            fontSize: '16px',
            color: '#8ab4f8',
            fontFamily: '"Pixeloid Sans"'
        }).setOrigin(0.5);
        this.container.add(hintText);

        // --- Layout: 3 columns ---
        const topY = 120;
        const col1X = this.scene.scale.width * 0.18;
        const col2X = this.scene.scale.width * 0.50;
        const col3X = this.scene.scale.width * 0.82;
        const headerStyle = { fontSize: '26px', fontStyle: 'bold', fontFamily: '"Pixeloid Sans"' };
        const bodyStyle = { fontSize: '16px', color: '#ffffff', fontFamily: '"Pixeloid Sans"', lineSpacing: 7 };

        // ═══════════════════════════════════
        // COLUMN 1: INPUT MAPPINGS
        // ═══════════════════════════════════
        const col1Header = this.scene.add.text(col1X, topY, 'TASTI & GAMEPAD', {
            ...headerStyle, color: '#8ab4f8'
        }).setOrigin(0.5, 0);
        col1Header.setShadow(2, 2, '#000000', 0, false, true);

        const inputLines = [
            'AZIONE          TASTI        GAMEPAD',
            '──────────────────────────────────────',
            'Muovi           WASD/Frec.   Stick L / D-Pad',
            'Salta           Spazio/Su    A',
            'Att. Leggero    J / C        X',
            'Att. Pesante    K / X        B / Y',
            'Schivata        L / Z        LT / RT',
            'Provoca         P            R3 (Click)',
            'Pausa           ESC          Start',
            '',
            'INTERAZIONI',
            '──────────────────────────────────────',
            'Apri Cassa      J / C        X',
            '  (vicino alla cassa)',
            'Raccogli        J / C        X',
            '  (vicino a oggetto)',
            'Lancia          J / C        X / RB',
            '  (con oggetto in mano)',
        ].join('\n');

        const col1Body = this.scene.add.text(col1X, topY + 48, inputLines, bodyStyle).setOrigin(0.5, 0);

        // ═══════════════════════════════════
        // COLUMN 2: MOVESET GUIDE
        // ═══════════════════════════════════
        const col2Header = this.scene.add.text(col2X, topY, 'MOVESET', {
            ...headerStyle, color: '#f28b82'
        }).setOrigin(0.5, 0);
        col2Header.setShadow(2, 2, '#000000', 0, false, true);

        const movesetLines = [
            'ATTACCHI LEGGERI (Veloci)',
            '• NLight   Fermo + Leggero',
            '• SLight   Lati + Leggero',
            '• DLight   Giù + Leggero',
            '• Air      Aria + Leggero',
            '',
            'ATTACCHI PESANTI (Signature)',
            '• NSig     Fermo + Pesante',
            '             (Caricabile)',
            '• SSig     Lati + Pesante',
            '             (Kill Move / Caricabile)',
            '• DSig     Giù + Pesante',
            '',
            'SPECIALI',
            '• Recovery       Su + Pesante',
            '                   (in aria)',
            '• Ground Pound   Giù + Pesante',
            '                   (in aria)',
            '• Doppio Salto   Salta x2',
            '• Wall Slide     Verso il muro',
            '                   (in aria)',
            '• Wall Jump      Salta dal muro',
        ].join('\n');

        const col2Body = this.scene.add.text(col2X, topY + 48, movesetLines, bodyStyle).setOrigin(0.5, 0);

        // ═══════════════════════════════════
        // COLUMN 3: SYSTEM & DEBUG
        // ═══════════════════════════════════
        const col3Header = this.scene.add.text(col3X, topY, 'SISTEMA', {
            ...headerStyle, color: '#81c995'
        }).setOrigin(0.5, 0);
        col3Header.setShadow(2, 2, '#000000', 0, false, true);

        const systemLines = [
            'COMUNE',
            '──────────────────────────────',
            'F1 / LB  Comandi (questo)',
            'ESC      Pausa',
            'Q        FPS / Ping',
            '',
            'SOLO TRAINING',
            '──────────────────────────────',
            'Q        Debug Completo',
            '           (hitbox, stati,',
            '            velocità...)',
            'T        Dummy Ostile On/Off',
            'Y        Genera Cassa',
            '',
            'NOTE',
            '──────────────────────────────',
            '• Switch Pro Controller',
            '  supportato (remap auto)',
            '• La carica si attiva',
            '  tenendo premuto Pesante',
            '• Gli attacchi si bufferizzano',
            '  automaticamente',
        ].join('\n');

        const col3Body = this.scene.add.text(col3X, topY + 48, systemLines, bodyStyle).setOrigin(0.5, 0);

        this.container.add([col1Header, col1Body, col2Header, col2Body, col3Header, col3Body]);
    }

    private setupInput(): void {
        // F1 hold: show on keydown, hide on keyup
        this.scene.input.keyboard!.on('keydown-F1', (event: KeyboardEvent) => {
            event.preventDefault();
            this.show();
        });
        this.scene.input.keyboard!.on('keyup-F1', (event: KeyboardEvent) => {
            event.preventDefault();
            this.hide();
        });
    }

    private show(): void {
        if (!this.isVisible) {
            this.isVisible = true;
            this.container.setVisible(true);
            this.scene.sound.play('ui_confirm', { volume: 0.5 });
        }
    }

    private hide(): void {
        if (this.isVisible) {
            this.isVisible = false;
            this.container.setVisible(false);
            this.scene.sound.play('ui_back', { volume: 0.5 });
        }
    }

    public toggle(): void {
        if (this.isVisible) this.hide(); else this.show();
    }

    /** Call from scene update() to poll LB gamepad button (hold-to-show) */
    public update(): void {
        const gamepads = navigator.getGamepads();
        let lbHeld = false;

        for (let i = 0; i < gamepads.length; i++) {
            const gp = gamepads[i];
            if (gp && gp.buttons[4]?.pressed) {
                lbHeld = true;
                break;
            }
        }

        if (lbHeld && !this.previousLBPressed) {
            this.show();
        } else if (!lbHeld && this.previousLBPressed) {
            this.hide();
        }
        this.previousLBPressed = lbHeld;
    }

    public getElements(): Phaser.GameObjects.GameObject[] {
        return [this.container];
    }
}
