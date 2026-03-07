import Phaser from 'phaser';
import { getConfirmButtonIndex, getBackButtonIndex, getMenuNavY } from '../input/JoyConMapper';
import { KeyboardMapping, keyCodeToLabel } from '../input/KeyboardMapping';

const MenuOption = {
    RESUME: 0,
    CONTROLS: 1,
    SETTINGS: 8,
    TRAINING: 3,
    SPAWN_DUMMY: 6,
    RESTART: 4,
    LOBBY: 7,
    MAP: 9,
    EXIT: 5
} as const;
type MenuOption = typeof MenuOption[keyof typeof MenuOption];

export class PauseMenu {
    private scene: Phaser.Scene;
    private overlay!: Phaser.GameObjects.Graphics;
    private titleText!: Phaser.GameObjects.Text;

    // UI Groups
    private mainMenuItems: Phaser.GameObjects.Text[] = [];

    // Selection Trackers
    private mainSelectedIndex: number = 0;

    private visible: boolean = false;

    private menuOptions: Array<{ label: string, value: MenuOption }> = [];

    private upKey!: Phaser.Input.Keyboard.Key;
    private downKey!: Phaser.Input.Keyboard.Key;
    private enterKey!: Phaser.Input.Keyboard.Key;
    private spaceKey!: Phaser.Input.Keyboard.Key;
    private escKey!: Phaser.Input.Keyboard.Key;

    // Gamepad state tracking
    private previousGamepadState = {
        up: false,
        down: false,
        left: false,
        right: false,
        a: false,
        b: false,
        start: false
    };

    private hintText!: Phaser.GameObjects.Text;
    private controlsContainer!: Phaser.GameObjects.Container;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.createMenu();
        this.createControlsPage();
        this.setupInput();
    }

    private createMenu(): void {
        const centerX = 400; // Placeholder, updated in layout

        // Create semi-transparent overlay
        this.overlay = this.scene.add.graphics();
        this.overlay.fillStyle(0x000000, 0.90); // Slightly darker for legibility
        this.overlay.fillRect(0, 0, 3000, 3000);
        this.overlay.setScrollFactor(0);
        this.overlay.setDepth(1000);
        this.overlay.setVisible(false);

        // Build dynamic options based on mode
        const mode = (this.scene as any).mode || 'versus';

        this.menuOptions = [
            { label: 'RIPRENDI', value: MenuOption.RESUME },
            { label: 'COMANDI', value: MenuOption.CONTROLS },
            { label: 'IMPOSTAZIONI', value: MenuOption.SETTINGS }
        ];

        if (mode === 'campaign') {
            this.menuOptions.push({ label: 'RITORNA ALLA MAPPA', value: MenuOption.MAP });
        } else {
            this.menuOptions.push({ label: 'SPAWN CPU', value: MenuOption.SPAWN_DUMMY });
            this.menuOptions.push({ label: 'RIAVVIA PARTITA', value: MenuOption.RESTART });
            this.menuOptions.push({ label: 'TORNA ALLA LOBBY', value: MenuOption.LOBBY });
        }

        this.menuOptions.push({ label: 'TORNA AL MENU', value: MenuOption.EXIT });

        // Title
        this.titleText = this.scene.add.text(centerX, 120, 'PAUSED', {
            fontSize: '64px',
            color: '#ffffff',
            fontStyle: 'bold',
            fontFamily: '"Pixeloid Sans"'
        });
        this.titleText.setOrigin(0.5);
        this.titleText.setScrollFactor(0);
        this.titleText.setDepth(1001);
        this.titleText.setVisible(false);

        // -- Main Menu Items --
        const startY = 220;
        const spacing = 50;

        this.menuOptions.forEach((option, index) => {
            const itemText = this.scene.add.text(centerX, startY + (index * spacing), option.label, {
                fontSize: '32px',
                color: '#ffffff',
                fontFamily: '"Pixeloid Sans"'
            });
            itemText.setOrigin(0.5);
            itemText.setScrollFactor(0);
            itemText.setDepth(1001);
            itemText.setVisible(false);
            itemText.setInteractive({ useHandCursor: true });

            itemText.on('pointerover', () => {
                this.mainSelectedIndex = index;
                this.updateSelection();
            });

            itemText.on('pointerdown', () => {
                this.mainSelectedIndex = index;
                this.updateSelection();
                this.selectOption();
            });

            this.mainMenuItems.push(itemText);
        });

        // Hint text
        this.hintText = this.scene.add.text(centerX, 550, '[ESC / START to Resume]', {
            fontSize: '18px',
            color: '#888888',
            fontFamily: '"Pixeloid Sans"'
        });
        this.hintText.setOrigin(0.5);
        this.hintText.setScrollFactor(0);
        this.hintText.setDepth(1001);
        this.hintText.setVisible(false);
    }

    private createControlsPage(): void {
        this.controlsContainer = this.scene.add.container(0, 0);
        this.controlsContainer.setScrollFactor(0);
        this.controlsContainer.setDepth(1001);
        this.controlsContainer.setVisible(false);

        // --- Layout: 3 columns (matches F1 ControlsOverlay) ---
        const w = this.scene.scale.width;
        const col1X = w * 0.18;
        const col2X = w * 0.50;
        const col3X = w * 0.82;
        const topY = 120;
        const headerStyle = { fontSize: '26px', fontStyle: 'bold', fontFamily: '"Pixeloid Sans"' };
        const bodyStyle = { fontSize: '16px', color: '#ffffff', fontFamily: '"Pixeloid Sans"', lineSpacing: 7 };

        // ═══ COLUMN 1: INPUT MAPPINGS ═══
        const col1Header = this.scene.add.text(col1X, topY, 'TASTI & GAMEPAD', {
            ...headerStyle, color: '#8ab4f8'
        }).setOrigin(0.5, 0);
        col1Header.setShadow(2, 2, '#000000', 0, false, true);

        const km = KeyboardMapping.getInstance();
        const lightKey = keyCodeToLabel(km.getKeyForAction('lightAttack'));
        const heavyKey = keyCodeToLabel(km.getKeyForAction('heavyAttack'));
        const jumpKey = keyCodeToLabel(km.getKeyForAction('jump'));
        const dodgeKey = keyCodeToLabel(km.getKeyForAction('dodge'));
        const tauntKey = keyCodeToLabel(km.getKeyForAction('taunt'));

        const inputLines = [
            'AZIONE          TASTI        GAMEPAD',
            '──────────────────────────────────────',
            `Muovi           WASD/Frec.   Stick L / D-Pad`,
            `Salta           ${jumpKey}          A`,
            `Att. Leggero    ${lightKey}            X`,
            `Att. Pesante    ${heavyKey}            B / Y`,
            `Schivata        ${dodgeKey}            LT / RT`,
            `Provoca         ${tauntKey}            R3 (Click)`,
            'Pausa           ESC          Start',
            '',
            'INTERAZIONI',
            '──────────────────────────────────────',
            `Apri Cassa      ${lightKey}            X`,
            '  (vicino alla cassa)',
            `Raccogli        ${lightKey}            X`,
            '  (vicino a oggetto)',
            `Lancia          ${lightKey}            X / RB`,
            '  (con oggetto in mano)',
        ].join('\n');

        const col1Body = this.scene.add.text(col1X, topY + 48, inputLines, bodyStyle).setOrigin(0.5, 0);

        // ═══ COLUMN 2: MOVESET GUIDE ═══
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

        // ═══ COLUMN 3: SYSTEM & DEBUG ═══
        const col3Header = this.scene.add.text(col3X, topY, 'SISTEMA', {
            ...headerStyle, color: '#81c995'
        }).setOrigin(0.5, 0);
        col3Header.setShadow(2, 2, '#000000', 0, false, true);

        const systemLines = [
            'COMUNE',
            '──────────────────────────────',
            'F1       Comandi (questo)',
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
            '• Switch Pro Controller e',
            '  Joy-Con singolo supportati',
            '  (remap automatico)',
            '• La carica si attiva',
            '  tenendo premuto Pesante',
            '• Gli attacchi si bufferizzano',
            '  automaticamente',
        ].join('\n');

        const col3Body = this.scene.add.text(col3X, topY + 48, systemLines, bodyStyle).setOrigin(0.5, 0);

        this.controlsContainer.add([col1Header, col1Body, col2Header, col2Body, col3Header, col3Body]);
    }

    private updateLayout(): void {
        const centerX = this.scene.scale.width / 2;
        const centerY = this.scene.scale.height / 2;

        this.titleText.setPosition(centerX, centerY - 250);
        this.hintText.setPosition(centerX, this.scene.scale.height - 50);

        const startY = centerY - 100;
        const spacing = 50;

        this.mainMenuItems.forEach((item, index) => {
            item.setPosition(centerX, startY + (index * spacing));
        });
    }

    private setupInput(): void {
        this.upKey = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
        this.downKey = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
        this.enterKey = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
        this.spaceKey = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.escKey = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    }

    // State
    private menuState: 'MAIN' | 'CONTROLS' = 'MAIN';

    show(): void {
        this.visible = true;
        this.menuState = 'MAIN'; // Reset to main menu
        this.mainSelectedIndex = 0;

        // Sound: Open (Player Ready -> Confirm Character)
        this.scene.sound.play('ui_confirm_character', { volume: 0.5 });

        // Sync gamepad state to prevent immediate re-trigger
        this.syncGamepadState();

        this.updateLayout();

        this.overlay.setVisible(true);
        this.showMainMenu();
    }

    hide(): void {
        this.visible = false;
        this.overlay.setVisible(false);
        this.hideMainMenu();
        this.hideControlsMenu();
    }

    isVisible(): boolean {
        return this.visible;
    }

    update(_delta: number): void {
        if (!this.visible) return;
        this.handleInput();
    }

    private showMainMenu(): void {
        const centerX = this.scene.scale.width / 2;
        const centerY = this.scene.scale.height / 2;

        this.titleText.setText('PAUSED');
        this.titleText.setPosition(centerX, centerY - 250);
        this.titleText.setVisible(true);
        this.hintText.setText('[ESC / START to Resume]');
        this.hintText.setVisible(true);
        this.controlsContainer.setVisible(false);
        this.mainMenuItems.forEach(item => item.setVisible(true));
        this.updateSelection();
    }

    private hideMainMenu(): void {
        this.titleText.setVisible(false);
        this.hintText.setVisible(false);
        this.mainMenuItems.forEach(item => item.setVisible(false));
    }

    private showControlsMenu(): void {
        const centerX = this.scene.scale.width / 2;

        this.titleText.setText('COMANDI DI GIOCO');
        this.titleText.setPosition(centerX, 60); // Matches F1 overlay exactly
        this.titleText.setVisible(true);

        this.controlsContainer.setVisible(true);

        this.hintText.setText('[ESC / B to Back]');
        this.hintText.setVisible(true);

        this.mainMenuItems.forEach(item => item.setVisible(false));
    }

    private hideControlsMenu(): void {
        this.controlsContainer.setVisible(false);
    }

    private handleInput(): void {
        const gp = this.getGamepadInput();

        if (this.menuState === 'MAIN') {
            if (Phaser.Input.Keyboard.JustDown(this.upKey) || gp.upPressed) {
                this.scene.sound.play('ui_move_cursor', { volume: 0.5 });
                this.mainSelectedIndex = (this.mainSelectedIndex - 1 + this.menuOptions.length) % this.menuOptions.length;
                this.updateSelection();
            } else if (Phaser.Input.Keyboard.JustDown(this.downKey) || gp.downPressed) {
                this.scene.sound.play('ui_move_cursor', { volume: 0.5 });
                this.mainSelectedIndex = (this.mainSelectedIndex + 1) % this.menuOptions.length;
                this.updateSelection();
            }

            if (Phaser.Input.Keyboard.JustDown(this.enterKey) || Phaser.Input.Keyboard.JustDown(this.spaceKey) || gp.aPressed) {
                this.selectOption();
            }

            if (Phaser.Input.Keyboard.JustDown(this.escKey) || gp.bPressed || gp.startPressed) {
                this.scene.sound.play('ui_back', { volume: 0.5 });
                this.executeOption(MenuOption.RESUME);
            }
        } else if (this.menuState === 'CONTROLS') {
            // Back to Main Menu
            if (Phaser.Input.Keyboard.JustDown(this.escKey) || gp.bPressed || gp.aPressed || gp.startPressed) {
                this.scene.sound.play('ui_back', { volume: 0.5 });
                this.menuState = 'MAIN';
                this.hideControlsMenu();
                this.showMainMenu();
            }
        }
    }

    private updateSelection(): void {
        this.mainMenuItems.forEach((item, index) => {
            if (index === this.mainSelectedIndex) {
                item.setColor('#ffdd00');
                item.setScale(1.1);
            } else {
                item.setColor('#ffffff');
                item.setScale(1.0);
            }
        });
    }

    private selectOption(): void {
        this.scene.sound.play('ui_confirm', { volume: 0.5 });
        const option = this.menuOptions[this.mainSelectedIndex].value;
        this.executeOption(option);
    }

    private executeOption(option: MenuOption): void {
        switch (option) {
            case MenuOption.RESUME:
                this.scene.events.emit('pauseMenuResume');
                break;
            case MenuOption.CONTROLS:
                this.menuState = 'CONTROLS';
                this.showControlsMenu();
                break;
            case MenuOption.SETTINGS:
                this.scene.events.emit('pauseMenuSettings');
                break;
            case MenuOption.SPAWN_DUMMY:
                this.scene.events.emit('spawnDummy');
                break;
            case MenuOption.RESTART:
                this.scene.events.emit('pauseMenuRestart');
                break;
            case MenuOption.LOBBY:
                this.scene.events.emit('pauseMenuLobby');
                break;
            case MenuOption.MAP:
                this.scene.events.emit('pauseMenuMap');
                break;
            case MenuOption.EXIT:
                this.scene.events.emit('pauseMenuExit');
                break;
        }
    }

    private getGamepadInput() {
        const gamepads = navigator.getGamepads();
        let currentState = {
            up: false, down: false, left: false, right: false,
            a: false, b: false, start: false
        };

        // Aggregate input from ALL connected gamepads (any player can navigate)
        for (let i = 0; i < gamepads.length; i++) {
            const gamepad = gamepads[i];
            if (gamepad) {
                const navY = getMenuNavY(gamepad);
                const confirmIdx = getConfirmButtonIndex(gamepad);
                const backIdx = getBackButtonIndex(gamepad);

                if (navY < 0) currentState.up = true;
                if (navY > 0) currentState.down = true;
                if (gamepad.buttons[confirmIdx]?.pressed) currentState.a = true;
                if (gamepad.buttons[backIdx]?.pressed) currentState.b = true;
                if (gamepad.buttons[9]?.pressed) currentState.start = true;
            }
        }

        const result = {
            upPressed: currentState.up && !this.previousGamepadState.up,
            downPressed: currentState.down && !this.previousGamepadState.down,
            aPressed: currentState.a && !this.previousGamepadState.a,
            bPressed: currentState.b && !this.previousGamepadState.b,
            startPressed: currentState.start && !this.previousGamepadState.start
        };

        this.previousGamepadState = currentState;
        return result;
    }

    private syncGamepadState(): void {
        const gamepads = navigator.getGamepads();
        let currentState = {
            up: false, down: false, left: false, right: false,
            a: false, b: false, start: false
        };

        for (let i = 0; i < gamepads.length; i++) {
            const gamepad = gamepads[i];
            if (gamepad) {
                const navY = getMenuNavY(gamepad);
                const confirmIdx = getConfirmButtonIndex(gamepad);
                const backIdx = getBackButtonIndex(gamepad);

                if (navY < 0) currentState.up = true;
                if (navY > 0) currentState.down = true;
                if (gamepad.buttons[confirmIdx]?.pressed) currentState.a = true;
                if (gamepad.buttons[backIdx]?.pressed) currentState.b = true;
                if (gamepad.buttons[9]?.pressed) currentState.start = true;
            }
        }
        this.previousGamepadState = currentState;
    }

    getElements(): Phaser.GameObjects.GameObject[] {
        return [this.overlay, this.titleText, this.hintText, this.controlsContainer, ...this.mainMenuItems];
    }
}
