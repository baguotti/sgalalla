import Phaser from 'phaser';

type CharacterType = 'fok_v3' | 'dummy';

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
    private mode: 'versus' | 'training' = 'versus';
    private initialInputType: 'KEYBOARD' | 'GAMEPAD' = 'KEYBOARD';
    private initialGamepadIndex: number | null = null;

    // UI Elements
    private slotContainers: Phaser.GameObjects.Container[] = [];
    private backKey!: Phaser.Input.Keyboard.Key;

    // Character Data
    private characters: CharacterType[] = ['fok_v3'] as any; // Refinement: Only fok_v3
    private charLabels: string[] = ['Fok']; // Refinement: Display "Fok" for fok_v3
    // P1_KEYS removed (unused in Lobby)

    // Input debounce & Safety
    private lastInputTime: Map<number, number> = new Map();
    private joinTime: Map<number, number> = new Map(); // Track when player joined to prevent instant ready
    private canInput: boolean = false;
    private _initData: any = null;
    private sceneStartTime: number = 0;

    // Frame inputs (capture once per update to avoid JustDown clearing)
    private frameInputs = {
        space: false,
        enter: false
    };

    // Gamepad edge detection for Training mode
    private prevGamepadSelect: boolean = false;

    // Keys
    private keys!: {
        left: Phaser.Input.Keyboard.Key;
        right: Phaser.Input.Keyboard.Key;
        up: Phaser.Input.Keyboard.Key;
        down: Phaser.Input.Keyboard.Key;
        space: Phaser.Input.Keyboard.Key;
        enter: Phaser.Input.Keyboard.Key;
        w: Phaser.Input.Keyboard.Key;
        a: Phaser.Input.Keyboard.Key;
        s: Phaser.Input.Keyboard.Key;
        d: Phaser.Input.Keyboard.Key;
    };

    constructor() {
        super({ key: 'LobbyScene' });
    }

    init(data: { mode?: 'versus' | 'training', inputType?: 'KEYBOARD' | 'GAMEPAD', gamepadIndex?: number | null, slots?: PlayerSelection[] } | null): void {
        console.log('LobbyScene.init called');
        this.selectionPhase = 'P1'; // Reset phase
        const safeData = data || {};
        this._initData = safeData;
        void this._initData; // Silence linter
        this.mode = safeData.mode || 'versus';
        this.initialInputType = safeData.inputType || 'KEYBOARD';
        this.initialGamepadIndex = safeData.gamepadIndex !== undefined ? safeData.gamepadIndex : null;

        // Reset state
        this.lastInputTime.clear();
        this.joinTime.clear();
        this.canInput = true; // Enable immediately to debug freeze
        this.frameInputs = { space: false, enter: false };
        this.prevGamepadSelect = false;
        this.sceneStartTime = Date.now();
    }



    create(): void {
        console.log('LobbyScene.create called');
        this.slotContainers = []; // CRITICAL: Reset container references on scene restart

        const { width, height } = this.scale;

        // Background
        this.add.rectangle(0, 0, width, height, 0x1a1a2e).setOrigin(0);

        // Title
        const titleText = this.mode === 'training' ? 'TRAINING MODE' : 'CHARACTER SELECT';
        this.add.text(width / 2, 60, titleText, {
            fontSize: '48px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Instructions (Moved to bottom to avoid overlap with panels)
        const instructions = this.add.text(width / 2, height - 50, 'Join: [SPACE/ENTER] or [GAMEPAD A]  |  Ready: [SPACE/ENTER] or [GAMEPAD A]', {
            fontSize: '20px',
            color: '#8ab4f8'
        }).setOrigin(0.5);

        // Add "Alive" pulse
        this.tweens.add({
            targets: instructions,
            alpha: 0.5,
            duration: 800,
            yoyo: true,
            repeat: -1
        });

        // Initialize Slots (need at least 2 for training mode)
        this.slots = [
            {
                playerId: 0,
                joined: false,
                ready: false,
                input: { type: 'KEYBOARD', gamepadIndex: null },
                character: 'fok_v3'
            },
            {
                playerId: 1,
                joined: false,
                ready: false,
                input: { type: 'KEYBOARD', gamepadIndex: null },
                character: 'fok_v3'
            }
        ];


        this.createSlotUI();

        // Handle specific modes
        if (this.mode === 'training') {
            this.setupTrainingMode();
        }

        // Initialize Keys
        this.keys = {
            left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
            right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
            up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
            down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
            space: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
            enter: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
            w: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            a: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            s: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            d: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D)
        };

        this.backKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

        // Input safety delay removed, canInput set in initKeyboard Join (Only active after safety delay)
        // We handle joins in update loop now to respect canInput easily, or add checks here.
        // Let's stick to update loop for consistency or add checks.
    }

    private selectionPhase: 'P1' | 'CPU' = 'P1';

    private setupTrainingMode(): void {
        // Auto-join P1 (if keyboard)
        const p1 = this.slots[0];
        p1.joined = true;
        p1.input.type = this.initialInputType;
        p1.input.gamepadIndex = this.initialGamepadIndex;
        // P1 starts NOT ready

        // Auto-join P2 as Dummy
        const p2 = this.slots[1];
        p2.joined = true;
        p2.input.type = 'KEYBOARD'; // Placeholder
        p2.isAI = true;
        p2.isTrainingDummy = true;
        p2.ready = false; // Dummy starts NOT ready (waiting for selection)
        p2.character = 'dummy'; // Default to dummy
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

            // State Text
            const stateText = this.add.text(0, 0, 'Press Button\nto Join', {
                fontSize: '24px',
                color: '#888888',
                align: 'center'
            }).setOrigin(0.5);

            // Character Name
            const charText = this.add.text(0, 150, '', {
                fontSize: '28px',
                color: '#ffffff',
                fontStyle: 'bold'
            }).setOrigin(0.5);

            // Selection Arrows
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
        if (!this.canInput) return;

        // Capture inputs once per frame
        this.frameInputs.space = Phaser.Input.Keyboard.JustDown(this.keys.space);
        this.frameInputs.enter = Phaser.Input.Keyboard.JustDown(this.keys.enter);

        this.handleNewConnections();
        this.handleKeyboardJoin(); // Poll for join if not event-based
        this.handlePlayerInput(time);

        if (Phaser.Input.Keyboard.JustDown(this.backKey)) {
            this.scene.start('MainMenuScene');
        }

        this.updateUI();
    }

    private handleNewConnections(): void {
        if (this.mode === 'training') return; // No new joins in training mode

        const gamepads = navigator.getGamepads();

        for (let i = 0; i < gamepads.length; i++) {
            const gp = gamepads[i];
            if (!gp) continue;

            const isAssigned = this.slots.some(s => s.joined && s.input.type === 'GAMEPAD' && s.input.gamepadIndex === gp.index);

            if (!isAssigned) {
                const anyPressed = gp.buttons.some(b => b.pressed);
                if (anyPressed) {
                    this.joinPlayer('GAMEPAD', gp.index);
                }
            }
        }
    }

    private handleKeyboardJoin(): void {
        if (this.mode === 'training' && this.slots[0].joined) return; // P1 already joined in training

        // Check for join inputs using frame cache
        const joinPressed = this.frameInputs.space || this.frameInputs.enter;

        if (joinPressed) {
            const isAssigned = this.slots.some(s => s.joined && s.input.type === 'KEYBOARD');
            if (!isAssigned) {
                this.joinPlayer('KEYBOARD', null);
            }
        }
    }

    private joinPlayer(type: 'KEYBOARD' | 'GAMEPAD', index: number | null): void {
        const slot = this.slots.find(s => !s.joined);
        if (slot) {
            slot.joined = true;
            slot.input.type = type;
            slot.input.gamepadIndex = index;
            slot.character = 'fok_v3';

            // Prevent immediate "Ready" input in the same frame
            // Set input time to now so the debounce check in handlePlayerInput fails
            this.lastInputTime.set(slot.playerId, this.time.now);
            this.joinTime.set(slot.playerId, this.time.now);
            console.log(`[LobbyScene] Player ${slot.playerId + 1} joined via ${type}, gamepadIndex=${index}`);
        }
    }

    private handlePlayerInput(time: number): void {
        // Special Training Mode Handling
        if (this.mode === 'training') {
            this.handleTrainingInput(time);
            return;
        }

        this.slots.forEach(slot => {
            if (!slot.joined) return;
            if (slot.isAI) return; // Skip input for Dummy/AI

            // Debounce for Hold inputs (arrows/stick), separate from Button press (Ready)
            const lastTime = this.lastInputTime.get(slot.playerId) || 0;
            const canHoldInput = time - lastTime > 200;

            let left = false;
            let right = false;
            let select = false;

            if (slot.input.type === 'KEYBOARD') {
                if (canHoldInput) {
                    left = this.keys.left.isDown || this.keys.a.isDown;
                    right = this.keys.right.isDown || this.keys.d.isDown;
                }

                // Use JustDown for Ready to prevent accidental double-tap from Join
                // Also respect joinTime to prevent join keypress from triggering ready
                // BUT do NOT use canHoldInput (nav debounce) so we don't block ready after moving
                const joinedTime = this.joinTime.get(slot.playerId) || 0;
                if (time - joinedTime > 200) {
                    select = this.frameInputs.space || this.frameInputs.enter;
                }

            } else if (slot.input.type === 'GAMEPAD' && slot.input.gamepadIndex !== null) {
                const gp = navigator.getGamepads()[slot.input.gamepadIndex];
                if (gp) {
                    if (canHoldInput) {
                        left = gp.axes[0] < -0.5 || gp.buttons[14]?.pressed;
                        right = gp.axes[0] > 0.5 || gp.buttons[15]?.pressed;
                    }

                    if (canHoldInput) {
                        select = gp.buttons[0]?.pressed; // A Button
                    }
                }
            }

            let inputRegistered = false;
            if (!slot.ready) {
                if (left) {
                    this.changeCharacter(slot, -1);
                    inputRegistered = true;
                } else if (right) {
                    this.changeCharacter(slot, 1);
                    inputRegistered = true;
                } else if (select) {
                    // SAFETY: Prevent immediate ready if scene just started (prevent held button carryover)
                    if (Date.now() - this.sceneStartTime > 500) {
                        slot.ready = true;
                        inputRegistered = true;
                        this.checkAllReady();
                    }
                }
            } else {
                // If ready, allow un-ready with Back/B?
                // Not implemented yet, but good idea.
            }

            if (inputRegistered) {
                this.lastInputTime.set(slot.playerId, time);
            }
        });
    }

    private handleTrainingInput(time: number): void {
        const p1 = this.slots[0];
        const cpu = this.slots[1];

        // Target slot depends on phase
        const targetSlot = this.selectionPhase === 'P1' ? p1 : cpu;

        // Use P1 input device to control targetSlot
        const lastTime = this.lastInputTime.get(0) || 0;
        const canHoldInput = time - lastTime > 200;

        let left = false;
        let right = false;
        let select = false;

        if (p1.input.type === 'KEYBOARD') {
            if (canHoldInput) {
                left = this.keys.left.isDown || this.keys.a.isDown;
                right = this.keys.right.isDown || this.keys.d.isDown;
            }
            // Debounce select - use Date.now() to compare with sceneStartTime (also Date.now())
            if (Date.now() - this.sceneStartTime > 500) {
                select = this.frameInputs.space || this.frameInputs.enter;
            }
        } else if (p1.input.type === 'GAMEPAD' && p1.input.gamepadIndex !== null) {
            const gp = navigator.getGamepads()[p1.input.gamepadIndex];
            if (gp) {
                if (canHoldInput) {
                    left = gp.axes[0] < -0.5 || gp.buttons[14]?.pressed;
                    right = gp.axes[0] > 0.5 || gp.buttons[15]?.pressed;
                }
                // Edge detection for select: only trigger on button DOWN, not held
                const currentSelect = gp.buttons[0]?.pressed ?? false;
                if (Date.now() - this.sceneStartTime > 500) {
                    select = currentSelect && !this.prevGamepadSelect;
                }
                this.prevGamepadSelect = currentSelect;
            }
        }

        let inputRegistered = false;
        if (left) {
            this.changeCharacter(targetSlot, -1);
            inputRegistered = true;
        } else if (right) {
            this.changeCharacter(targetSlot, 1);
            inputRegistered = true;
        } else if (select) {
            console.log(`[LobbyScene] Select Pressed. Phase: ${this.selectionPhase}`);
            if (this.selectionPhase === 'P1') {
                p1.ready = true;
                this.selectionPhase = 'CPU';
                inputRegistered = true;
                console.log('[LobbyScene] Switched to CPU Phase');
            } else {
                cpu.ready = true;
                inputRegistered = true;
                console.log('[LobbyScene] Starting Game');
                this.startTrainingGame();
            }
        }

        if (inputRegistered) {
            this.lastInputTime.set(0, time);
        }
    }

    private startTrainingGame(): void {
        console.log('Training Setup Complete. Starting game...');
        this.time.delayedCall(500, () => {
            this.scene.start('GameScene', { playerData: [this.slots[0], this.slots[1]] });
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
            console.log('All players ready! Starting game...');
            // Start Game
            this.time.delayedCall(500, () => {
                this.scene.start('GameScene', { playerData: joinedSlots });
            });
        } else {
            console.log('Not all players ready yet:', joinedSlots.map(s => `${s.playerId}: ${s.ready}`));
        }
    }

    private updateUI(): void {
        this.slots.forEach((slot, i) => {
            const container = this.slotContainers[i];
            const panel = container.getData('panel') as Phaser.GameObjects.Rectangle;
            const stateText = container.getData('stateText') as Phaser.GameObjects.Text;
            const charText = container.getData('charText') as Phaser.GameObjects.Text;
            const arrows = container.getData('arrows') as Phaser.GameObjects.Text[];

            if (slot.joined) {
                // Color panel based on ready
                panel.setFillStyle(0x444444);
                panel.setStrokeStyle(4, slot.ready ? 0x00ff00 : 0xffff00);

                if (slot.ready) {
                    stateText.setText('READY!');
                    stateText.setColor('#00ff00');
                    stateText.setFontSize(40);
                    arrows.forEach(a => a.setVisible(false));
                } else {
                    if (this.mode === 'training' && i === 1 && this.selectionPhase === 'P1') {
                        // CPU Waiting for P1
                        stateText.setText('Waiting for P1...');
                        stateText.setColor('#888888');
                        stateText.setFontSize(24);
                        arrows.forEach(a => a.setVisible(false));
                    } else if (this.mode === 'training' && i === 1 && this.selectionPhase === 'CPU') {
                        // CPU Selection Active
                        stateText.setText('SELECT CPU');
                        stateText.setColor('#ffff00');
                        stateText.setFontSize(24);
                        arrows.forEach(a => a.setVisible(true));
                    } else {
                        stateText.setText('Select Character');
                        stateText.setColor('#ffff00');
                        stateText.setFontSize(24);
                        arrows.forEach(a => a.setVisible(true));
                    }
                }

                const charIdx = this.characters.indexOf(slot.character);
                charText.setText(this.charLabels[charIdx]);
                charText.setVisible(true);

                if (slot.isTrainingDummy) {
                    // Update: Override "TRAINING DUMMY" text with state if selecting
                    if (this.selectionPhase === 'CPU') {
                        stateText.setText('SELECT CPU');
                    } else if (slot.ready) {
                        stateText.setText('READY!');
                    } else {
                        // Default
                        stateText.setText('TRAINING DUMMY');
                    }
                }

            } else {
                panel.setFillStyle(0x222222);
                panel.setStrokeStyle(4, 0x000000);

                stateText.setText('Press Button\nto Join');
                stateText.setColor('#888888');
                stateText.setFontSize(24);
                charText.setVisible(false);
                arrows.forEach(a => a.setVisible(false));
            }
        });
    }
}
