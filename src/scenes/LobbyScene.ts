import Phaser from 'phaser';
import { SMASH_COLORS } from '../ui/PlayerHUD';

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
    private mode: 'versus' | 'training' = 'versus';
    private initialInputType: 'KEYBOARD' | 'GAMEPAD' = 'KEYBOARD';
    private initialGamepadIndex: number | null = null;

    // UI Elements
    private slotContainers: Phaser.GameObjects.Container[] = [];
    private backKey!: Phaser.Input.Keyboard.Key;

    // Character Data
    private characters: CharacterType[] = ['fok_v3', 'sga', 'sgu'] as any;
    private charLabels: string[] = ['Fok', 'Sga', 'Sgu'];
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
        this.canInput = false; // Will be enabled after safety delay in create()
        this.frameInputs = { space: false, enter: false };
        this.prevGamepadSelect = false;
        this.sceneStartTime = Date.now();
    }

    preload(): void {
        this.load.atlas('fok_v3', 'assets/fok_v3/fok_v3.png', 'assets/fok_v3/fok_v3.json');
        this.load.atlas('sga', 'assets/sga/sga.png', 'assets/sga/sga.json');
        this.load.image('fok_icon', 'assets/fok_icon.png'); // Refinement V2
        this.load.image('sga_icon', 'assets/sga_icon.png');
        this.load.image('sgu_icon', 'assets/sgu_icon.png');
    }



    create(): void {
        console.log('LobbyScene.create called');
        this.slotContainers = []; // CRITICAL: Reset container references on scene restart

        const { width, height } = this.scale;

        // Background
        this.add.rectangle(0, 0, width, height, 0x000000).setOrigin(0);

        // Title
        const centerY = height / 2 + 20;
        const titleY = centerY - 150 - 50;
        const titleText = this.mode === 'training' ? 'TRAINING MODE' : 'BOTTE IN LOCALE';
        this.add.text(width / 2, titleY, titleText, {
            fontSize: '48px',
            color: '#ffffff',
            fontFamily: '"Pixeloid Sans"',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Instructions (Moved to bottom to avoid overlap with panels)
        const instructions = this.add.text(width / 2, height - 50, 'Join: [SPACE/ENTER] or [GAMEPAD A]  |  Ready: [SPACE/ENTER] or [GAMEPAD A]', {
            fontSize: '20px',
            color: '#8ab4f8',
            fontFamily: '"Pixeloid Sans"'
        }).setOrigin(0.5);

        // Add "Alive" pulse
        this.tweens.add({
            targets: instructions,
            alpha: 0.5,
            duration: 800,
            yoyo: true,
            repeat: -1
        });

        // Initialize Slots
        const slotCount = this.mode === 'versus' ? 4 : 2;
        this.slots = [];
        for (let i = 0; i < slotCount; i++) {
            this.slots.push({
                playerId: i,
                joined: false,
                ready: false,
                input: { type: 'KEYBOARD', gamepadIndex: null },
                character: 'fok_v3'
            });
        }


        this.createSlotUI();

        // Handle specific modes
        if (this.mode === 'training') {
            this.setupTrainingMode();
        }

        // CRITICAL: Reset keyboard state before adding keys
        // This prevents stale key states from previous scene causing freeze
        this.input.keyboard!.resetKeys();

        // Initialize Keys (fresh after reset)
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

        // Input safety delay: prevent ghost inputs from previous scene
        this.canInput = false;
        this.time.delayedCall(300, () => {
            this.canInput = true;
        });
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
        p2.character = 'fok_v3'; // Use valid character (dummy behavior is from isTrainingDummy flag)
    }

    private createSlotUI(): void {
        const { width } = this.scale;
        const count = this.slots.length;

        // Card dimensions (matching online lobby)
        const cardWidth = 180;
        const cardHeight = 300;
        const spacing = count <= 2 ? 260 : 200;
        const totalWidth = (count - 1) * spacing;
        const startX = width / 2 - totalWidth / 2;
        const centerY = this.scale.height / 2 + 20;

        // Ensure idle animations exist
        this.ensureIdleAnimations();

        for (let i = 0; i < count; i++) {
            const cx = startX + (i * spacing);
            const container = this.add.container(cx, centerY);

            // Player color for this slot
            const playerColor = SMASH_COLORS[i % SMASH_COLORS.length];
            const colorHex = '#' + playerColor.toString(16).padStart(6, '0');

            // Rounded Card Background
            const card = this.add.graphics();
            card.lineStyle(3, playerColor);
            card.fillStyle(0x000000, 0.4);
            card.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 16);
            card.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 16);

            // Player Label ("P1", "P2", etc.) at top of card
            const pLabel = this.add.text(0, 75, `P${i + 1}`, {
                fontSize: '20px',
                fontStyle: 'bold',
                fontFamily: '"Pixeloid Sans"',
                color: colorHex
            }).setOrigin(0.5);

            // State Text (Join / Select / Ready) - Moved to y=-45 to overlay sprite
            const stateText = this.add.text(0, -45, 'Press Button\nto Join', {
                fontSize: '22px',
                color: '#888888',
                fontFamily: '"Pixeloid Sans"',
                align: 'center'
            }).setOrigin(0.5);

            // Character Name (below label)
            const charText = this.add.text(0, 105, '', {
                fontSize: '22px',
                color: '#ffffff',
                fontFamily: '"Pixeloid Sans"',
                fontStyle: 'bold'
            }).setOrigin(0.5);

            // Selection Arrows (centered on card Y midpoint, equidistant from borders)
            const leftArrow = this.add.text(-70, 0, '◀', {
                fontSize: '28px',
                fontFamily: '"Pixeloid Sans"',
                color: colorHex
            }).setOrigin(0.5).setVisible(false);

            const rightArrow = this.add.text(70, 0, '▶', {
                fontSize: '28px',
                fontFamily: '"Pixeloid Sans"',
                color: colorHex
            }).setOrigin(0.5).setVisible(false);

            // Character Sprite (idle animation, centered above label area)
            const charSprite = this.add.sprite(0, -45, 'fok_v3', 'fok_v3_idle_000');
            charSprite.setScale(1);
            charSprite.setVisible(false);

            container.add([card, pLabel, charText, leftArrow, rightArrow, charSprite, stateText]);
            container.setData('card', card);
            container.setData('stateText', stateText);
            container.setData('charText', charText);
            container.setData('arrows', [leftArrow, rightArrow]);
            container.setData('charSprite', charSprite);
            container.setData('playerColor', playerColor);

            this.slotContainers.push(container);
        }
    }

    private ensureIdleAnimations(): void {
        const animConfigs: Record<string, { prefix: string; count: number }> = {
            'fok_v3': { prefix: 'Fok_v3_Idle_', count: 12 },
            'sga': { prefix: 'Sga_Idle_', count: 12 },
            'sgu': { prefix: 'Sgu_Idle_', count: 12 },
        };

        for (const [charKey, cfg] of Object.entries(animConfigs)) {
            const animKey = `${charKey}_idle`;
            if (!this.anims.exists(animKey)) {
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

    update(time: number, _delta: number): void {
        if (!this.canInput) return;

        // Capture inputs once per frame
        this.frameInputs.space = Phaser.Input.Keyboard.JustDown(this.keys.space);
        this.frameInputs.enter = Phaser.Input.Keyboard.JustDown(this.keys.enter);

        this.handleNewConnections();
        this.handleKeyboardJoin(); // Poll for join if not event-based
        this.handlePlayerInput(time);

        let goBack = Phaser.Input.Keyboard.JustDown(this.backKey);
        if (!goBack) {
            const gamepads = navigator.getGamepads();
            for (let i = 0; i < gamepads.length; i++) {
                const pad = gamepads[i];
                if (pad && pad.buttons[1] && pad.buttons[1].pressed) {
                    goBack = true;
                    break;
                }
            }
        }

        if (goBack) {
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
        const minPlayers = this.mode === 'versus' ? 2 : 1;
        if (joinedSlots.length >= minPlayers && joinedSlots.every(s => s.ready)) {
            console.log('All players ready! Starting game...');
            // Start Game
            this.time.delayedCall(500, () => {
                this.scene.start('GameScene', { playerData: joinedSlots });
            });
        } else {
            if (joinedSlots.length < minPlayers) {
                console.log(`Need at least ${minPlayers} players (have ${joinedSlots.length})`);
            } else {
                console.log('Not all players ready yet:', joinedSlots.map(s => `${s.playerId}: ${s.ready}`));
            }
        }
    }

    private updateUI(): void {
        this.slots.forEach((slot, i) => {
            const container = this.slotContainers[i];
            const card = container.getData('card') as Phaser.GameObjects.Graphics;
            const stateText = container.getData('stateText') as Phaser.GameObjects.Text;
            const charText = container.getData('charText') as Phaser.GameObjects.Text;
            const arrows = container.getData('arrows') as Phaser.GameObjects.Text[];
            const charSprite = container.getData('charSprite') as Phaser.GameObjects.Sprite;
            const playerColor = container.getData('playerColor') as number;

            const cardWidth = 180;
            const cardHeight = 300;

            if (slot.joined) {
                // Redraw card with player color (brighter when ready)
                card.clear();
                card.lineStyle(3, slot.ready ? 0x00ff00 : playerColor);
                card.fillStyle(0x000000, 0.4);
                card.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 16);
                card.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 16);

                // Show sprite & play idle
                charSprite.setVisible(true);
                const charKey = slot.character as string;
                const idleAnim = charKey === 'fok_v3' ? 'fok_v3_idle' : `${charKey}_idle`;
                if (charSprite.anims.currentAnim?.key !== idleAnim) {
                    charSprite.setTexture(charKey);
                    if (this.anims.exists(idleAnim)) {
                        charSprite.play(idleAnim, true);
                    }
                }

                if (slot.ready) {
                    stateText.setText('READY!');
                    stateText.setColor('#00ff00');
                    stateText.setFontSize(36);
                    stateText.setBackgroundColor('#004400'); // Overlay style
                    arrows.forEach(a => a.setVisible(false));
                } else {
                    if (this.mode === 'training' && i === 1 && this.selectionPhase === 'P1') {
                        stateText.setText('Waiting...');
                        stateText.setColor('#888888');
                        stateText.setFontSize(20);
                        stateText.setBackgroundColor(''); // Clear bg
                        arrows.forEach(a => a.setVisible(false));
                    } else if (this.mode === 'training' && i === 1 && this.selectionPhase === 'CPU') {
                        stateText.setText('SELECT CPU');
                        stateText.setColor('#ffff00');
                        stateText.setFontSize(20);
                        stateText.setBackgroundColor('');
                        arrows.forEach(a => a.setVisible(true));
                    } else {
                        stateText.setText('');
                        stateText.setBackgroundColor('');
                        arrows.forEach(a => a.setVisible(true));
                    }
                }

                const charIdx = this.characters.indexOf(slot.character);
                charText.setText(this.charLabels[charIdx]);
                charText.setVisible(true);

                if (slot.isTrainingDummy) {
                    if (slot.ready) {
                        stateText.setText('READY!');
                    } else if (this.selectionPhase === 'CPU') {
                        stateText.setText('SELECT CPU');
                    } else {
                        stateText.setText('DUMMY');
                    }
                }

            } else {
                // Empty slot
                card.clear();
                card.lineStyle(2, 0x333333);
                card.fillStyle(0x000000, 0.2);
                card.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 16);
                card.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 16);

                stateText.setText('Press\nto Join');
                stateText.setColor('#555555');
                stateText.setFontSize(20);
                stateText.setBackgroundColor('');
                charText.setVisible(false);
                charSprite.setVisible(false);
                arrows.forEach(a => a.setVisible(false));
            }
        });
    }
}
