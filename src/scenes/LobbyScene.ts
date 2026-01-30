import Phaser from 'phaser';

export type CharacterType = 'alchemist' | 'dude';

export interface PlayerSelection {
    playerId: number;
    joined: boolean;
    ready: boolean;
    input: {
        type: 'KEYBOARD' | 'GAMEPAD';
        gamepadIndex: number | null;
    };
    character: CharacterType;
    isAI?: boolean;
    isTrainingDummy?: boolean;
}

export class LobbyScene extends Phaser.Scene {
    private slots: PlayerSelection[] = [];
    private maxPlayers = 4;

    // UI Elements
    private slotContainers: Phaser.GameObjects.Container[] = [];
    private backKey!: Phaser.Input.Keyboard.Key;

    // Character Data
    private characters: CharacterType[] = ['alchemist', 'dude'];
    private charLabels: string[] = ['Bloody Alchemist', 'Dude'];

    // Input debounce
    private lastInputTime: Map<number, number> = new Map();

    constructor() {
        super({ key: 'LobbyScene' });
    }

    create(): void {
        const { width, height } = this.scale;

        // Background
        this.add.rectangle(0, 0, width, height, 0x1a1a2e).setOrigin(0);

        // Title
        this.add.text(width / 2, 80, 'CHARACTER SELECT', {
            fontSize: '48px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.add.text(width / 2, 130, 'Join: [SPACE/ENTER] or [GAMEPAD A]  |  Ready: [SPACE/ENTER] or [GAMEPAD A]', {
            fontSize: '20px',
            color: '#8ab4f8'
        }).setOrigin(0.5);

        // Initialize Slots
        this.slots = Array(4).fill(null).map((_, i) => ({
            playerId: i,
            joined: false,
            ready: false,
            input: { type: 'KEYBOARD', gamepadIndex: null },
            character: 'alchemist'
        }));

        this.createSlotUI();

        // Global Key Listeners for Keyboard Join
        this.input.keyboard!.on('keydown-SPACE', () => this.handleKeyboardJoin());
        this.input.keyboard!.on('keydown-ENTER', () => this.handleKeyboardJoin());
        this.backKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    }

    private createSlotUI(): void {
        const { width } = this.scale;
        const startX = width / 2 - 450;
        const spacing = 300;
        const startY = 300;

        for (let i = 0; i < this.maxPlayers; i++) {
            const container = this.add.container(startX + (i * spacing), startY);

            // BG Panel
            const panel = this.add.rectangle(0, 0, 280, 400, 0x333333);
            panel.setStrokeStyle(4, 0x000000);

            // Player Label
            const pLabel = this.add.text(0, -180, `P${i + 1}`, {
                fontSize: '32px',
                fontStyle: 'bold',
                color: '#aaaaaa'
            }).setOrigin(0.5);

            // State Text (Press to Join / Ready)
            const stateText = this.add.text(0, 0, 'Press Button\nto Join', {
                fontSize: '24px',
                color: '#888888',
                align: 'center'
            }).setOrigin(0.5);

            // Character Name (Hidden until joined)
            const charText = this.add.text(0, 150, '', {
                fontSize: '28px',
                color: '#ffffff',
                fontStyle: 'bold'
            }).setOrigin(0.5);

            // Selection Arrows (Hidden until joined)
            const leftArrow = this.add.text(-100, 150, '<', { fontSize: '32px', color: '#ffdd00' }).setOrigin(0.5).setVisible(false);
            const rightArrow = this.add.text(100, 150, '>', { fontSize: '32px', color: '#ffdd00' }).setOrigin(0.5).setVisible(false);

            container.add([panel, pLabel, stateText, charText, leftArrow, rightArrow]);
            container.setData('panel', panel);
            container.setData('stateText', stateText);
            container.setData('charText', charText);
            container.setData('arrows', [leftArrow, rightArrow]);

            this.slotContainers.push(container);
        }
    }

    update(time: number, _delta: number): void {
        this.handleNewConnections();
        this.handlePlayerInput(time);

        if (Phaser.Input.Keyboard.JustDown(this.backKey)) {
            this.scene.start('MainMenuScene');
        }

        // Toggle AI for Player 2 (Slot 1) with 'O' key
        if (this.input.keyboard!.checkDown(this.input.keyboard!.addKey('O'), 500)) {
            const p2Slot = this.slots[1];
            if (p2Slot.joined) {
                p2Slot.isAI = !p2Slot.isAI;
                p2Slot.isTrainingDummy = p2Slot.isAI; // Default to dummy if AI enabled
                // Auto-ready if AI?
                // p2Slot.ready = p2Slot.isAI; 
            } else {
                // If not joined, join as AI
                this.joinPlayer('KEYBOARD', null); // Join generic
                // Force into slot 1 if possible or just checks last joined?
                // joinPlayer finds first empty. If slot 0 taken, it takes slot 1.
                // We should probably rely on manual join first.
            }
        }

        this.updateUI();
    }

    private handleNewConnections(): void {
        const gamepads = navigator.getGamepads();

        for (let i = 0; i < gamepads.length; i++) {
            const gp = gamepads[i];
            if (!gp) continue;

            // Check if this gamepad is already assigned
            const isAssigned = this.slots.some(s => s.joined && s.input.type === 'GAMEPAD' && s.input.gamepadIndex === gp.index);

            if (!isAssigned) {
                // If any button pressed, join
                const anyPressed = gp.buttons.some(b => b.pressed);
                if (anyPressed) {
                    this.joinPlayer('GAMEPAD', gp.index);
                }
            }
        }
    }

    private handleKeyboardJoin(): void {
        const isAssigned = this.slots.some(s => s.joined && s.input.type === 'KEYBOARD');
        if (!isAssigned) {
            this.joinPlayer('KEYBOARD', null);
        }
    }

    private joinPlayer(type: 'KEYBOARD' | 'GAMEPAD', index: number | null): void {
        // Find first empty slot
        const slot = this.slots.find(s => !s.joined);
        if (slot) {
            slot.joined = true;
            slot.input.type = type;
            slot.input.gamepadIndex = index;
            slot.character = 'alchemist'; // Default

            // Assign random color to panel
            const colors = [0xff5555, 0x5555ff, 0x55ff55, 0xffff55];
            const container = this.slotContainers[slot.playerId];
            const panel = container.getData('panel') as Phaser.GameObjects.Rectangle;
            panel.setFillStyle(0x444444);
            panel.setStrokeStyle(4, colors[slot.playerId]);
        }
    }

    private handlePlayerInput(time: number): void {
        this.slots.forEach(slot => {
            if (!slot.joined) return;

            // Debounce
            const lastTime = this.lastInputTime.get(slot.playerId) || 0;
            if (time - lastTime < 200) return; // 200ms debounce

            let left = false;
            let right = false;
            let select = false;

            // Poll Input
            if (slot.input.type === 'KEYBOARD') {
                const cursors = this.input.keyboard!.createCursorKeys();
                left = cursors.left.isDown || this.input.keyboard!.checkDown(this.input.keyboard!.addKey('A'));
                right = cursors.right.isDown || this.input.keyboard!.checkDown(this.input.keyboard!.addKey('D'));
                select = this.input.keyboard!.checkDown(this.input.keyboard!.addKey('SPACE')) || this.input.keyboard!.checkDown(this.input.keyboard!.addKey('ENTER'));
            } else if (slot.input.type === 'GAMEPAD' && slot.input.gamepadIndex !== null) {
                const gp = navigator.getGamepads()[slot.input.gamepadIndex];
                if (gp) {
                    left = gp.axes[0] < -0.5 || gp.buttons[14]?.pressed;
                    right = gp.axes[0] > 0.5 || gp.buttons[15]?.pressed;
                    select = gp.buttons[0]?.pressed; // A
                }
            }

            // Logic
            let inputRegistered = false;
            if (!slot.ready) {
                if (left) {
                    this.changeCharacter(slot, -1);
                    inputRegistered = true;
                } else if (right) {
                    this.changeCharacter(slot, 1);
                    inputRegistered = true;
                } else if (select) {
                    slot.ready = true;
                    inputRegistered = true;
                    this.checkAllReady();
                }
            } else {
                if (select) {
                    // Toggle ready off if pressed again? Optionally.
                    // For now, let's keep it locked.
                }
            }

            if (inputRegistered) {
                this.lastInputTime.set(slot.playerId, time);
            }
        });
    }

    private changeCharacter(slot: PlayerSelection, dir: number): void {
        const idx = this.characters.indexOf(slot.character);
        const newIdx = (idx + dir + this.characters.length) % this.characters.length;
        slot.character = this.characters[newIdx];
    }

    private checkAllReady(): void {
        const joinedSlots = this.slots.filter(s => s.joined);
        if (joinedSlots.length > 0 && joinedSlots.every(s => s.ready)) {
            // Start Game
            this.time.delayedCall(500, () => {
                this.scene.start('GameScene', { playerData: joinedSlots });
            });
        }
    }

    private updateUI(): void {
        this.slots.forEach((slot, i) => {
            const container = this.slotContainers[i];
            const stateText = container.getData('stateText') as Phaser.GameObjects.Text;
            const charText = container.getData('charText') as Phaser.GameObjects.Text;
            const arrows = container.getData('arrows') as Phaser.GameObjects.Text[];

            if (slot.joined) {
                if (slot.ready) {
                    stateText.setText('READY!');
                    stateText.setColor('#00ff00');
                    stateText.setFontSize(40);
                    arrows.forEach(a => a.setVisible(false));
                } else {
                    stateText.setText('Select Character');
                    stateText.setColor('#ffff00');
                    stateText.setFontSize(24);
                    arrows.forEach(a => a.setVisible(true));
                }

                // Update Character Label
                const charIdx = this.characters.indexOf(slot.character);
                charText.setText(this.charLabels[charIdx]);
                charText.setVisible(true);

                // AI Indicator override
                if (slot.isAI) {
                    stateText.setText(slot.isTrainingDummy ? 'TRAINING DUMMY' : 'CPU PLAYER');
                    stateText.setColor('#ff5555');
                    stateText.setFontSize(28);
                } else if (slot.ready) {
                    stateText.setText('READY!');
                    stateText.setColor('#00ff00');
                    stateText.setFontSize(40);
                } // ... rest handled by previous logic if not AI


            } else {
                stateText.setText('Press Button\nto Join');
                stateText.setColor('#888888');
                stateText.setFontSize(24);
                charText.setVisible(false);
                arrows.forEach(a => a.setVisible(false));
            }
        });
    }
}
