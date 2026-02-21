import Phaser from 'phaser';

export class ControlsOverlay {
    private scene: Phaser.Scene;
    private container!: Phaser.GameObjects.Container;
    private overlayBg!: Phaser.GameObjects.Graphics;
    private isVisible: boolean = false;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.createOverlay();
        this.setupInput();
    }

    private createOverlay(): void {
        this.container = this.scene.add.container(0, 0);
        this.container.setScrollFactor(0);
        this.container.setDepth(1001); // High depth to render over UI
        this.container.setVisible(false);

        // Dark background overlay just for the controls screen
        this.overlayBg = this.scene.add.graphics();
        this.overlayBg.fillStyle(0x000000, 0.85); // Overwatch style dark transparency
        this.overlayBg.fillRect(0, 0, this.scene.scale.width, this.scene.scale.height);
        this.container.add(this.overlayBg);

        const centerX = this.scene.scale.width / 2;
        // Move content up slightly to make room for Title
        const centerY = this.scene.scale.height / 2;

        const titleText = this.scene.add.text(centerX, 80, 'COMANDI DI GIOCO', {
            fontSize: '48px',
            color: '#ffffff',
            fontStyle: 'bold',
            fontFamily: '"Pixeloid Sans"'
        });
        titleText.setOrigin(0.5);
        this.container.add(titleText);

        const hintText = this.scene.add.text(centerX, this.scene.scale.height - 50, '[F1] per chiudere', {
            fontSize: '18px',
            color: '#8ab4f8',
            fontFamily: '"Pixeloid Sans"'
        });
        hintText.setOrigin(0.5);
        this.container.add(hintText);

        // -- Layout Configuration --
        // Use a wrapper container to easily center everything
        const contentContainer = this.scene.add.container(centerX, centerY);
        this.container.add(contentContainer);

        const col1X = -250; // Modified to move right (-350 to -250)
        const col2X = 200;  // Modified to move right (50 to 200)
        const headerY = -200; // Modified to move up (-150 to -200)
        const contentY = -150; // Modified to move up (-100 to -150)

        // == COL 1: INPUTS ==
        const inputsHeader = this.scene.add.text(col1X, headerY, 'TASTI & COMANDI', {
            fontSize: '32px',
            color: '#8ab4f8', // Pastel Blue
            fontStyle: 'bold',
            fontFamily: '"Pixeloid Sans"'
        }).setOrigin(0.5, 0);

        inputsHeader.setShadow(2, 2, '#000000', 0, false, true);

        const inputsText = [
            'AZIONE       | TASTIERA   | GAMEPAD',
            '-------------+------------+-----------',
            'Muovi        | WASD/Frec. | Stick L',
            'Salta        | Spazio/Su  | A (Cross)',
            'Att. Leggero | J / C      | X (Square)',
            'Att. Pesante | K / X      | B (Circle)',
            'Schivata     | L / Z      | Grilletti',
            'Interagisci  | J / C      | X (Square)'
        ].join('\n');

        const inputsContent = this.scene.add.text(col1X, contentY, inputsText, {
            fontSize: '18px',
            color: '#ffffff',
            fontFamily: '"Pixeloid Sans"',
            lineSpacing: 8,
            align: 'center'
        }).setOrigin(0.5, 0);

        // == COL 2: MOVESET GUIDE ==
        const movesetHeader = this.scene.add.text(col2X, headerY, 'MOVESET GUIDE', {
            fontSize: '32px',
            color: '#f28b82', // Pastel Red
            fontStyle: 'bold',
            fontFamily: '"Pixeloid Sans"'
        }).setOrigin(0.5, 0);

        movesetHeader.setShadow(2, 2, '#000000', 0, false, true);

        const movesetText = [
            'ATTACCHI LEGGERI (Veloci)',
            '• NLight: Fermo + Leggero',
            '• SLight: Destra/Sinistra + Leggero',
            '• DLight: Giù + Leggero',
            '• Air Light: Salto + Leggero',
            '',
            'ATTACCHI PESANTI (Signature)',
            '• NSig: Fermo + Pesante (Anti-Air/Caricabile)',
            '• SSig: Lati + Pesante (Kill Move/Caricabile)',
            '• DSig: Giù + Pesante (Area Control)',
            '',
            'SPECIALI & OGGETTI',
            '• Recovery: Salto + Su + Pesante',
            '• Ground Pound: Salto + Giù + Pesante',
            '• Apri Cassa: Attacco vicino alla cassa'
        ].join('\n');

        const movesetContent = this.scene.add.text(col2X, contentY, movesetText, {
            fontSize: '18px',
            color: '#ffffff',
            fontFamily: '"Pixeloid Sans"', // Readable font for text
            lineSpacing: 8,
            align: 'center'
        }).setOrigin(0.5, 0);

        contentContainer.add([inputsHeader, inputsContent, movesetHeader, movesetContent]);
    }

    private setupInput(): void {
        // Phaser's default behavior is to preventDefault on keys. For F1, this usually stops browser help.
        // We listen to the keydown event specifically.

        // Use a generic listener because F1 isn't always captured well by addKey during certain states
        this.scene.input.keyboard!.on('keydown-F1', (event: KeyboardEvent) => {
            event.preventDefault(); // Stop browser help menu
            this.toggle();
        });
    }

    public toggle(): void {
        this.isVisible = !this.isVisible;
        this.container.setVisible(this.isVisible);

        if (this.isVisible) {
            this.scene.sound.play('ui_confirm', { volume: 0.5 });
        } else {
            this.scene.sound.play('ui_back', { volume: 0.5 });
        }
    }

    public getElements(): Phaser.GameObjects.GameObject[] {
        return [this.container];
    }
}
