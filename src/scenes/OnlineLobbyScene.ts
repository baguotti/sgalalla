import Phaser from 'phaser';
import { ALL_CHARACTERS } from '../config/CharacterConfig';
import { getBackButtonIndex, getConfirmButtonIndex } from '../input/JoyConMapper';
import { AudioManager } from '../managers/AudioManager';
import { NetClient } from '../network/NetClient';
import { MAX_PLAYERS, MIN_PLAYERS, NetEvent, type MatchStart, type RoomState } from '../../shared/NetProtocol';

type Phase = 'connecting' | 'picking' | 'ready' | 'closed';

/**
 * Online lobby: connects to the server, which puts the player in a room of up
 * to 4. Everyone picks a character and gets ready; the match starts once all
 * the players in the room (at least 2) are ready.
 */
export class OnlineLobbyScene extends Phaser.Scene {
    private client!: NetClient;
    private phase: Phase = 'connecting';
    private room: RoomState | null = null;
    private characterIndex = 0;
    private statusText!: Phaser.GameObjects.Text;
    private pickText!: Phaser.GameObjects.Text;
    private roomText!: Phaser.GameObjects.Text;
    private hintText!: Phaser.GameObjects.Text;

    constructor() {
        super({ key: 'OnlineLobbyScene' });
    }

    create(): void {
        const { width, height } = this.scale;
        const style = { fontFamily: '"Pixeloid Sans"', color: '#ffffff', align: 'center' };
        this.add.rectangle(0, 0, width, height, 0x000000).setOrigin(0);
        this.add.text(width / 2, height * 0.16, 'BOTTE IN REMOTO', { ...style, fontSize: '64px' }).setOrigin(0.5);
        this.statusText = this.add.text(width / 2, height * 0.3, '', { ...style, fontSize: '32px' }).setOrigin(0.5);
        this.pickText = this.add.text(width / 2, height * 0.42, '', { ...style, fontSize: '56px' }).setOrigin(0.5);
        this.roomText = this.add.text(width / 2, height * 0.6, '', { ...style, fontSize: '28px', color: '#aaaaaa', lineSpacing: 12 }).setOrigin(0.5, 0);
        this.hintText = this.add.text(width / 2, height * 0.9, 'ESC  ESCI', { ...style, fontSize: '24px', color: '#888888' }).setOrigin(0.5);

        this.phase = 'connecting';
        this.room = null;
        this.characterIndex = Math.max(0, ALL_CHARACTERS.indexOf('fok'));
        this.setStatus('CONNESSIONE...');

        this.client = new NetClient();
        this.client.on(NetEvent.REJECTED, (data: { reason?: string }) => this.fail(`VERSIONE DIVERSA DAL SERVER\n${data?.reason ?? ''}`));
        this.client.on(NetEvent.ROOM, (room: RoomState) => this.onRoom(room));
        this.client.on(NetEvent.START, (start: MatchStart) => this.onStart(start));
        this.client.onDisconnect(() => this.fail('CONNESSIONE PERSA'));
        this.client.connect().catch(() => this.fail('SERVER NON RAGGIUNGIBILE'));

        this.input.keyboard?.on('keydown', (event: KeyboardEvent) => this.onKey(event.code));
        this.input.gamepad?.on('down', (pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
            const raw = pad.pad;
            if (button.index === getConfirmButtonIndex(raw)) this.onKey('Enter');
            else if (button.index === getBackButtonIndex(raw)) this.onKey('Escape');
            else if (button.index === 14) this.onKey('ArrowLeft');
            else if (button.index === 15) this.onKey('ArrowRight');
        });
        this.events.once('shutdown', () => {
            this.input.keyboard?.off('keydown');
            this.input.gamepad?.off('down');
        });
    }

    private onKey(code: string): void {
        if (code === 'Escape') {
            this.leave();
            return;
        }
        if (this.phase !== 'picking') return;

        if (code === 'ArrowLeft' || code === 'KeyA') this.cycleCharacter(-1);
        else if (code === 'ArrowRight' || code === 'KeyD') this.cycleCharacter(1);
        else if (code === 'Enter' || code === 'Space' || code === 'KeyJ') this.confirm();
    }

    private onRoom(room: RoomState): void {
        if (this.phase === 'closed' || (this.room && room.version <= this.room.version)) return;
        const joined = this.room === null;
        this.room = room;
        if (joined) {
            this.phase = 'picking';
            this.hintText.setText('◄ ►  SCEGLI     INVIO  PRONTO     ESC  ESCI');
            this.cycleCharacter(0);
        }
        this.showRoom();
    }

    private showRoom(): void {
        const room = this.room;
        if (!room) return;
        this.roomText.setText(room.players.map((p, slot) => {
            const you = slot === room.you ? '  (TU)' : '';
            return `P${slot + 1}  ${p.character.toUpperCase()}  ${p.ready ? 'PRONTO' : '...'}${you}`;
        }).join('\n'));

        const count = room.players.length;
        if (this.phase === 'ready') {
            this.setStatus(count < MIN_PLAYERS ? 'PRONTO: IN ATTESA DI ALTRI GIOCATORI' : 'PRONTO: IN ATTESA DEGLI ALTRI');
        } else {
            this.setStatus(`GIOCATORI ${count}/${MAX_PLAYERS}: SI PARTE QUANDO TUTTI SONO PRONTI`);
        }
    }

    private cycleCharacter(step: number): void {
        const count = ALL_CHARACTERS.length;
        this.characterIndex = (this.characterIndex + step + count) % count;
        const character = ALL_CHARACTERS[this.characterIndex];
        this.pickText.setText(`◄  ${character.toUpperCase()}  ►`);
        this.client.send(NetEvent.PICK, { character });
        if (step !== 0) AudioManager.getInstance().playSFX('ui_menu_hover', { volume: 0.5 });
    }

    private confirm(): void {
        this.phase = 'ready';
        const character = ALL_CHARACTERS[this.characterIndex];
        this.pickText.setText(character.toUpperCase());
        this.hintText.setText('ESC  ESCI');
        this.showRoom();
        AudioManager.getInstance().playSFX('ui_confirm', { volume: 0.5 });

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

    private fail(message: string): void {
        if (this.phase === 'closed') return;
        this.phase = 'closed';
        this.client.close();
        this.setStatus(message);
        this.pickText.setText('');
        this.roomText.setText('');
        this.hintText.setText('ESC  ESCI');
    }

    private leave(): void {
        if (this.phase !== 'closed') this.client.close();
        this.phase = 'closed';
        this.scene.start('MainMenuScene');
    }

    private setStatus(text: string): void {
        this.statusText.setText(text);
    }
}
