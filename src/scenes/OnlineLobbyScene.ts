import Phaser from 'phaser';
import { ALL_CHARACTERS } from '../config/CharacterConfig';
import { getBackButtonIndex, getConfirmButtonIndex } from '../input/JoyConMapper';
import { AudioManager } from '../managers/AudioManager';
import { NetClient } from '../network/NetClient';
import { NetEvent, type MatchStart } from '../../shared/NetProtocol';

type Phase = 'connecting' | 'waiting' | 'picking' | 'ready' | 'closed';

/**
 * Online lobby: connects to the server, waits for an opponent, and lets each
 * player pick a character. The server starts the match once both are ready.
 */
export class OnlineLobbyScene extends Phaser.Scene {
    private client!: NetClient;
    private phase: Phase = 'connecting';
    private slot = 0;
    private characterIndex = 0;
    private statusText!: Phaser.GameObjects.Text;
    private pickText!: Phaser.GameObjects.Text;
    private opponentText!: Phaser.GameObjects.Text;
    private hintText!: Phaser.GameObjects.Text;

    constructor() {
        super({ key: 'OnlineLobbyScene' });
    }

    create(): void {
        const { width, height } = this.scale;
        const style = { fontFamily: '"Pixeloid Sans"', color: '#ffffff', align: 'center' };
        this.add.rectangle(0, 0, width, height, 0x000000).setOrigin(0);
        this.add.text(width / 2, height * 0.22, 'BOTTE IN REMOTO', { ...style, fontSize: '64px' }).setOrigin(0.5);
        this.statusText = this.add.text(width / 2, height * 0.4, '', { ...style, fontSize: '32px' }).setOrigin(0.5);
        this.pickText = this.add.text(width / 2, height * 0.55, '', { ...style, fontSize: '56px' }).setOrigin(0.5);
        this.opponentText = this.add.text(width / 2, height * 0.66, '', { ...style, fontSize: '28px', color: '#aaaaaa' }).setOrigin(0.5);
        this.hintText = this.add.text(width / 2, height * 0.85, 'ESC  ESCI', { ...style, fontSize: '24px', color: '#888888' }).setOrigin(0.5);

        this.phase = 'connecting';
        this.characterIndex = Math.max(0, ALL_CHARACTERS.indexOf('fok'));
        this.setStatus('CONNESSIONE...');

        this.client = new NetClient();
        this.client.on(NetEvent.REJECTED, (data: { reason?: string }) => this.fail(`VERSIONE DIVERSA DAL SERVER\n${data?.reason ?? ''}`));
        this.client.on(NetEvent.WAITING, () => this.setStatus('IN ATTESA DI UN AVVERSARIO...'));
        this.client.on(NetEvent.MATCHED, (data: { slot: number }) => this.onMatched(data.slot));
        this.client.on(NetEvent.PICK, (data: { slot: number; character: string }) => {
            if (data.slot !== this.slot) this.opponentText.setText(`AVVERSARIO: ${data.character.toUpperCase()}`);
        });
        this.client.on(NetEvent.START, (start: MatchStart) => this.onStart(start));
        this.client.on(NetEvent.OPPONENT_LEFT, () => this.fail("L'AVVERSARIO SE N'È ANDATO"));
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

    private onMatched(slot: number): void {
        this.slot = slot;
        this.phase = 'picking';
        this.setStatus('SCEGLI IL PERSONAGGIO');
        this.hintText.setText('◄ ►  SCEGLI     INVIO  CONFERMA     ESC  ESCI');
        this.cycleCharacter(0);
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
        this.setStatus("PRONTO: IN ATTESA DELL'AVVERSARIO");
        AudioManager.getInstance().playSFX('ui_confirm', { volume: 0.5 });

        // The server picks the input delay from both pings, so wait for a measurement
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
        this.scene.start('GameScene', { mode: 'online', online: { client: this.client, slot: this.slot, start } });
    }

    private fail(message: string): void {
        if (this.phase === 'closed') return;
        this.phase = 'closed';
        this.client.close();
        this.setStatus(message);
        this.pickText.setText('');
        this.opponentText.setText('');
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
