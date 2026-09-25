import Phaser from 'phaser';
import { Player, type PlayerConfig } from '../entities/Player';
import { MatchHUD, SMASH_COLORS } from '../ui/PlayerHUD';
import { getConfirmButtonIndex } from '../input/JoyConMapper';
import { DebugOverlay } from '../components/DebugOverlay';
import { InputDebugOverlay } from '../components/InputDebugOverlay';
import { TouchController } from '../components/TouchController';
import { PauseMenu } from '../components/PauseMenu';
import { ControlsOverlay } from '../components/ControlsOverlay';
import { MapConfig, ZOOM_SETTINGS } from '../config/MapConfig';
import type { ZoomLevel } from '../config/MapConfig';
import { createStage as createSharedStage } from '../stages/StageFactory';
import { EffectManager } from '../effects/EffectManager';
import { AnimationHelpers } from '../managers/AnimationHelpers';
import { AudioManager } from '../managers/AudioManager';
import { CampaignManager } from '../managers/CampaignManager';
import { MatchRecorder } from '../debug/MatchRecorder';
import type { NetClient } from '../network/NetClient';
import { OnlineMatch } from '../network/OnlineMatch';
import { AttackRegistry, AttackType } from '../../shared/AttackData';
import type { FighterInput } from '../../shared/FighterInput';
import { isInPlay, type FighterSetup } from '../../shared/FighterState';
import { FixedStepClock } from '../../shared/FixedStepClock';
import { addFighter, createMatch, placeFighter, respawnFighter, stepMatch, type MatchState } from '../../shared/GameSim';
import type { MatchEvent } from '../../shared/MatchEvents';
import { NetEvent, type MatchStart } from '../../shared/NetProtocol';
import { STAGE_LAYOUT, type SimRect } from '../../shared/StageData';

import type { GameSceneInterface } from './GameSceneInterface';


export class GameScene extends Phaser.Scene implements GameSceneInterface {
    private debugOverlay!: DebugOverlay;
    private touchController!: TouchController;
    private backgroundImage!: Phaser.GameObjects.Image | Phaser.GameObjects.TileSprite;
    private stageTextures: Phaser.GameObjects.Image[] = [];

    // Debug visibility
    public debugVisible: boolean = false;
    private debugGraphics!: Phaser.GameObjects.Graphics;
    private debugLabels: Phaser.GameObjects.Text[] = [];
    private debugToggleKey!: Phaser.Input.Keyboard.Key;
    private inputDebugKey!: Phaser.Input.Keyboard.Key;
    private inputDebugOverlay!: InputDebugOverlay;
    private trainingToggleKey!: Phaser.Input.Keyboard.Key;

    // Kill tracking


    // Wall configuration

    public uiCamera!: Phaser.Cameras.Scene2D.Camera;

    // Camera Settings
    private currentZoomLevel: ZoomLevel = 'CLOSE';

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
    private previousAButtonPressed: boolean = false;
    private previousSelectPressed: boolean = false;
    private previousStartPressed: boolean = false;
    private gameOverUpKey!: Phaser.Input.Keyboard.Key;
    private gameOverDownKey!: Phaser.Input.Keyboard.Key;
    private gameOverEnterKey!: Phaser.Input.Keyboard.Key;

    // Pre-allocated for update() — avoids per-frame GC
    private readonly hudPlayerMap: Map<number, Player> = new Map();
    private gameOverSpaceKey!: Phaser.Input.Keyboard.Key;

    constructor() {
        super({ key: 'GameScene' });
    }

    preload(): void {
        this.loadCharacterAssets();
    }

    private loadCharacterAssets(): void {
        AnimationHelpers.loadCharacterAssets(this);
        AnimationHelpers.loadCommonAssets(this);
        AnimationHelpers.loadUIAudio(this);

        // Music is now global (loaded in PreloadScene)
        // this.load.audio('music_match_loop_main', ...); 

        this.load.on('loaderror', (file: { src: string }) => {
            console.error('Asset load failed:', file.src);
        });

        // Stage Background loaded in AnimationHelpers
    }

    private createAnimations(): void {
        AnimationHelpers.createAnimations(this);
    }



    private players: Player[] = [];
    // private playerHUDs: PlayerHUD[] = []; // Deprecated
    private matchHUD!: MatchHUD;
    public spawnPoints: { x: number, y: number }[] = [];
    private playerData: any[] = [];

    private winnerTextVisual?: Phaser.GameObjects.Text;

    public effectManager!: EffectManager;

    private mode: 'versus' | 'training' | 'campaign' | 'online' = 'versus';

    // ColorMatrix FX for campaign visual progression (desaturation effect)
    private campaignColorMatrices: Phaser.FX.ColorMatrix[] = [];
    private campaignTintProgress: number = 0; // 0 = fully desaturated, 1 = fully restored

    // Campaign multi-phase fight flow
    private campaignMidFightPlayed: boolean = false;

    // Training mode state
    private isTraining: boolean = false;
    private trainingOpponentIndex: number = 0;

    private currentStageBackground: string = 'adria_bg';

    init(data: any): void {
        this.mode = data.mode || 'versus';
        this.campaignMidFightPlayed = false; // Reset for each new match
        this.campaignColorMatrices = []; // Reset stale FX references from previous rounds
        this.campaignTintProgress = 0;
        this.isTraining = data.isTraining || false;
        this.trainingOpponentIndex = data.trainingOpponentIndex || 0;

        // Apply selected map from lobby (non-campaign)
        if (data.selectedMap) {
            this.currentStageBackground = data.selectedMap;
        } else {
            this.currentStageBackground = 'adria_bg';
        }

        this.online = null;
        if (this.mode === 'online') {
            const { client, start } = data.online as { client: NetClient; start: MatchStart };
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

        if (this.mode === 'campaign') {
            const campaign = CampaignManager.getInstance();
            const selectedChar = this.playerData[0]?.character || 'fok';
            const slotIndex = data.slotIndex ?? campaign.getActiveSlotIndex();

            campaign.ensureActive(selectedChar, slotIndex);

            const opponent = this.isTraining
                ? campaign.ladder[this.trainingOpponentIndex]
                : campaign.getCurrentOpponent();

            if (opponent) {
                // Force P1 and Opponent
                this.playerData = [
                    this.playerData[0], // P1
                    {
                        playerId: 1,
                        joined: true,
                        ready: true,
                        input: { type: 'KEYBOARD', gamepadIndex: null },
                        character: opponent.character,
                        isAI: true,
                        isTrainingDummy: true // Added for testing purposes so AI stands still
                    }
                ];
                this.currentStageBackground = opponent.stage;
            }
        }

        // Register shutdown handler
        this.events.once('shutdown', this.shutdown, this);
    }


    create(): void {
        try {
            // Initialize Effect Manager
            this.effectManager = new EffectManager(this);

            // CRITICAL: Reset state arrays on scene restart
            // CRITICAL: Reset state arrays on scene restart
            this.players.forEach(p => p.destroy());
            this.players = [];
            // this.playerHUDs = [];
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

            // --- Fok Animations ---
            this.createAnimations();


            // BACKGROUND LOGIC
            // Move background creation here to ensure it's managed, but depth should handle order.
            // If SetDepth(-20) isn't working, it might be due to display list order if depth sorting isn't enabled or is buggy.
            // Safest: create background FIRST.
            // But since we are patching, let's try to force it to back of display list AND use depth.

            // Note: I added background loading in createAnimations() earlier, which is called above.
            // Let's remove it from there and put it here cleanly.
            // Actually, let's just use what was added in createAnimations (which I effectively patched into 'create' in previous step? No, wait.)

            // In the previous patch, I added the background code inside 'createAnimations'??
            // Let's check where line 271 is. 
            // Ah, I see "this.createAnimations();" at line 271.
            // And then "Set background color (fallback)" at line 274.
            // It seems I added the background code AFTER createAnimations, inside 'create'.

            // If z-index -20 is obscuring, maybe the camera transform is ignored for background?
            // Or maybe the players have lower Z?
            // Player Z is 0.

            // Let's try setScrollFactor(0) to make it static and ensure depth is comfortably low.
            // And also `sendToBack()`.

            // Setup cameras (Must be before createStage so UI camera exists for ignore logic)
            this.setupCameras();

            // Touch Controller Overlay
            this.touchController = new TouchController(this);
            if (this.uiCamera) {
                this.touchController.setCameraIgnore(this.cameras.main, this.uiCamera);
            }

            // Create stage platforms
            this.createStage();

            // LOADING SCREEN (User Request: Hide blue transition)
            const loadingOverlay = this.add.rectangle(
                this.scale.width / 2, this.scale.height / 2,
                this.scale.width, this.scale.height, 0x000000
            ).setDepth(10000); // Top level

            const loadingText = this.add.text(
                this.scale.width / 2, this.scale.height / 2,
                "LOADING...",
                { fontSize: '32px', color: '#ffffff', fontFamily: '"Pixeloid Sans"' }
            ).setOrigin(0.5).setDepth(10001);

            // Ignore loading screen for UI camera if it exists (though UI camera is created inside setupCameras)
            if (this.uiCamera) {
                this.uiCamera.ignore([loadingOverlay, loadingText]);
            }
            // Actually, we want it ON the main camera or UI camera?
            // If we put it on Main, it covers everything.
            // If UI camera ignores it, it won't be drawn by UI camera.
            // But Main camera sees it.
            // However, verify if UI Camera clears the screen? No, it usually overlays.
            // So this is fine.

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

            // this.sound.stopAll(); // Removed to allow global music persistence

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

                // Set Color (all players use their assigned color)
                let color = this.PLAYER_COLORS[pData.playerId] || 0xffffff;

                // Campaign color overrides for indicators (HUD and name tags)
                if (this.mode === 'campaign') {
                    if (pData.playerId === 0) color = 0xF0F0F0; // Off-white for player
                    else color = 0xFFFFFF; // White for opponent
                }

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

                // Add to HUD
                this.addPlayerToHUD(player);

                // If campaign first encounter, apply visual suppression to opponent (playerId 1)
                if (this.mode === 'campaign' && !this.isTraining && pData.playerId === 1) {
                    if (player.spriteObject.postFX) {
                        const fx = player.spriteObject.postFX.addColorMatrix();
                        fx.saturate(-0.5);
                        this.campaignColorMatrices.push(fx);
                    }
                }
            });

            // If campaign and NOT training, trigger transition to cutscene immediately
            if (this.mode === 'campaign' && !this.isTraining) {
                const opponent = CampaignManager.getInstance().getCurrentOpponent();
                if (opponent) {
                    // Start cutscene, moving P1 slightly left and P2 slightly right of center
                    this.transitionToCutscene([
                        { playerId: 0, x: 860, y: 750 },
                        { playerId: 1, x: 1060, y: 750 }
                    ], opponent.dialogueBefore, this.playerData[0].character, opponent.character).catch((e: Error | unknown) => console.error(e));
                }
            }

            // Re-run camera exclusions now that players exist
            // (setupCameras was moved up before createStage, but players are created after)
            this.configureCameraExclusions();

            // Create debug overlay
            this.debugOverlay = new DebugOverlay(this);
            this.debugOverlay.setCameraIgnore(this.cameras.main);

            // Versus mode: only show FPS/Ping. Full debug is training-only.
            const isTrainingMode = this.playerData.some((p: any) => p.isTrainingDummy);
            if (!isTrainingMode) {
                this.debugOverlay.setMinimalMode(true);
            }

            // Debug Graphics for Platform Visualization
            this.debugGraphics = this.add.graphics();
            this.debugGraphics.setDepth(9999);
            this.uiCamera.ignore(this.debugGraphics); // Only visible in main camera (world space)

            // Add controls hint
            // this.createControlsHint();

            // Create HUDs
            this.createHUDs();

            // Toggle key
            this.debugToggleKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
            this.inputDebugKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F2);
            this.trainingToggleKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.T);
            this.pauseKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
            this.gameOverSpaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
            this.gameOverUpKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
            this.gameOverDownKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
            this.gameOverEnterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

            // Input Debug Overlay (F2)
            this.inputDebugOverlay = new InputDebugOverlay(this);
            this.inputDebugOverlay.setCameraIgnore(this.cameras.main);

            // Create pause menu
            this.pauseMenu = new PauseMenu(this);
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
                        const isTraining = this.playerData.some((p: any) => p.isTrainingDummy);
                        const p1Data = this.playerData.find((p: any) => p.playerId === 0);
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
            this.events.on('pauseMenuMap', () => {
                const campaign = CampaignManager.getInstance();
                this.scene.start('CampaignMapScene', {
                    playerData: [this.playerData[0]],
                    mode: 'campaign',
                    slotIndex: campaign.getActiveSlotIndex(),
                    targetIslandIndex: this.trainingOpponentIndex
                });
            });
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
                    this.online.start = start;
                    this.restartMatch();
                });
                client.on(NetEvent.PLAYER_LEFT, () => this.endOnline("UN GIOCATORE SE N'È ANDATO"));
                client.onDisconnect(() => this.endOnline('CONNESSIONE PERSA'));
                // Network stats on screen by default (Q toggles)
                this.debugVisible = true;
            }

            // Handle Resume from other scenes
            this.events.on('resume', () => {
                if (this.isPaused) {
                    this.pauseMenu.show();
                    this.input.keyboard?.resetKeys();
                }
            });
        } catch (e: any) {
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
        if (this.stageTextures.length > 0) this.uiCamera.ignore(this.stageTextures);

        // Ignore entities
        this.uiCamera.ignore(this.players);
    }

    private createStage(): void {
        const stage = createSharedStage(this, this.currentStageBackground);
        this.backgroundImage = stage.background;
        this.stageTextures = [...stage.platformTextures];

        // Apply campaign visual suppression (desaturation effect) — only on first encounters
        if (this.mode === 'campaign' && !this.isTraining) {
            this.campaignColorMatrices = [];
            this.campaignTintProgress = 0;

            // Background
            if (stage.background.postFX) {
                const bgFx = stage.background.postFX.addColorMatrix();
                bgFx.saturate(-0.5);
                this.campaignColorMatrices.push(bgFx);
            }

            // Platform Textures
            stage.platformTextures.forEach(tex => {
                if ((tex as any).postFX) {
                    const fx = (tex as any).postFX.addColorMatrix();
                    fx.saturate(-0.5);
                    this.campaignColorMatrices.push(fx);
                }
            });
        }

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

    private addPlayerToHUD(player: Player): void {
        if (this.matchHUD) {
            // Local game logic
            // If strictly 1 human vs CPU, P1 is You. 
            // If local multiplayer (P1 vs P2 human), both are "You"? No, that's confusing.
            // Let's say Player 1 is ALWAYS "You" in single/local? 
            // Or just P1 / P2 tags.
            // User complained: "In training mode I'm currently battling a CPU, display the correct name (it's not P2 (YOU))"

            // Logic:
            // If AI -> Name = "CPU" or Character Name. isLocal = false.
            // If Human -> Name = "P1" etc. isLocal = true (for P1 only maybe?)

            const isYOU = player.playerId === this.localPlayerId();

            let name = `P${player.playerId + 1} `;
            if (player.isAI) {
                name = "CPU"; // or player.character
            }

            this.matchHUD.addPlayer(player.playerId, name, isYOU, player.character || 'fok');
        }
    }

    private debugUpdateCounter = 0;

    /**
     * Chromatic Aberration Implementation:
     * Uses built-in Camera Shake + Flash red/blue as a cheap "vibe" alternative 
     * if simple CA shader isn't available, but here we will try to use the ColorMatrix 
     * or simple camera shake which natively does some of this feeling.
     * 
     * ACTUALLY: Let's use a "Glitch" shake.
     */


    update(_time: number, delta: number): void {
        // Poll LB for controls overlay toggle
        this.controlsOverlay.update();

        // --- HITSTOP REMOVED --- 
        // Logic flows normally now.

        this.debugUpdateCounter++;

        // Stop updates if game over
        if (this.isGameOver) {
            this.players.forEach(p => p.render(this.match, delta));
            // The opponent may still be simulating the last frames with our inputs
            this.online?.flush();

            // Wait until 5 seconds passes and menu appears
            if (!this.isGameOverMenuReady) return;

            // Handle Menu Navigation
            let moveUp = Phaser.Input.Keyboard.JustDown(this.gameOverUpKey);
            let moveDown = Phaser.Input.Keyboard.JustDown(this.gameOverDownKey);
            let confirm = Phaser.Input.Keyboard.JustDown(this.gameOverEnterKey) || Phaser.Input.Keyboard.JustDown(this.gameOverSpaceKey);

            // Also check gamepads for navigation
            const gamepads = navigator.getGamepads();
            for (const gp of gamepads) {
                if (!gp) continue;
                // Basic D-Pad checking
                if (gp.buttons[12]?.pressed) moveUp = true;
                if (gp.buttons[13]?.pressed) moveDown = true;
                const confirmIdx = getConfirmButtonIndex(gp);
                if (gp.buttons[confirmIdx]?.pressed) {
                    if (!this.previousAButtonPressed) {
                        this.previousAButtonPressed = true;
                        confirm = true;
                    }
                }
            }

            // A Button Edge Detection Release
            const isAnyAPressed = Array.from(gamepads).some(gp => {
                if (!gp) return false;
                return gp.buttons[getConfirmButtonIndex(gp)]?.pressed;
            });
            if (!isAnyAPressed) this.previousAButtonPressed = false;

            if (moveUp) {
                this.gameOverSelectedIndex = (this.gameOverSelectedIndex - 1 + this.gameOverMenuOptions.length) % this.gameOverMenuOptions.length;
                this.updateGameOverMenuHighlight();
                // AudioManager.getInstance().playSFX('ui_menu_hover', { volume: 0.5 }); // Optional
            } else if (moveDown) {
                this.gameOverSelectedIndex = (this.gameOverSelectedIndex + 1) % this.gameOverMenuOptions.length;
                this.updateGameOverMenuHighlight();
                // AudioManager.getInstance().playSFX('ui_menu_hover', { volume: 0.5 }); // Optional
            } else if (confirm) {
                AudioManager.getInstance().playSFX('ui_confirm', { volume: 0.5 });
                if (this.gameOverSelectedIndex === 0) {
                    if (this.online) this.voteRematch();
                    else this.restartMatch();
                } else if (this.gameOverSelectedIndex === 1) {
                    this.returnToLobby();
                }
            }

            return;
        }

        if (this.debugUpdateCounter % 60 === 0) {
        }

        // Handle Pause Toggle (ESC key or START button on gamepad)
        const pauseKeyPressed = Phaser.Input.Keyboard.JustDown(this.pauseKey);
        const gamepadPausePressed = this.checkGamepadPause();

        if ((pauseKeyPressed || gamepadPausePressed) && this.online) {
            // An online match can't pause for both players: ESC leaves it
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
        const gamepadSelectPressed = this.checkGamepadSelect();

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

        if (!this.isCutscene) {
            // Online: raw frame time, since Phaser clamps its smoothed delta while the window is unfocused
            const steps = this.simClock.advance(this.online ? this.game.loop.rawDelta : delta);
            for (let i = 0; i < steps && !this.isGameOver; i++) {
                // A step spent waiting for the opponent is dropped, not caught up later
                if (!this.stepSimulation()) break;
            }
        }
        this.online?.flush();
        this.players.forEach(p => p.render(this.match, delta));

        // Camera Follow
        this.updateCamera();

        // Update debug overlay (Showing P1 stats for now)
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
                    this.online ? Math.round(this.online.client.rtt) : 0
                );
                this.debugOverlay.setNetworkStats(this.online?.stats() ?? null);
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
        return this.online?.slot ?? 0;
    }

    /** Starts a fresh match with the current fighters. */
    private startMatch(): void {
        const seed = this.online?.start.seed ?? Math.floor(Math.random() * 0x100000000);
        this.match = createMatch(this.fighterSetups, seed);
        this.online?.begin(this.match);
        // Online frames can be simulated more than once, so only local matches are recorded
        this.recorder = this.isRecording && !this.online ? new MatchRecorder(this.fighterSetups, seed) : null;
    }

    private playEvent(event: MatchEvent): void {
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
                this.onHit(event.attacker, event.target, event.attackKey);
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

    private onHit(attacker: number, target: number, attackKey: string | null): void {
        this.players[attacker].playHitSound(attackKey);
        if (attackKey && AttackRegistry[attackKey].type === AttackType.HEAVY) {
            this.cameras.main.shake(100, 0.005);
        }

        // The campaign opponent doesn't flash
        const victim = this.players[target];
        if (!(this.mode === 'campaign' && victim.playerId === 1)) {
            victim.flashDamage(this.match.fighters[target].damagePercent);
        }
    }

    /** A fighter left the stage: impact, crowd, and the campaign's reactions. */
    private onKnockOut(index: number, x: number, y: number): void {
        const player = this.players[index];
        const fighter = this.match.fighters[index];

        this.cameras.main.shake(300, 0.02);
        const impactX = Phaser.Math.Clamp(x, MapConfig.BLAST_ZONE_LEFT + 100, MapConfig.BLAST_ZONE_RIGHT - 100);
        const impactY = Phaser.Math.Clamp(y, MapConfig.BLAST_ZONE_TOP + 100, MapConfig.BLAST_ZONE_BOTTOM - 100);
        this.effectManager.spawnDeathExplosion(impactX, impactY, 0xff4444);

        const audio = AudioManager.getInstance();
        audio.playSFX('sfx_death', { volume: 0.8 });
        audio.playSFX(Math.random() > 0.5 ? 'sfx_death_crowd_1' : 'sfx_death_crowd_2', { volume: 0.5 });

        // Campaign Visual Progression: Smoothly restore saturation when opponent loses a life
        if (this.mode === 'campaign' && player.playerId === 1 && this.campaignColorMatrices.length > 0) {
            const maxLives = 3;
            // Calculate what fraction of color to restore (0 = desaturated, 1 = full color)
            const livesLost = maxLives - fighter.lives;
            const targetProgress = livesLost / maxLives;
            const startProgress = this.campaignTintProgress;

            this.tweens.addCounter({
                from: startProgress * 100,
                to: targetProgress * 100,
                duration: 3000,
                ease: 'Linear',
                onUpdate: (_tween: Phaser.Tweens.Tween) => {
                    const progress = (_tween.getValue() ?? 0) / 100;
                    this.campaignTintProgress = progress;
                    // Lerp saturation from -0.5 (50% desaturated) to 0 (full color)
                    const saturation = -0.5 + (0.5 * progress); // goes from -0.5 → 0
                    this.campaignColorMatrices.forEach(fx => {
                        fx.reset();
                        fx.saturate(saturation);
                    });
                }
            });
        }

        // Campaign mid-fight cutscene: when the opponent is down to its last life
        if (this.mode === 'campaign' && !this.isTraining && player.playerId === 1 && fighter.lives === 1 && !this.campaignMidFightPlayed) {
            this.campaignMidFightPlayed = true;
            const opponent = CampaignManager.getInstance().getCurrentOpponent();
            if (opponent && opponent.dialogueMidFight.length > 0) {
                // Fade to black, then show cutscene
                this.cameras.main.fadeOut(1000, 0, 0, 0);
                this.cameras.main.once('camerafadeoutcomplete', () => {
                    // Respawn opponent and set up cutscene while screen is black
                    respawnFighter(this.match, index);
                    this.campaignMidFightCutscene(opponent);
                    // Fade back in to reveal the cutscene
                    this.cameras.main.fadeIn(1000, 0, 0, 0);
                });
            }
        }
    }

    private showRespawnFlash(x: number, y: number): void {
        const flash = this.add.graphics();
        flash.fillStyle(0xffffff, 0.8);
        flash.fillCircle(x, y, 75);
        this.uiCamera?.ignore(flash);
        this.tweens.add({
            targets: flash,
            alpha: 0,
            scale: 2,
            duration: 300,
            onComplete: () => flash.destroy()
        });
    }

    public setZoomLevel(level: ZoomLevel): void {
        this.currentZoomLevel = level;
    }

    private updateCamera(): void {
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

        // Lerp Camera
        const cam = this.cameras.main;
        cam.zoom = Phaser.Math.Linear(cam.zoom, targetZoom, 0.1); // Increased from 0.05
        cam.centerOn(
            Phaser.Math.Linear(cam.midPoint.x, centerX, 0.2), // Increased from 0.1
            Phaser.Math.Linear(cam.midPoint.y, centerY, 0.2)
        );
    }



    private togglePause(): void {
        this.isPaused = !this.isPaused;
        if (this.isPaused) {
            AudioManager.getInstance().playSFX('ui_player_found', { volume: 0.6 });
            this.pauseMenu.show();
        } else {
            this.pauseMenu.hide();
        }
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

    private spawnTrainingDummy(): void {
        const maxPlayers = 6; // User requested up to 5 CPUs (assuming +1 user = 6 total)

        // Find first available player ID
        let availableId = -1;
        for (let i = 0; i < maxPlayers; i++) {
            if (!this.players.find(p => p.playerId === i)) {
                availableId = i;
                break;
            }
        }

        if (availableId === -1) {
            console.log("Max players reached");
            return;
        }

        // --- Random Character Logic ---
        // Get list of currently used characters
        const usedCharacters = this.players.map(p => p.character);

        // Filter available characters from ALL_CHARACTERS
        // Import ALL_CHARACTERS is needed. 
        // Since I cannot import easily in replace_block without adding to top, I will use hardcoded list or assume imports.
        // Actually, I can use Object.keys(charConfigs) if imported, or just hardcode the list for now if import is missing.
        // Let's check imports. MainMenuScene has no imports of config. 
        // GameScene imports `charConfigs`? 
        // I will assume `ALL_CHARACTERS` or `charConfigs` is available or I will add the import.
        // Let's just use the keys from `charConfigs` if available, or list them.
        // GameScene likely has `charConfigs` imported.
        // Wait, `CharacterConfig` was imported in recent changes.
        // Let's assume `ALL_CHARACTERS` is available or use a local list to be safe.
        // validChars = ['fok', 'sgu', 'sga', 'pe', 'nock', 'greg'];
        const validChars = ['fok', 'sgu', 'sga', 'pe', 'nock', 'greg'];

        const availableChars = validChars.filter(c => !usedCharacters.includes(c));

        if (availableChars.length === 0) {
            console.log("All characters already on screen");
            return;
        }

        const randomChar = availableChars[Phaser.Math.Between(0, availableChars.length - 1)];

        const playerId = availableId;

        // Data
        const dummyData = {
            playerId: playerId,
            joined: true,
            ready: true,
            input: { type: 'KEYBOARD', gamepadIndex: null },
            character: randomChar,
            isAI: true,
            isTrainingDummy: true // Keep this flag for now, maybe rename to isCPU later?
        };

        // Check if already exists in data (shouldn't if check passed)
        if (!this.playerData.find(pd => pd.playerId === playerId)) {
            this.playerData.push(dummyData);
        }

        // Create dynamic spawn points for up to 6 players
        // Center area is around 960.
        // Let's distribute them: 
        // 4 players: 400, 800, 1120, 1520
        // 6 players: Need to squeeze or spread.
        // Let's stick to the center cluster logic for now, but widen it.
        // 960 center. 
        // Logic was: 960 + (playerId * 40).
        // P0=960, P1=1000, P2=1040, P3=1080, P4=1120, P5=1160
        // That's fine, prevents stacking.
        const spawnX = 960 + (playerId * 60) - 100; // Shift left a bit so P0 isn't center
        // P0 (User) = 860
        // P1 = 920
        // P2 = 980
        // P3 = 1040
        // P4 = 1100
        // P5 = 1160
        const spawnY = 300;

        const setup = { character: randomChar, x: spawnX, y: spawnY };
        this.fighterSetups.push(setup);
        const fighter = addFighter(this.match, setup);
        const player = new Player(this, fighter, { playerId, character: randomChar, isAI: true, isTrainingDummy: true });
        player.setColor(this.PLAYER_COLORS[playerId] || 0xffffff);

        this.players.push(player);
        this.uiCamera.ignore(player);

        // Add to MatchHUD
        this.addPlayerToHUD(player);
    }

    // Clean up when scene is shut down (e.g. switching to menu)
    // Clean up when scene is shut down (e.g. switching to menu)
    shutdown(): void {
        this.online?.client.close();
        this.online = null;

        try {
            this.input.keyboard?.removeAllKeys();
            this.input.keyboard?.resetKeys();
        } catch (e) {
            console.warn("Error clearing input keys:", e);
        }

        // Kill event listeners
        this.events.off('pauseMenuResume');
        this.events.off('pauseMenuRestart');
        this.events.off('pauseMenuSettings');
        this.events.off('pauseMenuLobby');
        this.events.off('pauseMenuExit');
        this.events.off('spawnDummy');

        // Destroy players
        this.players.forEach(p => p.destroy());
        this.players = [];

        // Destroy HUD
        if (this.matchHUD) {
            this.matchHUD.destroy();
        }

        // Destroy overlays and menus
        if (this.pauseMenu) {
            this.pauseMenu.destroy();
        }
        if (this.controlsOverlay) {
            this.controlsOverlay.destroy();
        }
        if (this.inputDebugOverlay) {
            this.inputDebugOverlay.destroy();
        }
        if (this.debugOverlay) {
            this.debugOverlay.destroy();
        }

        // Stop all active tweens
        this.tweens.killAll();
    }
    /** The simulation ended the match: at most one fighter has lives left. */
    private onMatchOver(): void {
        const winner = this.match.winnerId >= 0 ? this.players[this.match.winnerId] : null;

        // Campaign mode: skip win animation and rematch entirely
        if (this.mode === 'campaign' && !this.isTraining && winner && winner.playerId === 0) {
            CampaignManager.getInstance().advanceLadder();
            this.campaignDefeatCutscene();
            return;
        }

        this.handleGameOver(winner ? winner.playerId : -1);
    }

    private handleGameOver(winnerId: number): void {
        if (this.isGameOver) return;
        this.isGameOver = true;

        const { width, height } = this.scale;

        let winnerText = "GAME!";
        let winner: Player | undefined;

        if (winnerId >= 0) {
            AudioManager.getInstance().playSFX('sfx_knockout', { volume: 0.8 });
            winner = this.players.find(p => p.playerId === winnerId);

            if (this.mode !== 'campaign') {
                winnerText += `\nPLAYER ${winnerId + 1} HA ARATO!`; // Custom Text
                // DRAMATIC ZOOM
                if (winner) {
                    winner.setPose('win'); // Auto-taunt on victory
                    this.cameras.main.pan(winner.x, winner.y, 1500, 'Power2');
                    this.cameras.main.zoomTo(3.5, 1500, 'Power2');
                }
            }
        } else {
            if (this.mode !== 'campaign') {
                winnerText += "\nDRAW GAME!";
            }
        }

        if (this.mode !== 'campaign') {
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
        }

        if (this.mode === 'campaign' && this.isTraining) {
            // Instantly transition to black screen dialogue
            this.cameras.main.fade(1500, 0, 0, 0, false, (_camera: Phaser.Cameras.Scene2D.Camera, progress: number) => {
                if (progress === 1) {
                    this.handleTrainingGameOver(winnerId);
                }
            });
        } else if (this.mode === 'campaign' && !this.isTraining) {
            // Player lost campaign match! Instantly transition to black screen retry dialogue
            this.cameras.main.fade(1500, 0, 0, 0, false, (_camera: Phaser.Cameras.Scene2D.Camera, progress: number) => {
                if (progress === 1) {
                    this.handleCampaignLoseGameOver();
                }
            });
        } else {
            // 2-second delay (normal versus matches)
            this.time.delayedCall(2000, () => {
                this.showGameOverMenu();
            });
        }
    }

    private handleTrainingGameOver(winnerId: number): void {
        const campaign = CampaignManager.getInstance();
        const opponent = campaign.ladder[this.trainingOpponentIndex];
        const oppCharKey = opponent?.character || 'sgu';

        const isWin = winnerId === 0;

        // Get dialogue text from the data files
        const dialogueLines = isWin
            ? (opponent?.dialogueTrainingWin ?? [])
            : (opponent?.dialogueTrainingLose ?? []);

        const dialogueText = (dialogueLines.length > 0
            ? dialogueLines[0].text
            : (isWin ? 'Well done!' : 'You should train more.')) + ' Want to train more?';
        const speakerName = dialogueLines.length > 0
            ? dialogueLines[0].speaker
            : oppCharKey;

        // Launch Dialogue Scene with YES/NO choices
        if (this.scene.isActive('DialogueScene') || this.scene.isSleeping('DialogueScene')) {
            this.scene.stop('DialogueScene');
        }

        this.scene.launch('DialogueScene', {
            leftCharacter: this.playerData[0]?.character || 'fok',
            rightCharacter: oppCharKey,
            dialogueData: [
                {
                    speaker: speakerName,
                    text: dialogueText,
                    side: 'right',
                    animation: 'idle',
                    choices: [
                        {
                            text: 'YES', action: () => {
                                // Restart match
                                this.scene.restart({
                                    playerData: this.playerData,
                                    mode: 'campaign',
                                    slotIndex: campaign.getActiveSlotIndex(),
                                    isTraining: true,
                                    trainingOpponentIndex: this.trainingOpponentIndex
                                });
                            }
                        },
                        {
                            text: 'NO', action: () => {
                                // Return to minimap
                                this.scene.start('CampaignMapScene', {
                                    playerData: [this.playerData[0]],
                                    mode: 'campaign',
                                    slotIndex: campaign.getActiveSlotIndex(),
                                    targetIslandIndex: this.trainingOpponentIndex // Add this!
                                });
                            }
                        }
                    ]
                }
            ],
            blackBackground: true
        });
    }

    private handleCampaignLoseGameOver(): void {
        const campaign = CampaignManager.getInstance();
        const opponent = campaign.getCurrentOpponent();
        const oppCharKey = opponent?.character || 'sgu';

        const dialogueLines = opponent?.dialogueCampaignLose ?? [];

        // Grab the dialogue data (use the first line)
        const dialogueData = dialogueLines.length > 0
            ? dialogueLines[0]
            : { speaker: oppCharKey, text: "You lost. Want to try again?", side: 'right', animation: "idle" };

        // Ensure choices are appended
        const choiceData = {
            speaker: dialogueData.speaker,
            text: dialogueData.text,
            side: dialogueData.side as 'left' | 'right',
            animation: (dialogueData as any).animation || 'idle',
            choices: [
                {
                    text: 'YES', action: () => {
                        // Restart match (same level)
                        this.scene.restart({
                            playerData: this.playerData,
                            mode: 'campaign',
                            slotIndex: campaign.getActiveSlotIndex(),
                            isTraining: false
                        });
                    }
                },
                {
                    text: 'NO', action: () => {
                        // Return to minimap
                        this.scene.start('CampaignMapScene', {
                            playerData: [this.playerData[0]],
                            mode: 'campaign',
                            slotIndex: campaign.getActiveSlotIndex(),
                            targetIslandIndex: this.trainingOpponentIndex // Add this!
                        });
                    }
                }
            ]
        };

        if (this.scene.isActive('DialogueScene') || this.scene.isSleeping('DialogueScene')) {
            this.scene.stop('DialogueScene');
        }

        this.scene.launch('DialogueScene', {
            leftCharacter: this.playerData[0]?.character || 'fok',
            rightCharacter: oppCharKey,
            dialogueData: [choiceData],
            blackBackground: true
        });
    }

    private showGameOverMenu(): void {
        this.isGameOverMenuReady = true;
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

    /** Online: our rematch vote; the server starts the rematch once both players voted. */
    private voteRematch(): void {
        this.online?.client.send(NetEvent.REMATCH);
        this.isGameOverMenuReady = false;
        this.gameOverMenuTexts.forEach(t => t.destroy());
        this.gameOverMenuTexts = [];
        this.showCenterText(this.players.length > 2 ? 'IN ATTESA DEGLI ALTRI GIOCATORI...' : "IN ATTESA DELL'AVVERSARIO...");
    }

    /** The online match can't go on: say why, then go back to the menu. */
    private endOnline(reason: string): void {
        if (!this.online) return;
        this.online.client.close();
        this.online = null;
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

    private returnToLobby(): void {
        if (this.online) {
            this.online.client.close();
            this.online = null;
            this.scene.start('OnlineLobbyScene');
            return;
        }

        const isTraining = this.playerData.some((p: any) => p.isTrainingDummy);
        const p1Data = this.playerData.find((p: any) => p.playerId === 0);

        let targetMode = 'versus';
        if (this.mode === 'training' || isTraining) targetMode = 'training';
        if (this.mode === 'campaign') targetMode = 'campaign';

        // Check if campaign is completed (no next opponent)
        if (this.mode === 'campaign' && CampaignManager.getInstance().getCurrentOpponent() === null) {
            // Campaign is complete — go back to map so player can do training rematch.
            // Save is kept intact.
            this.scene.start('CampaignMapScene', {
                playerData: [this.playerData[0]],
                mode: 'campaign',
                slotIndex: CampaignManager.getInstance().getActiveSlotIndex(),
                targetIslandIndex: this.trainingOpponentIndex
            });
            return;
        }

        // Just start GameScene directly if we are in campaign?
        // Actually, if campaign, we may want to skip lobby. Let Lobby check and auto-start maybe?
        // Let's just go back to Lobby in 'campaign' mode, and Lobby auto-assigns and starts? 
        // No, lobby doesn't auto-start. 
        // Let's go to Lobby but pass the 'campaign' mode so player can select character again?
        // Or we can just restart GameScene if campaign continues.
        // Let's go to Lobby so they can pick character for next round.

        this.scene.start('LobbyScene', {
            mode: targetMode,
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



    // --- Cinematic Methods ---
    public async transitionToCutscene(positions: { playerId: number, x: number, y: number }[], dialogue: any[], leftChar?: string, rightChar?: string): Promise<void> {
        return new Promise<void>((resolve) => {
            // Hold the match and stand the fighters at their marks, facing each other
            this.isCutscene = true;
            positions.forEach(pos => {
                const player = this.players.find(p => p.playerId === pos.playerId);
                if (!player) return;
                placeFighter(this.match, player.fighterIndex, pos.x, pos.y, pos.playerId === 0 ? 1 : -1);
                player.setPose('idle');
            });

            // Wait 600ms for the black LOADING overlay to fade out, then launch dialogue
            this.time.delayedCall(600, () => {
                // Hide match HUD now that it's fully constructed
                if (this.matchHUD) this.matchHUD.setVisible(false);
                this.launchDialogue(dialogue, resolve, leftChar, rightChar);
            });
        });
    }

    private launchDialogue(dialogue: any[], resolve: () => void, leftChar?: string, rightChar?: string): void {
        const diagData = {
            dialogueData: dialogue,
            leftCharacter: leftChar,
            rightCharacter: rightChar
        };

        // Stop any stale DialogueScene first, then launch fresh
        if (this.scene.isActive('DialogueScene')) {
            this.scene.stop('DialogueScene');
        }

        // Get scene reference BEFORE launch so we can listen for lifecycle events
        const diagScene = this.scene.get('DialogueScene');

        // Bind animation listener BEFORE launch — DialogueScene.create() synchronously
        // calls showCurrentLine() which emits dialogue_animation during create().
        diagScene.events.on('dialogue_animation', (side: 'left' | 'right', animation: string) => {
            const targetPlayerId = side === 'left' ? 0 : 1;
            this.players.find(p => p.playerId === targetPlayerId)?.setPose(animation);
        });

        diagScene.events.once('dialogue_complete', () => {
            diagScene.events.off('dialogue_animation');
            this.endCutscene();
            resolve();
        });

        this.scene.launch('DialogueScene', diagData);
    }

    private endCutscene(): void {
        this.players.forEach(p => p.setPose(null));
        this.isCutscene = false;

        // Restore HUD visibility
        if (this.mode === 'campaign' && this.matchHUD) {
            this.matchHUD.setVisible(true);
        }
    }

    /**
     * Campaign mid-fight cutscene: freeze both players, play dialogue, then resume fight.
     */
    private campaignMidFightCutscene(opponent: import('../managers/CampaignManager').OpponentConfig): void {
        // Hold the match and stand both fighters on the stage, facing each other
        this.isCutscene = true;
        const p1 = this.players.find(p => p.playerId === 0);
        const p2 = this.players.find(p => p.playerId === 1);
        if (p1) placeFighter(this.match, p1.fighterIndex, 860, 750, 1);
        if (p2) placeFighter(this.match, p2.fighterIndex, 1060, 750, -1);
        this.players.forEach(p => p.setPose('idle'));

        // Hide HUD during cutscene
        if (this.matchHUD) this.matchHUD.setVisible(false);

        // Launch mid-fight dialogue
        const playerChar = this.playerData[0]?.character || 'fok';
        this.launchDialogueWithCallback(
            opponent.dialogueMidFight,
            playerChar,
            opponent.character,
            () => {
                // Resume fight after mid-fight cutscene
                this.endCutscene();
            }
        );
    }

    /**
     * Campaign defeat cutscene: plays after opponent is eliminated.
     * Skips win animation and rematch prompt entirely.
     */
    private campaignDefeatCutscene(): void {
        this.isGameOver = true; // Prevent normal game over flow

        const opponent = CampaignManager.getInstance().ladder[
            (CampaignManager.getInstance() as any).currentData.currentLevel - 1
        ];

        // Fade to black immediately after death
        this.cameras.main.fadeOut(1000, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            // Reset camera to default state (stop any pan/zoom/shake from death)
            this.cameras.main.stopFollow();
            this.cameras.main.resetFX();
            this.cameras.main.setZoom(1);
            this.cameras.main.centerOn(960, 540);

            // Position both players face-to-face like the intro cutscene
            const p1 = this.players.find(p => p.playerId === 0);
            const p2 = this.players.find(p => p.playerId === 1);

            // The match is over; the eliminated opponent is posed back on stage
            if (p1) {
                placeFighter(this.match, p1.fighterIndex, 860, 750, 1);
                p1.setPose('idle');
            }
            if (p2) {
                placeFighter(this.match, p2.fighterIndex, 1060, 750, -1);
                p2.setPose('idle');
            }

            // Hide HUD
            if (this.matchHUD) this.matchHUD.setVisible(false);

            // Fade back in to reveal the cutscene
            this.cameras.main.fadeIn(1000, 0, 0, 0);

            if (opponent && opponent.dialogueAfterWin.length > 0) {
                const playerChar = this.playerData[0]?.character || 'fok';
                this.launchDialogueWithCallback(
                    opponent.dialogueAfterWin,
                    playerChar,
                    opponent.character,
                    () => {
                        // After defeat cutscene → transition to next opponent
                        this.campaignTransitionToNextOpponent();
                    }
                );
            } else {
                // No defeat dialogue, go straight to transition
                this.campaignTransitionToNextOpponent();
            }
        });
    }

    /**
     * Transition to next campaign opponent with a fade effect.
     */
    private campaignTransitionToNextOpponent(): void {
        // Fade camera to black (longer transition for dramatic effect)
        this.cameras.main.fadeOut(2000, 0, 0, 0);

        this.cameras.main.once('camerafadeoutcomplete', () => {
            const nextOpponent = CampaignManager.getInstance().getCurrentOpponent();

            if (nextOpponent) {
                // Next opponent exists — go to map scene positioned on the island just beaten
                // getCurrentLevel() has already been incremented by advanceLadder(), so -1 gives
                // the last defeated opponent's island (player then steps right to the new one).
                const justBeatenIndex = CampaignManager.getInstance().getCurrentLevel() - 1;
                this.scene.start('CampaignMapScene', {
                    playerData: [this.playerData[0]],
                    mode: 'campaign',
                    slotIndex: CampaignManager.getInstance().getActiveSlotIndex(),
                    targetIslandIndex: Math.max(0, justBeatenIndex)
                });
            } else {
                // Campaign complete! Show credits — save file is kept.
                this.scene.start('CreditsScene');
            }
        });
    }

    /**
     * Launch dialogue with a custom completion callback (used by mid-fight and defeat cutscenes).
     */
    private launchDialogueWithCallback(
        dialogue: { speaker: string; text: string; side: 'left' | 'right' }[],
        leftChar: string,
        rightChar: string,
        onComplete: () => void
    ): void {
        const diagData = {
            dialogueData: dialogue,
            leftCharacter: leftChar,
            rightCharacter: rightChar
        };

        // Stop any stale DialogueScene first
        if (this.scene.isActive('DialogueScene')) {
            this.scene.stop('DialogueScene');
        }

        const diagScene = this.scene.get('DialogueScene');

        // Bind BEFORE launch to catch events emitted during create()
        diagScene.events.on('dialogue_animation', (side: 'left' | 'right', animation: string) => {
            const targetPlayerId = side === 'left' ? 0 : 1;
            this.players.find(p => p.playerId === targetPlayerId)?.setPose(animation);
        });

        diagScene.events.once('dialogue_complete', () => {
            diagScene.events.off('dialogue_animation');
            onComplete();
        });

        this.scene.launch('DialogueScene', diagData);
    }

    // --- Gamepad Helper Methods (Raw Input for reliability) ---
    private checkGamepadPause(): boolean {
        // Pause is usually Start (9)
        const gamepads = navigator.getGamepads();
        for (const gp of gamepads) {
            if (!gp) continue;
            // Check Start (9)
            if (gp.buttons[9]?.pressed) {
                if (!this.previousStartPressed) {
                    this.previousStartPressed = true;
                    return true;
                }
            } else {
                // Reset only if THIS gamepad released it? 
                // Simple approach: if ANY gamepad holds start, we set flag. 
                // If NO gamepad holds start, we reset flag.
            }
        }

        // Reset flag if no gamepad is pressing start
        const isAnyStartPressed = Array.from(gamepads).some(gp => gp && gp.buttons[9]?.pressed);
        if (!isAnyStartPressed) {
            this.previousStartPressed = false;
        }

        return false;
    }

    private checkGamepadSelect(): boolean {
        // Debug/Select is usually Back/Select (8)
        const gamepads = navigator.getGamepads();
        for (const gp of gamepads) {
            if (!gp) continue;
            if (gp.buttons[8]?.pressed) {
                if (!this.previousSelectPressed) {
                    this.previousSelectPressed = true;
                    return true;
                }
            }
        }

        const isAnySelectPressed = Array.from(gamepads).some(gp => gp && gp.buttons[8]?.pressed);
        if (!isAnySelectPressed) {
            this.previousSelectPressed = false;
        }

        return false;
    }
}
