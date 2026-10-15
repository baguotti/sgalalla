import Phaser from 'phaser';
import { AudioManager } from '../managers/AudioManager';
import { SMASH_COLORS } from '../ui/PlayerHUD';
import { cardPositions, PlayerCard, type CardState } from '../ui/PlayerCard';
import { MenuInput, type MenuAction } from '../input/MenuInput';
import { STAGES, STAGE_KEYS, loadStagePreviews, previewKey } from '../stages/StageBackgrounds';

type CharacterType = 'fok' | 'dummy';


export interface PlayerSelection {
    playerId: number;
    joined: boolean;
    ready: boolean;
    input: {
        type: 'KEYBOARD' | 'GAMEPAD';
        gamepadIndex: number | null;
        keyboardMapping?: 'all';
        mappingSlot?: number; // Which gamepad mapping slot to use (0 or 1)
    };
    character: CharacterType;
    isAI?: boolean;
    isTrainingDummy?: boolean;
}

export class LobbyScene extends Phaser.Scene {
    private slots: PlayerSelection[] = [];
    private mode: 'versus' | 'training' | 'campaign' = 'versus';
    private initialInputType: 'KEYBOARD' | 'GAMEPAD' = 'KEYBOARD';
    private initialGamepadIndex: number | null = null;

    // UI Elements
    private cards: PlayerCard[] = [];

    // Character Data
    private characters: CharacterType[] = ['fok', 'sgu', 'sga', 'pe', 'nock', 'greg'] as any;

    // Input
    private menuInput!: MenuInput;
    private canInput: boolean = false;
    private _initData: any = null;


    constructor() {
        super({ key: 'LobbyScene' });
    }

    init(data: { mode?: 'versus' | 'training', inputType?: 'KEYBOARD' | 'GAMEPAD', gamepadIndex?: number | null, slots?: PlayerSelection[] } | null): void {
        this.selectionPhase = 'P1'; // Reset phase
        this.selectedMapIndex = 0;
        const safeData = data || {};
        this._initData = safeData;
        void this._initData; // Silence linter
        this.mode = safeData.mode || 'versus';
        this.initialInputType = safeData.inputType || 'KEYBOARD';
        this.initialGamepadIndex = safeData.gamepadIndex !== undefined ? safeData.gamepadIndex : null;

        // Reset state
        this.canInput = false; // Will be enabled after safety delay in create()
    }

    preload(): void {
        this.load.atlas('fok', 'assets/fok/fok.png', 'assets/fok/fok.json');

        // Audio
        this.load.audio('ui_player_found', 'assets/audio/ui/ui_player_found.wav');
        this.load.audio('ui_change_character', 'assets/audio/ui/ui_change_character.wav');
        this.load.audio('ui_confirm_character', 'assets/audio/ui/ui_confirm_character.wav');
        this.load.audio('ui_back', 'assets/audio/ui/ui_back.wav');
        this.load.audio('ui_player_ready', 'assets/audio/ui/ui_player_ready.wav');

        loadStagePreviews(this);
    }



    create(): void {
        this.cards = []; // The scene object survives restarts: drop the previous visit's cards

        const { width, height } = this.scale;

        // Background
        this.add.rectangle(0, 0, width, height, 0x000000).setOrigin(0);

        // Ensure Global Music Volume (Restore to user setting)
        const audioManager = AudioManager.getInstance();
        const music = this.sound.get('global_music_loop');
        if (music && music.isPlaying) {
            this.tweens.add({
                targets: music,
                volume: audioManager.getMusicVolume(),
                duration: 1000
            });
        }

        // Title
        const centerY = height / 2 + 20;
        const titleY = centerY - 150 - 50;
        let titleText = 'SCEGLI IL TUO MANICO';
        if (this.mode === 'training') titleText = 'MODALITÀ ALLENAMENTO';
        if (this.mode === 'campaign') titleText = 'CAMPAGNA SINGOLO GIOCATORE';

        this.add.text(width / 2, titleY, titleText, {
            fontSize: '48px',
            color: '#ffffff',
            fontFamily: '"Pixeloid Sans"',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Instructions (Moved to bottom to avoid overlap with panels)
        const instructions = this.add.text(width / 2, height - 50, 'Entra: [SPAZIO/INVIO] o [GAMEPAD A]  |  Pronto: [SPAZIO/INVIO] o [GAMEPAD A]', {
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
        let slotCount = 6; // Support 6 players in versus
        if (this.mode === 'training') slotCount = 2;
        if (this.mode === 'campaign') slotCount = 1; // Campaign only needs 1 central slot

        this.slots = [];
        for (let i = 0; i < slotCount; i++) {
            this.slots.push({
                playerId: i,
                joined: false,
                ready: false,
                input: { type: 'KEYBOARD', gamepadIndex: null, keyboardMapping: 'all' },
                character: 'fok'
            });
        }


        this.createSlotUI();

        // Handle specific modes or Auto-Join from Main Menu
        if (this.mode === 'training') {
            this.setupTrainingMode();
        } else if (this.mode === 'versus') {
            // If we came from Main Menu with a specific input, auto-join P1
            if (this.initialInputType === 'GAMEPAD' && this.initialGamepadIndex !== null) {
                this.joinPlayer('GAMEPAD', this.initialGamepadIndex);
            } else if (this.initialInputType === 'KEYBOARD') {
                this.joinPlayer('KEYBOARD', null);
            }
        } else if (this.mode === 'campaign') {
            // Auto-join P1 for campaign selection
            const p1 = this.slots[0];
            p1.joined = true;
            p1.input.type = this.initialInputType;
            p1.input.gamepadIndex = this.initialGamepadIndex;
        }

        // CRITICAL: Reset keyboard state before adding keys
        // This prevents stale key states from previous scene causing freeze
        this.input.keyboard!.resetKeys();

        this.menuInput = new MenuInput(this);

        // Input safety delay: prevent ghost inputs from previous scene
        this.canInput = false;
        this.time.delayedCall(500, () => this.canInput = true);
    }

    private selectionPhase: 'P1' | 'CPU' | 'MAP' = 'P1';
    private selectedMapIndex: number = 0;
    private mapUIContainer?: Phaser.GameObjects.Container;
    private mapNameText?: Phaser.GameObjects.Text;
    private mapPreview?: Phaser.GameObjects.Image;

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
        p2.input.type = 'KEYBOARD';
        p2.input.keyboardMapping = 'all';
        p2.isAI = true;
        p2.isTrainingDummy = true;
        p2.ready = false; // Dummy starts NOT ready (waiting for selection)
        p2.character = 'fok'; // Use valid character (dummy behavior is from isTrainingDummy flag)
    }

    private createSlotUI(): void {
        const centerY = this.scale.height / 2 + 20;
        this.cards = cardPositions(this.scale.width, this.slots.length).map((x, i) => {
            // Campaign uses white for P1
            const colour = this.mode === 'campaign' ? 0xffffff : SMASH_COLORS[i % SMASH_COLORS.length];
            return new PlayerCard(this, x, centerY, `P${i + 1}`, colour);
        });
    }

    update(): void {
        // Polled during the safety delay too, so what's pressed then is used up
        const presses = this.menuInput.poll();
        if (!this.canInput) return;

        for (const { action, pad } of presses) {
            // Back, or a gamepad's Start, leaves
            if (action === 'back' || (action === 'start' && pad !== null)) {
                AudioManager.getInstance().playSFX('ui_back', { volume: 0.5 });
                this.scene.start('MainMenuScene');
                return;
            }
            if (this.mode === 'training' || this.mode === 'campaign') {
                // Player 1 picks both fighters, then the stage
                if (this.isPlayerOneDevice(pad)) this.onTrainingPress(action);
                continue;
            }
            // A confirm from a device that hasn't joined joins it, and does nothing else
            if (action === 'confirm' && this.joinDevice(pad)) continue;
            const slot = this.slots.find(s => s.joined && !s.isAI && (pad === null
                ? s.input.type === 'KEYBOARD'
                : s.input.type === 'GAMEPAD' && s.input.gamepadIndex === pad));
            if (slot) this.onPlayerPress(slot, action);
        }

        this.updateUI();
    }

    /** Joins the keyboard (pad null) or a gamepad as a new player, if it hasn't joined; true if it did. */
    private joinDevice(pad: number | null): boolean {
        const joined = this.slots.some(s => s.joined && (pad === null
            ? s.input.type === 'KEYBOARD'
            : s.input.type === 'GAMEPAD' && s.input.gamepadIndex === pad));
        if (joined || !this.slots.some(s => !s.joined)) return false;
        if (pad === null) this.joinPlayer('KEYBOARD', null, 'all');
        else this.joinPlayer('GAMEPAD', pad);
        return true;
    }

    private joinPlayer(type: 'KEYBOARD' | 'GAMEPAD', index: number | null, keyboardMapping: 'all' = 'all'): void {
        const slot = this.slots.find(s => !s.joined);
        if (slot) {
            slot.joined = true;
            slot.input.type = type;
            slot.input.gamepadIndex = index;
            slot.input.keyboardMapping = keyboardMapping;
            slot.character = 'fok';

            // Assign mapping slot for gamepads based on join order
            if (type === 'GAMEPAD') {
                const gamepadCount = this.slots.filter(s => s.joined && s.input.type === 'GAMEPAD' && s !== slot).length;
                slot.input.mappingSlot = Math.min(gamepadCount, 1); // 0 for first, 1 for second
            }

            AudioManager.getInstance().playSFX('ui_player_found', { volume: 0.5 });

        }
    }

    /** Versus: each player picks a fighter and gets ready; then player 1 picks the stage. */
    private onPlayerPress(slot: typeof this.slots[number], action: MenuAction): void {
        if (this.selectionPhase === 'MAP') {
            if (slot.playerId !== 0) return;
            if (action === 'left') this.changeMap(-1);
            else if (action === 'right') this.changeMap(1);
            else if (action === 'confirm') {
                AudioManager.getInstance().playSFX('ui_confirm_character', { volume: 0.6 });
                this.hideMapSelection();
                const joinedSlots = this.slots.filter(s => s.joined);
                this.time.delayedCall(500, () => {
                    this.scene.start('GameScene', {
                        playerData: joinedSlots,
                        mode: this.mode,
                        slotIndex: (this._initData as any)?.slotIndex ?? 0,
                        selectedMap: STAGE_KEYS[this.selectedMapIndex]
                    });
                });
            }
        } else if (!slot.ready) {
            if (action === 'left') this.changeCharacter(slot, -1);
            else if (action === 'right') this.changeCharacter(slot, 1);
            else if (action === 'confirm') {
                AudioManager.getInstance().playSFX('ui_confirm_character', { volume: 0.5 });
                slot.ready = true;
                this.checkAllReady();
            }
        }
    }

    private isPlayerOneDevice(pad: number | null): boolean {
        const input = this.slots[0].input;
        return pad === null ? input.type === 'KEYBOARD' : input.type === 'GAMEPAD' && input.gamepadIndex === pad;
    }

    /** Training and campaign: player 1 picks their fighter, then the CPU's (training), then the stage. */
    private onTrainingPress(action: MenuAction): void {
        const p1 = this.slots[0];
        const cpu = this.slots[1];
        const targetSlot = this.selectionPhase === 'P1' ? p1 : cpu;

        // MAP phase must be checked FIRST (before character cycling)
        if (this.selectionPhase === 'MAP') {
            if (action === 'left') {
                this.changeMap(-1);
            } else if (action === 'right') {
                this.changeMap(1);
            } else if (action === 'confirm') {
                AudioManager.getInstance().playSFX('ui_confirm_character', { volume: 0.6 });
                this.startTrainingGame();
            }
        } else if (action === 'left') {
            this.changeCharacter(targetSlot, -1);
        } else if (action === 'right') {
            this.changeCharacter(targetSlot, 1);
        } else if (action === 'confirm') {
            if (this.selectionPhase === 'P1') {
                AudioManager.getInstance().playSFX('ui_confirm_character', { volume: 0.5 });
                p1.ready = true;

                if (this.mode === 'campaign') {
                    this.startCampaignGame();
                } else {
                    this.selectionPhase = 'CPU';
                }
            } else {
                AudioManager.getInstance().playSFX('ui_confirm_character', { volume: 0.5 });
                cpu.ready = true;
                // Move to map selection instead of starting immediately
                this.selectionPhase = 'MAP';
                this.showMapSelection();
            }
        }
    }

    private startTrainingGame(): void {
        this.hideMapSelection();
        AudioManager.getInstance().playSFX('ui_confirm_character', { volume: 0.6 });
        this.time.delayedCall(500, () => {
            this.scene.start('GameScene', {
                playerData: [this.slots[0], this.slots[1]],
                mode: 'training',
                selectedMap: STAGE_KEYS[this.selectedMapIndex]
            });
        });
    }

    private startCampaignGame(): void {
        AudioManager.getInstance().playSFX('ui_confirm_character', { volume: 0.6 });
        this.time.delayedCall(500, () => {
            this.scene.start('CampaignMapScene', {
                playerData: [this.slots[0]],
                mode: 'campaign',
                slotIndex: (this._initData as any)?.slotIndex ?? 0,
            });
        });
    }

    private changeCharacter(slot: PlayerSelection, dir: number): void {
        AudioManager.getInstance().playSFX('ui_change_character', { volume: 0.4 });
        const idx = this.characters.indexOf(slot.character);
        const newIdx = (idx + dir + this.characters.length) % this.characters.length;
        slot.character = this.characters[newIdx];
    }

    private checkAllReady(): void {
        const joinedSlots = this.slots.filter(s => s.joined);
        const minPlayers = this.mode === 'versus' ? 2 : 1;
        if (joinedSlots.length >= minPlayers && joinedSlots.every(s => s.ready)) {
            // Transition to MAP selection phase
            this.selectionPhase = 'MAP';
            this.showMapSelection();
        }
    }

    private showMapSelection(): void {
        // Hide player cards
        this.cards.forEach(c => c.setVisible(false));

        const { width, height } = this.scale;
        const centerY = height / 2;

        // Container for map selection UI
        this.mapUIContainer = this.add.container(width / 2, centerY);
        this.mapUIContainer.setDepth(100);

        // Solid background to cover character cards
        const bg = this.add.graphics();
        bg.fillStyle(0x000000, 1);
        bg.fillRect(-width / 2, -height / 2, width, height);
        this.mapUIContainer.add(bg);

        // Title
        const title = this.add.text(0, -160, 'SCEGLI LA MAPPA', {
            fontSize: '48px',
            fontFamily: '"Pixeloid Sans"',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);

        this.mapPreview = this.add.image(0, 0, previewKey(STAGE_KEYS[this.selectedMapIndex]));
        // Scale to fit a preview box (400x225 = 16:9)
        const previewW = 500;
        const previewH = 280;
        const imgScale = Math.max(previewW / this.mapPreview.width, previewH / this.mapPreview.height);
        this.mapPreview.setScale(imgScale);

        // Frame around preview
        const frame = this.add.graphics();
        frame.lineStyle(3, 0xffffff, 0.8);
        frame.strokeRoundedRect(-previewW / 2, -previewH / 2, previewW, previewH, 8);

        // Map name
        this.mapNameText = this.add.text(0, previewH / 2 + 30, STAGES[STAGE_KEYS[this.selectedMapIndex]].label, {
            fontSize: '36px',
            fontFamily: '"Pixeloid Sans"',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);

        // Arrows
        const leftArrow = this.add.text(-previewW / 2 - 40, 0, '◀', {
            fontSize: '48px',
            fontFamily: '"Pixeloid Sans"',
            color: '#8ab4f8'
        }).setOrigin(0.5);

        const rightArrow = this.add.text(previewW / 2 + 40, 0, '▶', {
            fontSize: '48px',
            fontFamily: '"Pixeloid Sans"',
            color: '#8ab4f8'
        }).setOrigin(0.5);

        // Instruction
        const instr = this.add.text(0, previewH / 2 + 80, 'P1: Conferma con [SPAZIO/INVIO] o [A]', {
            fontSize: '18px',
            fontFamily: '"Pixeloid Sans"',
            color: '#888888'
        }).setOrigin(0.5);

        this.mapUIContainer.add([title, this.mapPreview, frame, this.mapNameText, leftArrow, rightArrow, instr]);
    }

    private hideMapSelection(): void {
        if (this.mapUIContainer) {
            this.mapUIContainer.destroy(true);
            this.mapUIContainer = undefined;
        }
        // Restore player cards
        this.cards.forEach(c => c.setVisible(true));
    }

    private changeMap(dir: number): void {
        AudioManager.getInstance().playSFX('ui_change_character', { volume: 0.4 });
        this.selectedMapIndex = (this.selectedMapIndex + dir + STAGE_KEYS.length) % STAGE_KEYS.length;
        // Update preview
        if (this.mapPreview) {
            this.mapPreview.setTexture(previewKey(STAGE_KEYS[this.selectedMapIndex]));
            const previewW = 500;
            const previewH = 280;
            const imgScale = Math.max(previewW / this.mapPreview.width, previewH / this.mapPreview.height);
            this.mapPreview.setScale(imgScale);
        }
        if (this.mapNameText) {
            this.mapNameText.setText(STAGES[STAGE_KEYS[this.selectedMapIndex]].label);
        }
    }

    private updateUI(): void {
        this.slots.forEach((slot, i) => this.cards[i].show(this.cardState(slot, i)));
    }

    /** What slot `i`'s card shows: the empty prompt, or the fighter with where its player is in choosing. */
    private cardState(slot: PlayerSelection, i: number): CardState {
        if (!slot.joined) return { kind: 'empty', text: 'Premi\nper entrare' };
        const fighter = { kind: 'fighter' as const, character: slot.character, ready: slot.ready };
        if (slot.ready) return { ...fighter, choosing: false };
        const cpuSlot = this.mode === 'training' && i === 1;
        if (cpuSlot && this.selectionPhase === 'CPU') return { ...fighter, choosing: true, text: 'SCEGLI IL CPU' };
        if (cpuSlot && this.selectionPhase === 'P1') {
            return { ...fighter, choosing: false, text: slot.isTrainingDummy ? 'MANICHINO' : 'In attesa...', textColour: '#888888' };
        }
        return { ...fighter, choosing: true };
    }
}
