import Phaser from 'phaser';
import { ALL_CHARACTERS } from '../config/CharacterConfig';
import { MenuInput, type MenuAction } from '../input/MenuInput';
import { AudioManager } from '../managers/AudioManager';
import { NetClient } from '../network/NetClient';
import { cardPositions, PlayerCard } from '../ui/PlayerCard';
import { SMASH_COLORS } from '../ui/PlayerHUD';
import { isStageKey, loadStagePreviews, previewKey, STAGES } from '../stages/StageBackgrounds';
import { MAX_PLAYERS, MIN_PLAYERS, NetEvent, MULTIPLAYER_STAGES, type MatchStart, type RoomState, type WatchInputs, type WatchStart } from '../../shared/NetProtocol';

type Phase = 'connecting' | 'picking' | 'ready' | 'closed';

/**
 * Online lobby: connects to the server, which puts the player in a room of up
 * to 5. Everyone picks a character and gets ready; player 1 also picks the
 * stage (up and down, among MULTIPLAYER_STAGES) and bombs (Start: off by
 * default). The match starts once all the
 * players in the room (at least 2) are ready. Laid out like BOTTE IN LOCALE:
 * a card per player slot, the fighter they're picking on it, the stage below.
 */
export class OnlineLobbyScene extends Phaser.Scene {
    private client!: NetClient;
    private menuInput!: MenuInput;
    private phase: Phase = 'connecting';
    private room: RoomState | null = null;
    private characterIndex = 0;
    private statusText!: Phaser.GameObjects.Text;
    private hintText!: Phaser.GameObjects.Text;
    private cards: PlayerCard[] = [];
    private stagePreview!: Phaser.GameObjects.Image;
    private stageText!: Phaser.GameObjects.Text;

    constructor() {
        super({ key: 'OnlineLobbyScene' });
    }

    preload(): void {
        this.load.audio('ui_player_found', 'assets/audio/ui/ui_player_found.wav');
        this.load.audio('ui_change_character', 'assets/audio/ui/ui_change_character.wav');
        this.load.audio('ui_confirm_character', 'assets/audio/ui/ui_confirm_character.wav');
        this.load.audio('ui_back', 'assets/audio/ui/ui_back.wav');
        loadStagePreviews(this);
    }

    create(): void {
        const { width, height } = this.scale;
        const font = '"Pixeloid Sans"';
        this.add.rectangle(0, 0, width, height, 0x000000).setOrigin(0);

        // As BOTTE IN LOCALE: the title above the cards, the instructions pulsing at the bottom
        const centerY = height / 2 + 20;
        this.add.text(width / 2, centerY - 200, 'BOTTE IN REMOTO', { fontSize: '48px', color: '#ffffff', fontFamily: font, fontStyle: 'bold' }).setOrigin(0.5);
        this.statusText = this.add.text(width / 2, centerY - 150, '', { fontSize: '22px', color: '#aaaaaa', fontFamily: font, align: 'center' }).setOrigin(0.5, 0);
        this.hintText = this.add.text(width / 2, height - 50, '', { fontSize: '20px', color: '#8ab4f8', fontFamily: font }).setOrigin(0.5);
        this.tweens.add({ targets: this.hintText, alpha: 0.5, duration: 800, yoyo: true, repeat: -1 });
        this.cards = cardPositions(width, MAX_PLAYERS).map((x, slot) => new PlayerCard(this, x, centerY + 40, `P${slot + 1}`, SMASH_COLORS[slot % SMASH_COLORS.length]));
        // The stage, below the cards
        this.stagePreview = this.add.image(width / 2, centerY + 285, previewKey(MULTIPLAYER_STAGES[0])).setVisible(false);
        this.stageText = this.add.text(width / 2, centerY + 370, '', { fontSize: '22px', color: '#ffffff', fontFamily: font, align: 'center' }).setOrigin(0.5, 0);
        this.setHint('Esci: [ESC] o [GAMEPAD B]');

        this.phase = 'connecting';
        this.room = null;
        this.characterIndex = Math.max(0, ALL_CHARACTERS.indexOf('fok'));
        this.setStatus('CONNESSIONE AL SERVER...');
        this.showCards();

        const client = new NetClient();
        this.client = client;
        client.on(NetEvent.REJECTED, (data: { reason?: string }) => this.fail(`VERSIONE DIVERSA DAL SERVER\n${data?.reason ?? ''}`));
        client.on(NetEvent.ROOM, (room: RoomState) => this.onRoom(room));
        client.on(NetEvent.START, (start: MatchStart) => this.onStart(start));
        // A match is already on: watch it
        client.on(NetEvent.WATCH, (watch: WatchStart) => this.onWatch(watch));
        client.onDisconnect(() => this.fail('CONNESSIONE PERSA'));
        // The scene is reused: a connection given up on in an earlier visit can fail after the lobby is reopened
        client.connect().catch(() => {
            if (this.client === client) this.fail('SERVER NON RAGGIUNGIBILE');
        });

        this.menuInput = new MenuInput(this);
    }

    update(): void {
        for (const { action } of this.menuInput.poll()) {
            this.onAction(action);
            if (action === 'back') return;
        }
    }

    private onAction(action: MenuAction): void {
        if (action === 'back') {
            this.leave();
            return;
        }
        if (this.phase !== 'picking') return;

        if (action === 'left') this.cycleCharacter(-1);
        else if (action === 'right') this.cycleCharacter(1);
        else if (action === 'up') this.cycleStage(-1);
        else if (action === 'down') this.cycleStage(1);
        else if (action === 'start') this.toggleBombs();
        else if (action === 'confirm') this.confirm();
    }

    private onRoom(room: RoomState): void {
        if (this.phase === 'closed' || (this.room && room.version <= this.room.version)) return;
        const joined = this.room === null;
        const others = this.room ? this.room.players.length : 1;
        this.room = room;
        if (joined) {
            this.phase = 'picking';
            this.setPickingHint();
            this.cycleCharacter(0);
        } else if (room.players.length > others) {
            AudioManager.getInstance().playSFX('ui_player_found', { volume: 0.5 });
        }
        this.showRoom();
    }

    private showRoom(): void {
        const room = this.room;
        if (!room) return;
        this.showCards();
        this.showStage();
        // Becoming player 1 (the first one left) brings the stage choice
        if (this.phase === 'picking') this.setPickingHint();

        const count = room.players.length;
        if (this.phase === 'ready') {
            this.setStatus(count < MIN_PLAYERS ? 'PRONTO: IN ATTESA DI ALTRI GIOCATORI' : 'PRONTO: IN ATTESA DEGLI ALTRI');
        } else {
            this.setStatus(`GIOCATORI ${count}/${MAX_PLAYERS}: SI PARTE QUANDO TUTTI SONO PRONTI`);
        }
    }

    /**
     * A card per slot: ours with the fighter we're picking (arrows while choosing), the other
     * players' with what they've picked, green once ready; empty slots wait for players.
     */
    private showCards(): void {
        const room = this.room;
        this.cards.forEach((card, slot) => {
            const player = room?.players[slot];
            const ours = room !== null && slot === room.you;
            card.setLabel(ours ? `P${slot + 1} · TU` : `P${slot + 1}`);
            if (!player) {
                card.show({ kind: 'empty', text: room ? 'In attesa\ndi giocatori' : '...' });
            } else if (ours) {
                const ready = this.phase === 'ready';
                card.show({ kind: 'fighter', character: ALL_CHARACTERS[this.characterIndex], ready, choosing: this.phase === 'picking' });
            } else {
                card.show({ kind: 'fighter', character: player.character, ready: player.ready, choosing: false, text: player.ready ? undefined : 'Sceglie...', textColour: '#888888' });
            }
        });
    }

    /** What player 1 picked: the stage's preview and name (arrows for player 1 while picking), and bombs. */
    private showStage(): void {
        const settings = this.room?.settings;
        if (!settings || !isStageKey(settings.stage)) return;
        const preview = this.stagePreview.setTexture(previewKey(settings.stage)).setVisible(true);
        preview.setScale(150 / preview.height);
        const choosing = this.room!.you === 0 && this.phase === 'picking';
        const label = STAGES[settings.stage].label;
        const bombs = `Bombe: ${settings.bombs ? 'SÌ' : 'NO'}`;
        this.stageText.setText(choosing ? `▲  ${label}  ▼\n${bombs}` : `${label}\n${bombs}${this.room!.you === 0 ? '' : '  (sceglie P1)'}`);
    }

    private cycleStage(step: number): void {
        const settings = this.room?.you === 0 ? this.room.settings : null;
        if (!settings) return;
        const index = Math.max(0, MULTIPLAYER_STAGES.findIndex(s => s === settings.stage));
        const stage = MULTIPLAYER_STAGES[(index + step + MULTIPLAYER_STAGES.length) % MULTIPLAYER_STAGES.length];
        this.client.send(NetEvent.SETTINGS, { ...settings, stage });
        AudioManager.getInstance().playSFX('ui_change_character', { volume: 0.4 });
    }

    private toggleBombs(): void {
        const settings = this.room?.you === 0 ? this.room.settings : null;
        if (!settings) return;
        this.client.send(NetEvent.SETTINGS, { ...settings, bombs: !settings.bombs });
        AudioManager.getInstance().playSFX('ui_change_character', { volume: 0.4 });
    }

    private setPickingHint(): void {
        const settings = this.room?.you === 0 ? 'Mappa: [▲ ▼]  |  Bombe: [START/P]  |  ' : '';
        this.setHint(`Scegli: [◀ ▶]  |  ${settings}Pronto: [SPAZIO/INVIO] o [A]  |  Esci: [ESC]`);
    }

    private cycleCharacter(step: number): void {
        const count = ALL_CHARACTERS.length;
        this.characterIndex = (this.characterIndex + step + count) % count;
        const character = ALL_CHARACTERS[this.characterIndex];
        this.client.send(NetEvent.PICK, { character });
        this.showCards();
        if (step !== 0) AudioManager.getInstance().playSFX('ui_change_character', { volume: 0.4 });
    }

    private confirm(): void {
        this.phase = 'ready';
        const character = ALL_CHARACTERS[this.characterIndex];
        this.setHint('Esci: [ESC] o [GAMEPAD B]');
        this.showRoom();
        AudioManager.getInstance().playSFX('ui_confirm_character', { volume: 0.5 });

        // The server picks the input delay from everyone's ping, so wait for a measurement
        const sendWhenMeasured = () => {
            if (this.phase !== 'ready') return;
            if (this.client.rtt > 0) this.client.send(NetEvent.READY, { character, rtt: this.client.rtt });
            else this.time.delayedCall(100, sendWhenMeasured);
        };
        sendWhenMeasured();
    }

    private onStart(start: MatchStart): void {
        if (this.phase === 'closed') return;
        this.phase = 'closed';
        this.scene.start('GameScene', { mode: 'online', online: { client: this.client, start } });
    }

    private onWatch(watch: WatchStart): void {
        if (this.phase === 'closed') return;
        this.phase = 'closed';
        this.setStatus('UNA PARTITA È IN CORSO: LA GUARDI');
        // The inputs start coming straight away, and the server sends each batch only once: keep them for the match
        const early: WatchInputs['batches'] = [];
        this.client.on(NetEvent.WATCH_INPUTS, (message: WatchInputs) => early.push(...message.batches));
        this.time.delayedCall(700, () => this.scene.start('GameScene', { mode: 'spectate', watch: { client: this.client, watch, early } }));
    }

    private fail(message: string): void {
        if (this.phase === 'closed') return;
        this.phase = 'closed';
        this.client.close();
        this.setStatus(message);
        this.room = null;
        this.cards.forEach(card => card.show({ kind: 'empty', text: '' }));
        this.setHint('Esci: [ESC] o [GAMEPAD B]');
    }

    private leave(): void {
        AudioManager.getInstance().playSFX('ui_back', { volume: 0.5 });
        if (this.phase !== 'closed') this.client.close();
        this.phase = 'closed';
        this.scene.start('MainMenuScene');
    }

    private setStatus(text: string): void {
        this.statusText.setText(text);
    }

    private setHint(text: string): void {
        this.hintText.setText(text);
    }
}
