import Phaser from 'phaser';
import { Player, type PlayerConfig } from '../entities/Player';
import { MatchHUD, SMASH_COLORS } from '../ui/PlayerHUD';
import { GamepadPresses } from '../input/GamepadPresses';
import { MenuInput } from '../input/MenuInput';
import { DebugOverlay } from '../components/DebugOverlay';
import { InputDebugOverlay } from '../components/InputDebugOverlay';
import { TouchController } from '../components/TouchController';
import { PauseMenu, type LabMenu } from '../components/PauseMenu';
import { ControlsOverlay } from '../components/ControlsOverlay';
import { MapConfig, ZOOM_SETTINGS } from '../config/MapConfig';
import type { ZoomLevel } from '../config/MapConfig';
import { freeStageBackgrounds, isStageKey, loadStageBackground, type StageKey } from '../stages/StageBackgrounds';
import { freeLondraLayers, loadLondraLayers, LondraLayers } from '../stages/LondraLayers';
import { createStage as createSharedStage } from '../stages/StageFactory';
import { ContactShadows, DEFAULT_SHADOW_DARKNESS } from '../effects/ContactShadows';
import { EffectManager } from '../effects/EffectManager';
import { effects } from '../config/EffectConfig';
import type { Lighting } from '../lighting/Lighting';
import { labFighters, labSceneData, saveLabFighters, startStudioLab, type StudioLab } from '../lab/StudioLab';
import type { FeelLab } from '../lab/FeelLab';
import { resetTuning } from '../lab/Tuning';
import { AnimationHelpers } from '../managers/AnimationHelpers';
import { AudioManager } from '../managers/AudioManager';
import { MatchRecorder } from '../debug/MatchRecorder';
import type { NetClient } from '../network/NetClient';
import { OnlineMatch } from '../network/OnlineMatch';
import { ALL_CHARACTERS } from '../config/CharacterConfig';
import { AttackRegistry, AttackType } from '../../shared/AttackData';
import type { FighterInput } from '../../shared/FighterInput';
import { isInPlay, type FighterSetup } from '../../shared/FighterState';
import { FixedStepClock } from '../../shared/FixedStepClock';
import { addFighter, createMatch, stepMatch, type MatchState } from '../../shared/GameSim';
import type { MatchEvent } from '../../shared/MatchEvents';
import { NetEvent, type MatchStart, type PlayerLeft, type WatchInputs, type WatchStart } from '../../shared/NetProtocol';
import { SpectatorMatch } from '../network/SpectatorMatch';
import { STAGE_LAYOUT, type SimRect } from '../../shared/StageData';

import { CampaignFlow } from './CampaignFlow';
import type { GameSceneInterface } from './GameSceneInterface';

/** A player taking part in the match, as the lobby, the campaign or the online lobby set it up. */
export interface PlayerSlot {
    playerId: number;
    joined: boolean;
    ready: boolean;
    input: { type: 'KEYBOARD' | 'GAMEPAD'; gamepadIndex: number | null; keyboardMapping?: 'all'; mappingSlot?: number };
    character: string;
    isAI?: boolean;
    isTrainingDummy?: boolean;
    /** Online: another player's fighter, driven by their packets. */
    isRemote?: boolean;
}

/** What GameScene is started with. */
export interface GameSceneData {
    mode?: 'versus' | 'training' | 'campaign' | 'online' | 'spectate';
    playerData?: PlayerSlot[];
    selectedMap?: string;
    /** Campaign: a practice rematch against an island's opponent. */
    isTraining?: boolean;
    trainingOpponentIndex?: number;
    slotIndex?: number;
    /** The Studio Lab. */
    lab?: boolean;
    online?: { client: NetClient; start: MatchStart };
    /** Watching an online match. */
    watch?: { client: NetClient; watch: WatchStart; early?: WatchInputs['batches'] };
}

/** Standard gamepad button indices. */
const GAMEPAD_SELECT = 8;
const GAMEPAD_START = 9;

/** The Studio Lab's whole-stage view: centre and zoom showing every platform with room round them for lights. */
const STAGE_VIEW = { x: 900, y: 620, zoom: 0.62 };


export class GameScene extends Phaser.Scene implements GameSceneInterface {
    private debugOverlay!: DebugOverlay;
    private touchController!: TouchController;
    private backgroundImage: Phaser.GameObjects.Image | null = null;
    /** The Studio Lab draws Londra in layers instead of the painting. */
    private londraLayers: LondraLayers | null = null;
    private stageTextures: Phaser.GameObjects.Image[] = [];

    // Debug visibility
    public debugVisible: boolean = false;
    private debugGraphics!: Phaser.GameObjects.Graphics;
    private debugLabels: Phaser.GameObjects.Text[] = [];
    private debugToggleKey!: Phaser.Input.Keyboard.Key;
    private inputDebugKey!: Phaser.Input.Keyboard.Key;
    private inputDebugOverlay!: InputDebugOverlay;
    private trainingToggleKey!: Phaser.Input.Keyboard.Key;

    public uiCamera!: Phaser.Cameras.Scene2D.Camera;

    private readonly currentZoomLevel: ZoomLevel = 'CLOSE';

    // The match simulation advances in fixed 60 Hz steps, whatever the display refresh rate.
    // players[i] draws and drives match.fighters[i].
    private match!: MatchState;
    private fighterSetups: FighterSetup[] = [];
    private readonly simClock = new FixedStepClock();
    private readonly stepInputs: FighterInput[] = [];
    private readonly stepEvents: MatchEvent[] = [];
    /** Cutscenes hold the match still. */
    private isCutscene = false;
    /** Dev tool: `?record` in the URL records each match for the replay tests. */
    private isRecording = false;
    private recorder: MatchRecorder | null = null;
    /** Online matches: the opponent's inputs come from the network. */
    private online: OnlineMatch | null = null;
    /** Watching an online match instead of playing: the players' inputs come from the server. */
    private spectator: SpectatorMatch | null = null;
    /** Watching: the fighter picked for the next match, and whether a seat is booked. */
    private seat = { character: 0, booked: false };
    private liveBadge: Phaser.GameObjects.Text | null = null;
    private seatText: Phaser.GameObjects.Text | null = null;
    /** Playing online: how many are watching. */
    private watchersText: Phaser.GameObjects.Text | null = null;
    /** The Studio Lab lights the scene; drawing only, the match doesn't see it. */
    private isLab = false;
    private lighting: Lighting | null = null;
    /** The Studio Lab's FEEL mode, and its slow motion, freeze and frame step. */
    private feelLab: FeelLab | null = null;
    private studioLab: StudioLab | null = null;
    private readonly labTime = { scale: 1, frozen: false, steps: 0 };
    /** The lab can hold the camera on the whole stage instead of following the fighters. */
    private stageView = false;
    /** The camera's centre before any kick, eased towards the fighters; null until the first camera move. */
    private cameraCentre: { x: number; y: number } | null = null;
    private readonly cameraKick = { x: 0, y: 0 };
    private contactShadows: ContactShadows | null = null;

    // Pause menu
    private isPaused: boolean = false;
    private pauseMenu!: PauseMenu;
    private controlsOverlay!: ControlsOverlay;
    private pauseKey!: Phaser.Input.Keyboard.Key;

    // Game Over State
    private isGameOver: boolean = false;
    private isGameOverMenuReady: boolean = false;
    private gameOverSelectedIndex: number = 0;
    private gameOverMenuTexts: Phaser.GameObjects.Text[] = [];
    private gameOverMenuOptions: string[] = ['RIVINCITA', 'TORNA ALLA LOBBY'];
    private readonly padPresses = new GamepadPresses();
    private gameOverInput!: MenuInput;

    // Pre-allocated for update() — avoids per-frame GC
    private readonly hudPlayerMap: Map<number, Player> = new Map();

    constructor() {
        super({ key: 'GameScene' });
    }

    preload(): void {
        this.loadCharacterAssets();
        if (this.isLab) {
            freeStageBackgrounds(this);
            loadLondraLayers(this);
        } else {
            freeLondraLayers(this);
            loadStageBackground(this, this.currentStageBackground);
        }
    }

    /** Fighters, stage platforms and sounds; the music is global (PreloadScene). */
    private loadCharacterAssets(): void {
        AnimationHelpers.loadCharacterAssets(this);
        AnimationHelpers.loadCommonAssets(this);
        AnimationHelpers.loadUIAudio(this);
        this.load.on('loaderror', (file: { src: string }) => {
            console.error('Asset load failed:', file.src);
        });
    }

    private players: Player[] = [];
    private matchHUD!: MatchHUD;
    public spawnPoints: { x: number, y: number }[] = [];
    private playerData: PlayerSlot[] = [];

    private winnerTextVisual?: Phaser.GameObjects.Text;

    public effectManager!: EffectManager;

    private mode: 'versus' | 'training' | 'campaign' | 'online' | 'spectate' = 'versus';
    /** Campaign mode: the opponent, the cutscenes and where the fight leads. */
    private campaign: CampaignFlow | null = null;

    private currentStageBackground: StageKey = 'adria_bg';

    init(data: GameSceneData): void {
        this.mode = data.mode || 'versus';
        this.isLab = data.lab === true;
        // Only the Lab plays with tuned settings: every other match, online above all, uses the defaults
        if (!this.isLab) resetTuning();

        this.currentStageBackground = isStageKey(data.selectedMap) ? data.selectedMap : 'adria_bg';

        this.online = null;
        this.spectator = null;
        if (this.mode === 'spectate') {
            const { client, watch, early } = data.watch!;
            this.spectator = new SpectatorMatch(client, watch, early);
            // Every fighter is played by someone else
            this.playerData = watch.characters.map((character, playerId) => ({
                playerId, joined: true, ready: true, input: { type: 'KEYBOARD', gamepadIndex: null }, character, isRemote: true,
            }));
        } else if (this.mode === 'online') {
            const { client, start } = data.online!;
            this.online = new OnlineMatch(client, start);
            // Our slot plays with keyboard or the first gamepad; the others play remotely
            this.playerData = start.characters.map((character, playerId) => ({
                playerId,
                joined: true,
                ready: true,
                input: { type: 'KEYBOARD', gamepadIndex: 0, keyboardMapping: 'all' },
                character,
                isRemote: playerId !== start.slot,
            }));
        } else if (data.playerData) {
            this.playerData = data.playerData;
        } else {
            // Fallback defaults
            this.playerData = [
                { playerId: 0, joined: true, ready: true, input: { type: 'KEYBOARD', gamepadIndex: null, keyboardMapping: 'all' }, character: 'fok' },
                { playerId: 1, joined: true, ready: true, input: { type: 'KEYBOARD', gamepadIndex: null, keyboardMapping: 'all' }, character: 'fok', isAI: true, isTrainingDummy: true }
            ];
        }

        this.campaign = null;
        if (this.mode === 'campaign') {
            this.campaign = new CampaignFlow(this, data, this.playerData[0]);
            this.playerData = this.campaign.fighters(this.playerData[0]) ?? this.playerData;
            this.currentStageBackground = this.campaign.stage ?? this.currentStageBackground;
        }

        // Register shutdown handler
        this.events.once('shutdown', this.shutdown, this);
    }


    create(): void {
        try {
            // Initialize Effect Manager
            this.effectManager = new EffectManager(this);

            // The scene object survives restarts: clear the previous match
            this.players.forEach(p => p.destroy());
            this.players = [];
            if (this.matchHUD) {
                this.matchHUD.destroy();
            }
            this.stageTextures = [];
            this.isCutscene = false;
            this.isGameOver = false;
            this.isGameOverMenuReady = false;
            this.gameOverSelectedIndex = 0;
            if (this.gameOverMenuTexts) {
                this.gameOverMenuTexts.forEach(t => t.destroy());
                this.gameOverMenuTexts = [];
            }
            this.isPaused = false;

            AnimationHelpers.createAnimations(this);

            // Cameras first, so the UI camera exists when the stage and fighters are told to skip it
            this.setupCameras();

            // Touch Controller Overlay
            this.touchController = new TouchController(this);
            if (this.uiCamera) {
                this.touchController.setCameraIgnore(this.cameras.main, this.uiCamera);
            }

            // Create stage platforms
            this.createStage();

            // A black loading screen hides the first frames while the stage settles
            const loadingOverlay = this.add.rectangle(
                this.scale.width / 2, this.scale.height / 2,
                this.scale.width, this.scale.height, 0x000000
            ).setDepth(10000); // Top level

            const loadingText = this.add.text(
                this.scale.width / 2, this.scale.height / 2,
                "LOADING...",
                { fontSize: '32px', color: '#ffffff', fontFamily: '"Pixeloid Sans"' }
            ).setOrigin(0.5).setDepth(10001);

            this.uiCamera.ignore([loadingOverlay, loadingText]);

            // Ensure Global Music loops at lower volume
            const globalMusic = this.sound.get('global_music_loop');
            const audioManager = AudioManager.getInstance();
            const targetVolume = 0.5 * audioManager.getMusicVolume();

            if (globalMusic) {
                if (!globalMusic.isPlaying) {
                    globalMusic.play({ loop: true, volume: targetVolume });
                } else {
                    this.tweens.add({
                        targets: globalMusic,
                        volume: targetVolume,
                        duration: 1000
                    });
                }
            } else {
                // Fallback if not started yet (e.g. dev reload on GameScene)
                this.sound.play('global_music_loop', { loop: true, volume: targetVolume });
            }

            // Fade out after a short delay to ensure assets/rendering is ready
            this.time.delayedCall(100, () => {
                AudioManager.getInstance().playSFX('ui_match_begin', { volume: 0.6 });
                this.tweens.add({
                    targets: [loadingOverlay, loadingText],
                    alpha: 0,
                    duration: 500,
                    onComplete: () => {
                        loadingOverlay.destroy();
                        loadingText.destroy();
                    }
                });
            });

            // BACKGROUND LOGIC
            this.cameras.main.setBackgroundColor('#99d7f0'); // Blue sky behind stage

            // Create Players
            this.players = [];

            // Default Spawn Points (Supported up to 6)
            let spawnPoints = [
                { x: 520, y: 300 },   // P1 (Left Soft)
                { x: 1400, y: 300 },  // P2 (Right Soft)
                { x: 800, y: 200 },   // P3 (Main Center-Left)
                { x: 1120, y: 200 },  // P4 (Main Center-Right)
                { x: 600, y: 400 },   // P5 (Low Left)
                { x: 1320, y: 400 }   // P6 (Low Right)
            ];

            // DUMMY MODE OVERRIDE: Spawn closer together at center
            const hasDummy = this.playerData.some(p => p.isTrainingDummy);
            if (hasDummy) {
                this.spawnPoints = [
                    { x: 880, y: 300 },  // P1: Left of center
                    { x: 1040, y: 300 }, // P2 (Dummy): Right of center
                    { x: 960, y: 200 },
                    { x: 960, y: 400 }
                ];
            } else {
                this.spawnPoints = spawnPoints;
            }

            const joined = this.playerData.filter(pData => pData.joined);
            this.fighterSetups = joined.map(pData => {
                const spawn = this.spawnPoints[pData.playerId] || { x: 960, y: 300 };
                return { character: pData.character || 'fok', x: spawn.x, y: spawn.y };
            });
            this.isRecording = import.meta.env.DEV && new URLSearchParams(window.location.search).has('record');
            if (this.isRecording) {
                this.input.keyboard?.on('keydown-F9', () => this.recorder?.save());
            }
            this.startMatch();

            joined.forEach((pData, i) => {
                const config: PlayerConfig = {
                    playerId: pData.playerId,
                    character: this.fighterSetups[i].character,
                    isAI: pData.isAI,
                    isTrainingDummy: pData.isTrainingDummy,
                    gamepadIndex: pData.input.gamepadIndex,
                    useKeyboard: pData.input.type === 'KEYBOARD',
                    keyboardMapping: pData.input.keyboardMapping,
                    mappingSlot: pData.input.mappingSlot ?? 0,
                    isRemote: pData.isRemote,
                };
                // The first local player gets touch controls if active
                const touch = pData.playerId === this.localPlayerId() ? this.touchController : undefined;
                const player = new Player(this, this.match.fighters[i], config, touch);

                const color = this.campaign?.indicatorColor(pData.playerId) ?? this.PLAYER_COLORS[pData.playerId] ?? 0xffffff;
                player.setColor(color);

                this.players.push(player);

                // Add small triangle indicator above human players (colored, centered on hitbox)
                if (!pData.isAI) {
                    const tri = this.add.graphics();
                    tri.fillStyle(color, 0.5);
                    tri.fillTriangle(-6, -6, 6, -6, 0, 6); // Downward-pointing
                    tri.setPosition(0, -120); // Above nameTag (y=-100)
                    player.add(tri);
                    this.tweens.add({
                        targets: tri,
                        y: tri.y - 5,
                        duration: 600,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                }

                if (pData.playerId === 1) this.campaign?.drain([player.spriteObject]);
            });

            // Re-run camera exclusions now that players exist
            // (setupCameras was moved up before createStage, but players are created after)
            this.configureCameraExclusions();

            this.contactShadows = new ContactShadows(this, [this.uiCamera]);
            this.stageView = false;
            this.cameraCentre = null;
            this.cameraKick.x = this.cameraKick.y = 0;
            if (this.isLab) {
                const scene = this;
                const lab = startStudioLab(this, {
                    uiCamera: this.uiCamera,
                    sky: this.backgroundImage ? [this.backgroundImage] : [],
                    layers: this.londraLayers,
                    stage: this.stageTextures,
                    fighters: this.players.map(p => p.spriteObject),
                    setStageView: on => this.stageView = on,
                    statsLeftOf: () => this.debugOverlay?.panelRight ?? 0,
                }, {
                    get match() { return scene.match; },
                    get players() { return scene.players; },
                    uiCamera: this.uiCamera,
                    restartMatch: () => this.restartMatch(),
                    setTime: (scale, frozen) => this.setLabTime(scale, frozen),
                    stepFrame: () => { this.labTime.steps++; },
                    setHitboxes: on => this.players.forEach(p => p.setDebug(on)),
                    isPaused: () => this.isPaused,
                });
                this.lighting = lab.lighting;
                this.feelLab = lab.feel;
                this.studioLab = lab;
            }

            // Create debug overlay
            this.debugOverlay = new DebugOverlay(this);
            this.debugOverlay.setCameraIgnore(this.cameras.main);

            // Versus mode: only show FPS/Ping. Full debug is training-only.
            const isTrainingMode = this.playerData.some(p => p.isTrainingDummy);
            if (!isTrainingMode) {
                this.debugOverlay.setMinimalMode(true);
            }

            // Debug Graphics for Platform Visualization
            this.debugGraphics = this.add.graphics();
            this.debugGraphics.setDepth(9999);
            this.uiCamera.ignore(this.debugGraphics); // Only visible in main camera (world space)

            // Create HUDs
            this.createHUDs();

            // Getters: the match is replaced on a restart
            const scene = this;
            this.campaign?.start({
                get match() { return scene.match; },
                get players() { return scene.players; },
                get hud() { return scene.matchHUD; },
                setCutscene: on => { this.isCutscene = on; },
            });

            // Toggle key
            this.debugToggleKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
            this.inputDebugKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F2);
            this.trainingToggleKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.T);
            this.pauseKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
            this.gameOverInput = new MenuInput(this);

            // Input Debug Overlay (F2)
            this.inputDebugOverlay = new InputDebugOverlay(this);
            this.inputDebugOverlay.setCameraIgnore(this.cameras.main);

            // Create pause menu
            this.pauseMenu = new PauseMenu(this, this.studioLab ? this.labMenu(this.studioLab) : undefined);
            this.cameras.main.ignore(this.pauseMenu.getElements());

            // Create F1 controls overlay
            this.controlsOverlay = new ControlsOverlay(this);
            this.cameras.main.ignore(this.controlsOverlay.getElements());

            // Pause menu event listeners
            this.events.on('pauseMenuResume', () => this.togglePause());
            this.events.on('pauseMenuRestart', () => this.restartMatch());
            this.events.on('pauseMenuSettings', () => {
                this.pauseMenu.hide();
                this.scene.launch('SettingsScene', { returnScene: 'GameScene' });
                this.scene.bringToTop('SettingsScene'); // Guarantee overlay visibility

                const settingsScene = this.scene.get('SettingsScene');
                settingsScene.events.off('shutdown');
                settingsScene.events.once('shutdown', () => {
                    this.pauseMenu.show();
                });
            });
            this.events.on('pauseMenuLobby', () => {
                this.time.delayedCall(10, () => {
                    try {
                        // Infer mode from playerData (if dummy exists, it's training)
                        const isTraining = this.playerData.some(p => p.isTrainingDummy);
                        const p1Data = this.playerData.find(p => p.playerId === 0);
                        this.scene.start('LobbyScene', {
                            mode: isTraining ? 'training' : 'versus',
                            inputType: p1Data?.input?.type || 'KEYBOARD',
                            gamepadIndex: p1Data?.input?.gamepadIndex ?? null,
                        });
                    } catch (e) {
                        console.error("Failed to start LobbyScene:", e);
                    }
                });
            });
            this.events.on('pauseMenuExit', () => {
                this.scene.start('MainMenuScene');
            });
            this.events.on('pauseMenuMap', () => this.campaign?.backToMap());
            this.events.on('spawnDummy', () => {
                this.togglePause(); // Unpause
                if (this.players.length < 4) {
                    this.spawnTrainingDummy();
                }
            });

            if (this.online) {
                const client = this.online.client;
                client.on(NetEvent.START, (start: MatchStart) => {
                    if (!this.online) return;
                    // A rematch with fewer players (someone left): the scene starts over with the new line-up
                    if (start.characters.join() !== this.online.start.characters.join()) {
                        this.online = null;
                        this.scene.restart({ mode: 'online', online: { client, start } });
                        return;
                    }
                    this.online.start = start;
                    this.restartMatch();
                });
                client.on(NetEvent.PLAYER_LEFT, (left: PlayerLeft) => this.onPlayerLeft(left));
                client.on(NetEvent.SPECTATORS, (data: { count: number }) => this.showWatchers(data.count));
                client.onDisconnect(() => this.endOnline('CONNESSIONE PERSA'));
                // Network stats on screen by default (Q toggles)
                this.debugVisible = true;
            }

            if (this.spectator) this.setUpWatching(this.spectator);

            this.events.on('resume', this.onResume, this);
        } catch (e) {
            console.error("CRITICAL ERROR in GameScene.create:", e);
        }
    }

    private setupCameras(): void {
        // Main camera is manually controlled via updateCamera() using centerOn()

        // Create a separate UI camera that ignores zoom
        this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height);
        this.uiCamera.setScroll(0, 0);
        // UI camera ignores main camera zoom
        this.uiCamera.setZoom(1);

        // PREVENT GHOSTING: UI Camera should ignore game world objects
        this.configureCameraExclusions();
    }

    private configureCameraExclusions(): void {
        if (!this.uiCamera) return;

        // Ignore static world elements
        if (this.backgroundImage) this.uiCamera.ignore(this.backgroundImage);
        if (this.londraLayers) this.uiCamera.ignore(this.londraLayers.objects);
        if (this.stageTextures.length > 0) this.uiCamera.ignore(this.stageTextures);

        // Ignore entities
        this.uiCamera.ignore(this.players);
    }

    private createStage(): void {
        const stage = createSharedStage(this, this.currentStageBackground, !this.isLab);
        this.backgroundImage = stage.background;
        this.londraLayers = this.isLab ? new LondraLayers(this) : null;
        this.stageTextures = [...stage.platformTextures];

        this.campaign?.drain([stage.background, ...stage.platformTextures]);

        // Re-run full exclusion pass (catches anything missed above)
        this.configureCameraExclusions();
    }

    // Player Config
    // Player colors - using SMASH_COLORS from PlayerHUD for consistency
    private readonly PLAYER_COLORS = SMASH_COLORS;

    private createHUDs(): void {
        // Initialize HUD
        this.matchHUD = new MatchHUD(this);
        this.matchHUD.addToCameraIgnore(this.cameras.main);

        // Add existing players if any
        this.players.forEach(p => this.addPlayerToHUD(p));
    }

    /** HUD name: CPU for computer fighters, P1-P4 otherwise; the local player's is marked as theirs. */
    private addPlayerToHUD(player: Player): void {
        if (this.matchHUD) {
            const isYOU = player.playerId === this.localPlayerId();

            let name = `P${player.playerId + 1} `;
            if (player.isAI) {
                name = "CPU";
            }

            this.matchHUD.addPlayer(player.playerId, name, isYOU, player.character || 'fok');
        }
    }

    update(_time: number, delta: number): void {
        this.padPresses.poll();
        // LB held shows the controls
        this.controlsOverlay.update();

        if (this.isGameOver) {
            this.players.forEach(p => p.render(this.match, delta));
            // The opponent may still be simulating the last frames with our inputs
            this.online?.flush();
            // Online, ESC leaves at any point after the end; watching, the next match starts on its own
            if ((this.online || this.spectator) && Phaser.Input.Keyboard.JustDown(this.pauseKey)) {
                this.returnToLobby();
                return;
            }
            if (this.spectator) {
                this.updateSeat();
                return;
            }

            // The menu appears 2 s after the end
            if (!this.isGameOverMenuReady) return;

            for (const { action } of this.gameOverInput.poll()) {
                if (action === 'up' || action === 'down') {
                    const count = this.gameOverMenuOptions.length;
                    this.gameOverSelectedIndex = (this.gameOverSelectedIndex + (action === 'up' ? count - 1 : 1)) % count;
                    this.updateGameOverMenuHighlight();
                    AudioManager.getInstance().playSFX('ui_menu_hover', { volume: 0.5 });
                } else if (action === 'confirm') {
                    AudioManager.getInstance().playSFX('ui_confirm', { volume: 0.5 });
                    if (this.gameOverSelectedIndex === 0) {
                        if (this.online) this.voteRematch();
                        else this.restartMatch();
                    } else if (this.gameOverSelectedIndex === 1) {
                        this.returnToLobby();
                    }
                    return;
                }
            }
            return;
        }

        // ESC or Start pauses
        const pauseKeyPressed = Phaser.Input.Keyboard.JustDown(this.pauseKey);
        const gamepadPausePressed = this.padPresses.justPressed(GAMEPAD_START);

        if ((pauseKeyPressed || gamepadPausePressed) && (this.online || this.spectator)) {
            // An online match can't pause for everyone: ESC leaves it
            this.returnToLobby();
            return;
        }
        if (pauseKeyPressed || gamepadPausePressed) {
            if (!this.scene.isActive('DialogueScene')) {
                this.togglePause();
            }
        }

        // If paused, only update pause menu
        if (this.isPaused) {
            this.pauseMenu.update(delta);
            return;
        }

        // Check for Debug Toggle (Q key or SELECT button on gamepad)
        const qKeyPressed = Phaser.Input.Keyboard.JustDown(this.debugToggleKey);
        const gamepadSelectPressed = this.padPresses.justPressed(GAMEPAD_SELECT);

        if (qKeyPressed || gamepadSelectPressed) {
            this.debugVisible = !this.debugVisible;
            this.debugOverlay.setVisible(this.debugVisible);

            // Full debug visuals (hitboxes, collision rects) only in training
            if (!this.debugOverlay.isMinimalMode()) {
                this.toggleDebugVisuals(this.debugVisible);
                this.players.forEach(p => p.setDebug(this.debugVisible));
            }
        }

        // Handle Training Toggle (T)
        if (Phaser.Input.Keyboard.JustDown(this.trainingToggleKey) && !this.online) {
            // Find all AI players
            const aiPlayers = this.players.filter(p => p.isAI);

            if (aiPlayers.length > 0) {
                // Determine target state based on the first AI (sync them all)
                // If first one is dummy, ALL become active. If first is active, ALL become dummy.
                const targetIsDummy = !aiPlayers[0].isTrainingDummy;

                aiPlayers.forEach(p => {
                    p.isTrainingDummy = targetIsDummy;

                    // Show floating text feedback for each
                    p.isTrainingDummy = targetIsDummy;
                    // No floaty text needed, debug overlay shows state
                });
            } else {
                // If no AI exists (e.g. 1v1 human match, or just P1), spawn a dummy
                this.spawnTrainingDummy();
            }
        }

        let steps = 0;
        if (this.spectator) {
            this.updateSeat();
            steps = this.watchSteps(delta);
        } else if (!this.isCutscene) {
            // Online: raw frame time, since Phaser clamps its smoothed delta while the window is unfocused
            const due = this.labTime.frozen ? this.takeLabSteps()
                : this.simClock.advance((this.online ? this.game.loop.rawDelta : delta) * this.labTime.scale);
            // A step spent waiting for the opponent is dropped, not caught up later
            while (steps < due && !this.isGameOver && this.stepSimulation()) steps++;
        }
        this.online?.flush();
        this.players.forEach(p => p.render(this.match, delta));
        this.contactShadows?.update(this.match, this.lighting?.look.shadow ?? DEFAULT_SHADOW_DARKNESS);
        if (this.lighting) {
            for (const p of this.players) this.lighting.setGrounded(p.spriteObject, this.match.fighters[p.fighterIndex].body.isGrounded);
            this.lighting.update(delta);
        }

        // The camera moves once per step, like the fighters: on screens faster than
        // 60 Hz, moving it on the frames in between makes fighters judder against it
        const cameraMoves = this.isCutscene ? 1 : steps;
        for (let i = 0; i < cameraMoves; i++) this.updateCamera();

        // Debug overlay: P1's movement and attack state, and the network stats online
        if (this.players.length > 0) {
            // Always show the first player
            const fighter = this.match.fighters[0];
            const attack = fighter.combat.attack;
            const attackData = attack ? AttackRegistry[attack.key] : null;
            const attackInfo = attack && attackData
                ? `${attackData.type} ${attackData.direction} (${attack.phase})`
                : 'None';

            if (this.debugVisible) {
                this.debugOverlay.update(
                    fighter.body.vx,
                    fighter.body.vy,
                    fighter.state,
                    fighter.body.recoveryAvailable,
                    attackInfo,
                    this.players[0].isGamepadConnected(),
                    this.online ? Math.round(this.online.client.rtt) : this.spectator ? Math.round(this.spectator.client.rtt) : 0
                );
                this.debugOverlay.setNetworkStats(this.online?.stats() ?? this.spectator?.stats() ?? null);
                this.debugOverlay.setVisible(true);
            } else {
                this.debugOverlay.setVisible(false);
            }
        }

        // Input Debug Overlay (F2 toggle)
        if (Phaser.Input.Keyboard.JustDown(this.inputDebugKey)) {
            this.inputDebugOverlay.toggle();
        }
        if (this.inputDebugOverlay.isVisible()) {
            this.inputDebugOverlay.update(this.players);
        }


        // Update HUDs
        if (this.matchHUD) {
            // Create a map for MatchHUD
            this.hudPlayerMap.clear();
            this.players.forEach(p => this.hudPlayerMap.set(p.playerId, p));
            this.matchHUD.updatePlayers(this.hudPlayerMap);
        }

    }

    /**
     * Advances the match by one fixed step, then plays what happened in it.
     * Online, returns false while waiting for the opponent or letting them catch up.
     */
    private stepSimulation(): boolean {
        const online = this.online;
        this.stepEvents.length = 0;

        let simulated = true;
        if (online) {
            simulated = online.step(() => this.players[online.slot].readInput(this.match), this.stepEvents);
            // A rollback may have gone back to an earlier copy of the match
            this.match = online.match;
        } else {
            for (const p of this.players) this.stepInputs[p.fighterIndex] = p.readInput(this.match);
            stepMatch(this.match, this.stepInputs, this.stepEvents);
            this.recorder?.captureStep(this.match, this.stepInputs);
        }

        for (const event of this.stepEvents) this.playEvent(event);
        // Online, an ending seen in a guessed frame could still be rolled back
        if (online ? online.isOverConfirmed : this.match.isOver) this.onMatchOver();
        return simulated;
    }

    /** The lobby slot this machine's player uses: P1 locally, our slot online. */
    private localPlayerId(): number {
        return this.spectator ? -1 : this.online?.slot ?? 0;
    }

    /** Starts a fresh match with the current fighters. */
    private startMatch(): void {
        const seed = this.online?.start.seed ?? this.spectator?.watch.seed ?? Math.floor(Math.random() * 0x100000000);
        this.match = createMatch(this.fighterSetups, seed);
        this.online?.begin(this.match);
        this.spectator?.begin(this.match);
        // Online frames can be simulated more than once, so only local matches are recorded
        this.recorder = this.isRecording && !this.online ? new MatchRecorder(this.fighterSetups, seed) : null;
    }

    private playEvent(event: MatchEvent): void {
        this.feelLab?.onEvent(event);
        const audio = AudioManager.getInstance();
        switch (event.type) {
            case 'sound':
                audio.playSFX(event.key, { volume: event.volume });
                break;
            case 'attack':
                this.players[event.fighter].playAttackSound(event.key, event.charged);
                break;
            case 'ghost':
                this.players[event.fighter].spawnSignatureGhost(event.ghost);
                break;
            case 'hit':
                this.onHit(event);
                break;
            case 'groundPoundMiss':
                audio.playSFX('sfx_landing', { volume: 1.0 });
                audio.playSFX('sfx_chest_drop', { volume: 0.6 });
                break;
            case 'ko':
                this.onKnockOut(event.fighter, event.x, event.y);
                break;
            case 'respawn':
                this.showRespawnFlash(event.x, event.y);
                break;
        }
    }

    private onHit(hit: Extract<MatchEvent, { type: 'hit' }>): void {
        const { attacker, target, attackKey } = hit;
        this.players[attacker].playHitSound(attackKey);
        if (attackKey && AttackRegistry[attackKey].type === AttackType.HEAVY) {
            this.cameras.main.shake(effects.HEAVY_SHAKE_MS, effects.HEAVY_SHAKE);
        }
        this.effectManager.spawnHitSpark(hit.x, hit.y, hit.damage);

        // Hard hits nudge the camera the way the target flies
        const knockback = Math.hypot(hit.knockbackX, hit.knockbackY);
        const kick = Phaser.Math.Clamp((knockback - effects.CAMERA_KICK_FROM) / effects.CAMERA_KICK_PER_PIXEL, 0, effects.CAMERA_KICK_MAX);
        if (kick > 0) {
            this.cameraKick.x += (hit.knockbackX / knockback) * kick;
            this.cameraKick.y += (hit.knockbackY / knockback) * kick;
        }

        const body = this.match.fighters[target].body;
        this.lighting?.flash('hit', body.x, body.y);

        const victim = this.players[target];
        if (this.campaign?.flashesOnHit(victim.playerId) ?? true) {
            victim.flashDamage(this.match.fighters[target].damagePercent);
        }
    }

    /** A fighter left the stage: impact, crowd, and the campaign's reactions. */
    private onKnockOut(index: number, x: number, y: number): void {
        // A short, punchy shake and a slight zoom in, which the camera eases back out of
        this.cameras.main.shake(effects.KO_SHAKE_MS, effects.KO_SHAKE);
        this.cameras.main.zoom *= effects.KO_ZOOM_PUNCH;
        const impactX = Phaser.Math.Clamp(x, MapConfig.BLAST_ZONE_LEFT + 100, MapConfig.BLAST_ZONE_RIGHT - 100);
        const impactY = Phaser.Math.Clamp(y, MapConfig.BLAST_ZONE_TOP + 100, MapConfig.BLAST_ZONE_BOTTOM - 100);
        this.lighting?.flash('ko', impactX, impactY);

        const audio = AudioManager.getInstance();
        audio.playSFX('sfx_death', { volume: 0.8 });
        audio.playSFX(Math.random() > 0.5 ? 'sfx_death_crowd_1' : 'sfx_death_crowd_2', { volume: 0.5 });

        this.campaign?.onKnockOut(index);
    }

    private showRespawnFlash(x: number, y: number): void {
        const flash = this.add.graphics();
        flash.fillStyle(0xffffff, 0.8);
        flash.fillCircle(x, y, 75);
        this.uiCamera?.ignore(flash);
        this.lighting?.flash('respawn', x, y);
        this.tweens.add({
            targets: flash,
            alpha: 0,
            scale: 2,
            duration: 300,
            onComplete: () => flash.destroy()
        });
    }

    private updateCamera(): void {
        const cam = this.cameras.main;
        this.cameraCentre ??= { x: cam.midPoint.x, y: cam.midPoint.y };
        if (this.stageView) {
            cam.zoom = Phaser.Math.Linear(cam.zoom, STAGE_VIEW.zoom, 0.1);
            this.moveCameraTowards(STAGE_VIEW.x, STAGE_VIEW.y);
            return;
        }

        // Filter out players who are effectively dead or inactive
        const targets = this.players.filter(p => {
            if (!isInPlay(this.match.fighters[p.fighterIndex])) return false;

            // Check bounds (using slightly tighter bounds than actual kill box)
            return p.x > MapConfig.BLAST_ZONE_LEFT + 50 &&
                p.x < MapConfig.BLAST_ZONE_RIGHT - 50 &&
                p.y < MapConfig.BLAST_ZONE_BOTTOM - 50 &&
                p.y > MapConfig.BLAST_ZONE_TOP + 50;
        });

        if (targets.length === 0) return;

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        targets.forEach(t => {
            minX = Math.min(minX, t.x);
            maxX = Math.max(maxX, t.x);
            minY = Math.min(minY, t.y);
            maxY = Math.max(maxY, t.y);
        });

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        // Viewport padding based on zoom level
        const settings = ZOOM_SETTINGS[this.currentZoomLevel];
        const padX = settings.padX;
        const padY = settings.padY;

        const width = (maxX - minX) + padX * 2;
        const height = (maxY - minY) + padY * 2;

        const zoomX = this.scale.width / width;
        const zoomY = this.scale.height / height;

        // Clamp zoom
        const targetZoom = Phaser.Math.Clamp(Math.min(zoomX, zoomY), settings.minZoom, settings.maxZoom);

        cam.zoom = Phaser.Math.Linear(cam.zoom, targetZoom, 0.1);
        this.moveCameraTowards(centerX, centerY);
    }

    /** Eases the camera's centre towards (x, y), plus what's left of the last hit's kick. Once per step. */
    private moveCameraTowards(x: number, y: number): void {
        const centre = this.cameraCentre!;
        centre.x = Phaser.Math.Linear(centre.x, x, 0.2);
        centre.y = Phaser.Math.Linear(centre.y, y, 0.2);
        this.cameras.main.centerOn(centre.x + this.cameraKick.x, centre.y + this.cameraKick.y);
        this.cameraKick.x *= effects.CAMERA_KICK_DECAY;
        this.cameraKick.y *= effects.CAMERA_KICK_DECAY;
    }



    private togglePause(): void {
        this.isPaused = !this.isPaused;
        this.studioLab?.setSuspended(this.isPaused);
        if (this.isPaused) {
            AudioManager.getInstance().playSFX('ui_player_found', { volume: 0.6 });
            this.pauseMenu.show();
        } else {
            this.pauseMenu.hide();
            // Characters picked in the Lab's menu: a new match with them
            if (this.isLab && this.labFightersChanged()) this.time.delayedCall(10, () => this.scene.restart(labSceneData()));
        }
    }

    /** The Lab's pause menu: mode, view, and the player's and dummy's characters. */
    private labMenu(lab: StudioLab): LabMenu {
        return {
            mode: () => lab.mode,
            toggleMode: () => lab.setMode(lab.mode === 'look' ? 'feel' : 'look'),
            windowed: () => lab.windowed,
            toggleWindowed: () => lab.setWindowed(!lab.windowed),
            character: who => labFighters()[who],
            cycleCharacter: (who, step) => {
                const fighters = labFighters();
                const i = ALL_CHARACTERS.indexOf(fighters[who]);
                fighters[who] = ALL_CHARACTERS[(i + step + ALL_CHARACTERS.length) % ALL_CHARACTERS.length];
                saveLabFighters(fighters);
            },
        };
    }

    private labFightersChanged(): boolean {
        const picked = labFighters();
        return this.playerData[0]?.character !== picked.player || this.playerData[1]?.character !== picked.dummy;
    }

    private restartMatch(): void {
        this.startMatch();
        this.players.forEach(p => p.setPose(null));

        // Clear game over state
        this.isGameOver = false;
        this.isGameOverMenuReady = false;
        if (this.winnerTextVisual) {
            this.winnerTextVisual.destroy();
            this.winnerTextVisual = undefined;
        }
        this.gameOverSelectedIndex = 0;
        if (this.gameOverMenuTexts) {
            this.gameOverMenuTexts.forEach(t => t.destroy());
            this.gameOverMenuTexts = [];
        }

        // Close pause menu
        this.isPaused = false;
        this.pauseMenu.hide();
    }

    /** Training: adds a CPU dummy, a character not yet on stage, in the first free player slot (up to 6). */
    private spawnTrainingDummy(): void {
        const playerId = [0, 1, 2, 3, 4, 5].find(id => !this.players.some(p => p.playerId === id));
        const usedCharacters = this.players.map(p => p.character);
        const characters = ALL_CHARACTERS.filter(c => !usedCharacters.includes(c));
        if (playerId === undefined || characters.length === 0) return;

        const character = characters[Phaser.Math.Between(0, characters.length - 1)];
        if (!this.playerData.some(pd => pd.playerId === playerId)) {
            this.playerData.push({
                playerId, joined: true, ready: true, input: { type: 'KEYBOARD', gamepadIndex: null },
                character, isAI: true, isTrainingDummy: true,
            });
        }

        // Spread along the top of the stage so dummies don't stack
        const setup = { character, x: 860 + playerId * 60, y: 300 };
        this.fighterSetups.push(setup);
        const fighter = addFighter(this.match, setup);
        const player = new Player(this, fighter, { playerId, character, isAI: true, isTrainingDummy: true });
        player.setColor(this.PLAYER_COLORS[playerId] || 0xffffff);

        this.players.push(player);
        this.uiCamera.ignore(player);
        this.lighting?.add(player.spriteObject, 'fighter');
        this.addPlayerToHUD(player);
    }

    /** Back from a scene launched over this one (settings, dialogue): the pause menu comes back if it was up. */
    private onResume(): void {
        if (!this.isPaused) return;
        this.pauseMenu.show();
        this.input.keyboard?.resetKeys();
    }

    /** The Lab's game speed and freeze: the simulation, animations, tweens and timers all follow. */
    private setLabTime(scale: number, frozen: boolean): void {
        this.labTime.scale = scale;
        this.labTime.frozen = frozen;
        this.labTime.steps = 0;
        const rate = frozen ? 0 : scale;
        this.anims.globalTimeScale = rate;
        this.tweens.timeScale = rate;
        this.time.timeScale = rate;
    }

    /** Frozen in the Lab: the steps asked for with "next step". */
    private takeLabSteps(): number {
        const steps = this.labTime.steps;
        this.labTime.steps = 0;
        return steps;
    }

    /** Scene shutdown (leaving the match): everything create() set up. */
    shutdown(): void {
        this.online?.client.close();
        this.online = null;
        this.spectator?.client.close();
        this.spectator = null;
        this.liveBadge = this.seatText = this.watchersText = null;
        this.lighting?.destroy();
        this.lighting = null;
        this.feelLab = null;
        this.studioLab = null;
        this.setLabTime(1, false);
        this.contactShadows?.destroy();
        this.contactShadows = null;

        this.input.keyboard?.removeAllKeys();
        this.input.keyboard?.resetKeys();
        this.input.keyboard?.off('keydown-F9');

        for (const event of ['pauseMenuResume', 'pauseMenuRestart', 'pauseMenuSettings', 'pauseMenuLobby', 'pauseMenuExit', 'pauseMenuMap', 'spawnDummy']) {
            this.events.off(event);
        }
        this.events.off('resume', this.onResume, this);

        this.players.forEach(p => p.destroy());
        this.players = [];
        this.matchHUD?.destroy();
        this.pauseMenu?.destroy();
        this.controlsOverlay?.destroy();
        this.inputDebugOverlay?.destroy();
        this.debugOverlay?.destroy();
        this.tweens.killAll();
    }

    /** The simulation ended the match: at most one fighter has lives left. */
    private onMatchOver(): void {
        const winnerId = this.match.winnerId >= 0 ? this.players[this.match.winnerId].playerId : -1;
        if (this.campaign) {
            // No victory screen or rematch menu: the campaign says what comes next
            this.isGameOver = true;
            this.campaign.onMatchOver(winnerId);
            return;
        }
        this.handleGameOver(winnerId);
    }

    private handleGameOver(winnerId: number): void {
        if (this.isGameOver) return;
        this.isGameOver = true;

        let winnerText = 'GAME!';
        const winner = this.players.find(p => p.playerId === winnerId);
        if (winner) {
            AudioManager.getInstance().playSFX('sfx_knockout', { volume: 0.8 });
            winnerText += `\nPLAYER ${winnerId + 1} HA ARATO!`;
            // Dramatic zoom on the winner's victory pose
            winner.setPose('win');
            this.cameras.main.pan(winner.x, winner.y, 1500, 'Power2');
            this.cameras.main.zoomTo(3.5, 1500, 'Power2');
        } else {
            winnerText += '\nDRAW GAME!';
        }

        const { width, height } = this.scale;
        this.winnerTextVisual = this.add.text(width / 2, height / 2 - 50, winnerText, {
            fontSize: '64px',
            fontFamily: '"Pixeloid Sans"',
            fontStyle: 'bold',
            color: '#ffffff',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 8
        });
        this.winnerTextVisual.setOrigin(0.5);
        this.winnerTextVisual.setDepth(1001);
        this.cameras.main.ignore(this.winnerTextVisual); // Only UI camera sees it

        // Watching: no rematch menu, the next match comes by itself
        if (this.spectator) {
            this.time.delayedCall(2500, () => this.showCenterText('IN ATTESA DELLA PROSSIMA PARTITA...'));
            return;
        }
        this.time.delayedCall(2000, () => this.showGameOverMenu());
    }

    private showGameOverMenu(): void {
        this.isGameOverMenuReady = true;
        // Buttons still held from the fight wait to be let go
        this.gameOverInput.holdEverything();
        this.gameOverSelectedIndex = 0;
        const { width, height } = this.scale;

        // Destroy the "HA ARATO" text before showing the menu
        if (this.winnerTextVisual) {
            this.winnerTextVisual.destroy();
            this.winnerTextVisual = undefined;
        }

        const startY = height / 2 - 50;
        const gap = 80;

        this.gameOverMenuOptions.forEach((option, index) => {
            const text = this.add.text(width / 2, startY + (index * gap), option, {
                fontSize: '64px',
                fontFamily: '"Pixeloid Sans"',
                color: index === 0 ? '#ffffff' : '#888888',
                align: 'center',
                stroke: '#000000',
                strokeThickness: 8
            }).setOrigin(0.5).setDepth(1001);

            if (index === 0) text.setShadow(0, 0, '#ffffff', 10, false, true);

            if (this.uiCamera) this.cameras.main.ignore(text);
            this.gameOverMenuTexts.push(text);
        });
    }

    private updateGameOverMenuHighlight(): void {
        this.gameOverMenuTexts.forEach((text, index) => {
            if (index === this.gameOverSelectedIndex) {
                text.setColor('#ffffff');
                text.setShadow(0, 0, '#ffffff', 10, false, true);
            } else {
                text.setColor('#888888');
                text.setShadow(0, 0, '#000000', 0, false, true);
            }
        });
    }

    /** Online: someone left. Their fighter leaves the match on every machine at the same frame; the rest play on. */
    private onPlayerLeft(left: PlayerLeft): void {
        if (!this.online) return;
        this.online.playerLeft(left);
        const character = this.online.start.characters[left.slot] ?? '';
        this.notify(`${character.toUpperCase()} (P${left.slot + 1}) HA LASCIATO LA PARTITA`);
    }

    /** A line across the top of the screen that fades after a few seconds. */
    private notify(text: string): void {
        const label = this.add.text(this.scale.width / 2, 110, text, {
            fontSize: '32px', fontFamily: '"Pixeloid Sans"', color: '#ffdd66', stroke: '#000000', strokeThickness: 6,
            backgroundColor: '#000000aa', padding: { x: 18, y: 8 },
        }).setOrigin(0.5).setDepth(1002);
        this.cameras.main.ignore(label);
        this.tweens.add({ targets: label, alpha: 0, delay: 3500, duration: 800, onComplete: () => label.destroy() });
    }

    /** Online: our rematch vote; the server starts the rematch once everyone still here voted. */
    private voteRematch(): void {
        this.online?.client.send(NetEvent.REMATCH);
        this.isGameOverMenuReady = false;
        this.gameOverMenuTexts.forEach(t => t.destroy());
        this.gameOverMenuTexts = [];
        // Alone, a spectator who books a seat can still join the rematch
        const others = this.online?.othersPlaying ?? 1;
        this.showCenterText(others === 0 ? 'IN ATTESA DI UN ALTRO GIOCATORE...\nESC PER USCIRE'
            : others > 1 ? 'IN ATTESA DEGLI ALTRI GIOCATORI...' : "IN ATTESA DELL'AVVERSARIO...");
    }

    /** The online match can't go on: say why, then go back to the menu. */
    private endOnline(reason: string): void {
        const client = this.online?.client ?? this.spectator?.client;
        if (!client) return;
        client.close();
        this.online = null;
        this.spectator = null;
        this.isGameOver = true;
        this.isGameOverMenuReady = false;
        this.gameOverMenuTexts.forEach(t => t.destroy());
        this.gameOverMenuTexts = [];
        this.showCenterText(reason);
        this.time.delayedCall(2500, () => this.scene.start('MainMenuScene'));
    }

    private showCenterText(text: string): void {
        this.winnerTextVisual?.destroy();
        const { width, height } = this.scale;
        this.winnerTextVisual = this.add.text(width / 2, height / 2 - 50, text, {
            fontSize: '48px',
            fontFamily: '"Pixeloid Sans"',
            color: '#ffffff',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 8
        }).setOrigin(0.5).setDepth(1001);
        this.cameras.main.ignore(this.winnerTextVisual);
    }

    // ─── Watching ───

    /** A spectator's screen: the live badge, the seat booking line, and what the server says next. */
    private setUpWatching(spectator: SpectatorMatch): void {
        const { width } = this.scale;
        const style = { fontFamily: '"Pixeloid Sans"', stroke: '#000000', strokeThickness: 6 };
        this.liveBadge = this.add.text(width / 2, 40, '● IN DIRETTA · SPETTATORE', { ...style, fontSize: '28px', color: '#ff5a5a' }).setOrigin(0.5, 0).setDepth(1002);
        this.tweens.add({ targets: this.liveBadge, alpha: 0.55, duration: 900, yoyo: true, repeat: -1 });
        // Under the badge, clear of the players' portraits along the bottom
        this.seatText = this.add.text(width / 2, 84, '', { ...style, fontSize: '22px', color: '#8ab4f8' }).setOrigin(0.5, 0).setDepth(1002);
        this.cameras.main.ignore([this.liveBadge, this.seatText]);
        this.seat = { character: Math.max(0, ALL_CHARACTERS.indexOf('fok')), booked: false };
        this.showSeat();

        const client = spectator.client;
        // A booked seat came through: play the new match
        client.on(NetEvent.START, (start: MatchStart) => {
            this.spectator = null;
            this.scene.restart({ mode: 'online', online: { client, start } });
        });
        // A new match to watch (a rematch)
        client.on(NetEvent.WATCH, (watch: WatchStart) => {
            this.spectator = null;
            // The new match's inputs start coming at once: keep them for it
            const early: WatchInputs['batches'] = [];
            client.on(NetEvent.WATCH_INPUTS, (message: WatchInputs) => early.push(...message.batches));
            this.scene.restart({ mode: 'spectate', watch: { client, watch, early } });
        });
        client.on(NetEvent.WATCH_END, (data: { reason?: string }) => this.endOnline(data?.reason ?? 'LA PARTITA È FINITA'));
        client.on(NetEvent.PLAYER_LEFT, (left: PlayerLeft) => {
            spectator.playerLeft(left);
            this.notify(`${(spectator.watch.characters[left.slot] ?? '').toUpperCase()} (P${left.slot + 1}) HA LASCIATO LA PARTITA`);
        });
        client.onDisconnect(() => this.endOnline('CONNESSIONE PERSA'));
    }

    /** Watching: the steps to play this frame (fast-forwarding when behind); returns how many the camera should follow. */
    private watchSteps(delta: number): number {
        const spectator = this.spectator!;
        const due = this.simClock.advance(this.game.loop.rawDelta || delta);
        const catchingUp = spectator.catchingUp;
        const steps = spectator.stepsNow(due);
        let done = 0;
        for (let i = 0; i < steps && !this.isGameOver; i++) {
            this.stepEvents.length = 0;
            if (!spectator.step(this.stepEvents)) break;
            this.match = spectator.match;
            // Fast-forwarding skips the sounds and effects of what it rushes through
            if (!catchingUp) for (const event of this.stepEvents) this.playEvent(event);
            if (this.match.isOver) this.onMatchOver();
            done++;
        }
        return catchingUp ? Math.min(done, 1) : done;
    }

    /** Watching: left and right pick a fighter, confirm books a seat in the next match (or cancels it). */
    private updateSeat(): void {
        for (const { action } of this.gameOverInput.poll()) {
            if (action === 'left' || action === 'right') {
                if (this.seat.booked) continue;
                const count = ALL_CHARACTERS.length;
                this.seat.character = (this.seat.character + (action === 'left' ? count - 1 : 1)) % count;
                AudioManager.getInstance().playSFX('ui_menu_hover', { volume: 0.4 });
            } else if (action === 'confirm') {
                this.seat.booked = !this.seat.booked;
                this.spectator?.client.send(NetEvent.SEAT, { character: ALL_CHARACTERS[this.seat.character], book: this.seat.booked });
                AudioManager.getInstance().playSFX(this.seat.booked ? 'ui_confirm' : 'ui_back', { volume: 0.5 });
            } else {
                continue;
            }
            this.showSeat();
        }
    }

    private showSeat(): void {
        const name = ALL_CHARACTERS[this.seat.character]?.toUpperCase() ?? '';
        this.seatText?.setText(this.seat.booked
            ? `POSTO PRENOTATO CON ${name} PER LA PROSSIMA PARTITA   ·   INVIO: ANNULLA   ·   ESC: ESCI`
            : `GIOCA LA PROSSIMA:  ◀ ${name} ▶   INVIO: PRENOTA   ·   ESC: ESCI`);
    }

    /** Playing online: how many are watching, top right. */
    private showWatchers(count: number): void {
        if (!this.watchersText) {
            this.watchersText = this.add.text(this.scale.width - 30, 30, '', {
                fontFamily: '"Pixeloid Sans"', fontSize: '22px', color: '#ff8a8a', stroke: '#000000', strokeThickness: 5,
            }).setOrigin(1, 0).setDepth(1002);
            this.cameras.main.ignore(this.watchersText);
        }
        this.watchersText.setText(count > 0 ? `● ${count} ${count === 1 ? 'SPETTATORE' : 'SPETTATORI'}` : '');
    }

    private returnToLobby(): void {
        const client = this.online?.client ?? this.spectator?.client;
        if (client) {
            client.close();
            this.online = null;
            this.spectator = null;
            this.scene.start('OnlineLobbyScene');
            return;
        }

        const isTraining = this.playerData.some(p => p.isTrainingDummy);
        const p1Data = this.playerData.find(p => p.playerId === 0);

        // Back to character selection
        this.scene.start('LobbyScene', {
            mode: this.mode === 'training' || isTraining ? 'training' : 'versus',
            inputType: p1Data?.input?.type || 'KEYBOARD',
            gamepadIndex: p1Data?.input?.gamepadIndex ?? null,
        });
    }
    private toggleDebugVisuals(visible: boolean): void {
        // Safety check for debugGraphics existence
        if (!this.debugGraphics) {
            // Re-create if missing (e.g. scene restart)
            this.debugGraphics = this.add.graphics();
            this.debugGraphics.setDepth(9999);
            if (this.uiCamera) this.uiCamera.ignore(this.debugGraphics);
        }

        this.debugGraphics.clear();
        this.debugLabels.forEach(t => t.destroy());
        this.debugLabels = [];

        if (!visible) return;

        // Collision as the simulation sees it (shared/StageData.ts)
        let side = 0;
        let top = 0;
        STAGE_LAYOUT.platforms.forEach((p, index) => {
            if (p.isSoft) this.drawDebugRect(p, 0xffff00, `TOP #${++top}`);
            else this.drawDebugRect(p, 0x00ff00, index === 0 ? 'MAIN #0' : `SIDE #${++side}`);
        });
        STAGE_LAYOUT.walls.forEach((w, index) => this.drawDebugRect(w, 0xff0000, `WALL #${index + 1}`));
        STAGE_LAYOUT.ceilings.forEach((c, index) => this.drawDebugRect(c, 0xff8800, `CEILING #${index + 1}`));
    }

    private drawDebugRect(r: SimRect, color: number, name: string): void {
        const left = r.x - r.w / 2;
        const top = r.y - r.h / 2;
        this.debugGraphics.lineStyle(2, color, 1);
        this.debugGraphics.fillStyle(color, 0.2);
        this.debugGraphics.strokeRect(left, top, r.w, r.h);
        this.debugGraphics.fillRect(left, top, r.w, r.h);
        this.addDebugLabel(r.x, top - 15, `${name} (${r.w}x${r.h})`, '#' + color.toString(16).padStart(6, '0'));
    }

    private addDebugLabel(x: number, y: number, text: string, color: string): void {
        const t = this.add.text(x, y, text, {
            fontSize: '12px',
            color: color,
            backgroundColor: '#000000aa',
            padding: { x: 2, y: 1 }
        });
        t.setOrigin(0.5);
        t.setDepth(10000);
        if (this.uiCamera) {
            this.uiCamera.ignore(t); // Only show in world camera
        }
        this.debugLabels.push(t);
    }

}
