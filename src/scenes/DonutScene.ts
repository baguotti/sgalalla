import Phaser from 'phaser';
import { getConfirmButtonIndex } from '../input/JoyConMapper';
import { DonutRenderer, carHeading, iso } from '../minigames/donut/DonutRenderer';
import {
    DONUT, carPosition, createDonut, stepDonut,
    type DonutEvent, type DonutInput, type DonutState,
} from '../minigames/donut/DonutSim';
import { FixedStepClock } from '../../shared/FixedStepClock';

/**
 * DERAPATE (main menu), a prototype: a car doing donuts in the middle of a
 * junction, seen from a fixed isometric camera, all in plain blocks. The
 * throttle (Up / W / J / Space, gamepad RT or A) widens and speeds up the
 * donut, letting go tightens it, the brake (Down / S / K, LT or X) tightens it
 * hard; left and right (A / D, the stick) keep the drift balanced. People
 * crossing: red ones cost points and speed, green ones give a boost.
 * R starts again, ESC goes back to the menu. No sound yet.
 */

const STICK_DEAD_ZONE = 0.15;
const FONT = '"Pixeloid Sans"';

export class DonutScene extends Phaser.Scene {
    private state!: DonutState;
    private view!: DonutRenderer;
    private readonly clock = new FixedStepClock();
    private readonly stepEvents: DonutEvent[] = [];
    private previous = { angle: 0, radius: 0 };
    private keys!: Record<string, Phaser.Input.Keyboard.Key>;

    private scoreText!: Phaser.GameObjects.Text;
    private comboText!: Phaser.GameObjects.Text;
    private speedText!: Phaser.GameObjects.Text;
    private balance!: Phaser.GameObjects.Graphics;
    private spinText!: Phaser.GameObjects.Text;

    constructor() {
        super({ key: 'DonutScene' });
    }

    create(): void {
        this.state = createDonut(Math.floor(Math.random() * 1e9));
        this.previous = { angle: this.state.angle, radius: this.state.radius };
        this.cameras.main.setBackgroundColor('#b8b1a4');
        this.view = new DonutRenderer(this);

        const style = { fontFamily: FONT, color: '#ffffff', stroke: '#000000', strokeThickness: 6 };
        const { width, height } = this.scale;
        this.add.text(40, 30, 'DERAPATE', { ...style, fontSize: '40px', color: '#ffdd66' });
        this.scoreText = this.add.text(width - 40, 30, '', { ...style, fontSize: '44px' }).setOrigin(1, 0);
        this.comboText = this.add.text(width - 40, 84, '', { ...style, fontSize: '28px', color: '#8ab4f8' }).setOrigin(1, 0);
        this.speedText = this.add.text(40, 84, '', { ...style, fontSize: '28px' });
        this.spinText = this.add.text(width / 2, height * 0.3, '', { ...style, fontSize: '64px', color: '#ff5a4a' }).setOrigin(0.5);
        this.balance = this.add.graphics();
        this.add.text(width / 2, height - 22,
            'ACCELERA: ↑ / W / J / SPAZIO     FRENA: ↓ / S / K     BILANCIA: ← →     R: RICOMINCIA     ESC: MENU',
            { ...style, fontSize: '18px', color: '#e8e2cf', strokeThickness: 4 }).setOrigin(0.5, 1);

        const K = Phaser.Input.Keyboard.KeyCodes;
        const keyboard = this.input.keyboard!;
        this.keys = Object.fromEntries(Object.entries({
            up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT, w: K.W, a: K.A, s: K.S, d: K.D,
            j: K.J, k: K.K, space: K.SPACE, r: K.R, esc: K.ESC,
        }).map(([name, code]) => [name, keyboard.addKey(code)]));
        this.stepEvents.length = 0;
        this.sys.events.once('shutdown', () => {
            this.view.destroy();
            this.input.keyboard?.removeAllKeys();
        });
    }

    update(_time: number, delta: number): void {
        if (Phaser.Input.Keyboard.JustDown(this.keys.esc)) {
            this.scene.start('MainMenuScene');
            return;
        }
        if (Phaser.Input.Keyboard.JustDown(this.keys.r)) {
            this.scene.restart();
            return;
        }

        const input = this.readInput();
        const steps = this.clock.advance(delta);
        for (let i = 0; i < steps; i++) {
            this.previous = { angle: this.state.angle, radius: this.state.radius };
            this.stepEvents.length = 0;
            stepDonut(this.state, input, this.stepEvents);
            for (const event of this.stepEvents) this.onEvent(event);
            const car = carPosition(this.state);
            if (this.state.spinning === 0) this.view.addMark(car.x, car.y);
        }
        this.drawFrame();
        this.updateHud();
    }

    private readInput(): DonutInput {
        const k = this.keys;
        let throttle = k.up.isDown || k.w.isDown || k.j.isDown || k.space.isDown ? 1 : 0;
        let brake = k.down.isDown || k.s.isDown || k.k.isDown ? 1 : 0;
        let steer = (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0);
        for (const pad of navigator.getGamepads()) {
            if (!pad) continue;
            throttle = Math.max(throttle, pad.buttons[7]?.value ?? 0, pad.buttons[getConfirmButtonIndex(pad)]?.pressed ? 1 : 0);
            brake = Math.max(brake, pad.buttons[6]?.value ?? 0, pad.buttons[2]?.pressed ? 1 : 0);
            const stick = pad.axes[0] ?? 0;
            if (Math.abs(stick) > STICK_DEAD_ZONE) steer = Math.sign(stick) * (Math.abs(stick) - STICK_DEAD_ZONE) / (1 - STICK_DEAD_ZONE);
            if (pad.buttons[14]?.pressed) steer = -1;
            if (pad.buttons[15]?.pressed) steer = 1;
        }
        return { throttle, brake, steer };
    }

    private onEvent(event: DonutEvent): void {
        if (event.type === 'spin') {
            this.spinText.setText(`TESTACODA!  -${DONUT.SPIN_PENALTY}`).setAlpha(1);
            this.tweens.add({ targets: this.spinText, alpha: 0, delay: 900, duration: 500 });
        } else if (event.type === 'hit') {
            const at = iso(event.x, event.y, 2.2);
            const good = event.points > 0;
            const label = this.add.text(at.x, at.y, `${good ? '+' : ''}${event.points}`, {
                fontFamily: FONT, fontSize: '36px', color: good ? '#6dff9e' : '#ff5a4a', stroke: '#000000', strokeThickness: 6,
            }).setOrigin(0.5);
            this.tweens.add({ targets: label, y: at.y - 70, alpha: 0, duration: 900, onComplete: () => label.destroy() });
        }
    }

    /** The car part of the way between its last two steps, so it moves smoothly on fast screens. */
    private drawFrame(): void {
        const share = this.clock.stepShare;
        const s = this.state;
        let delta = s.angle - this.previous.angle;
        if (delta < -Math.PI) delta += Math.PI * 2;
        const angle = this.previous.angle + delta * share;
        const radius = this.previous.radius + (s.radius - this.previous.radius) * share;
        this.view.draw({ state: s, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, radius, heading: carHeading(s, angle) });
    }

    private updateHud(): void {
        const s = this.state;
        this.scoreText.setText(`PUNTI  ${Math.floor(s.score).toLocaleString('it-IT')}`);
        this.comboText.setText(s.combo > 1 ? `COMBO  x${s.combo.toFixed(2)}` : '');
        this.speedText.setText(`${Math.round(s.speed * 3.6)} KM/H   RAGGIO ${s.radius.toFixed(1)} M`);

        // Balance: a bar with the clean band in the middle and the needle where the drift is
        const { width, height } = this.scale;
        const barWidth = 640;
        const x = width / 2 - barWidth / 2;
        const y = height - 90;
        const g = this.balance.clear();
        g.fillStyle(0x000000, 0.55).fillRect(x - 6, y - 6, barWidth + 12, 36);
        g.fillStyle(0x7a2020).fillRect(x, y, barWidth, 24);
        g.fillStyle(0xb58a2a).fillRect(x + barWidth * 0.1, y, barWidth * 0.8, 24);
        const clean = DONUT.CLEAN;
        g.fillStyle(0x3f9a4f).fillRect(x + barWidth * (0.5 - clean / 2), y, barWidth * clean, 24);
        const needle = x + barWidth * (0.5 + Math.max(-1, Math.min(1, s.slip)) / 2);
        // Red while spinning, and flashing red past the edge: correct now or spin out
        const warning = s.overEdge > 0 && Math.floor(s.steps / 4) % 2 === 0;
        g.fillStyle(s.spinning > 0 || warning ? 0xff5a4a : 0xffffff).fillRect(needle - 4, y - 8, 8, 40);
    }
}
