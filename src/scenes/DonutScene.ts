import Phaser from 'phaser';
import { getConfirmButtonIndex } from '../input/JoyConMapper';
import { DonutLab, loadDonutTuning } from '../minigames/donut/DonutLab';
import { LOOK } from '../minigames/donut/DonutLook';
import { DonutRenderer, carHeading, iso } from '../minigames/donut/DonutRenderer';
import {
    DONUT, carPosition, inSweetSpot, createDonut, stepDonut,
    type DonutEvent, type DonutInput, type DonutState,
} from '../minigames/donut/DonutSim';
import { FixedStepClock } from '../../shared/FixedStepClock';

/**
 * DERAPATE (main menu), a prototype: a car doing donuts in the middle of a
 * junction, seen from a fixed isometric camera, all in plain blocks. The
 * throttle (Up / W / J / Space, gamepad RT or A) widens and speeds up the
 * donut, letting go tightens it, the brake (Down / S / K, LT or X) tightens it
 * hard; left and right (A / D, the stick) keep the drift balanced. People
 * crossing: red ones cost points and speed, green ones give a boost (each
 * with its own camera shake). R starts again, ESC goes back to the menu, L
 * opens the DERAPATE Lab (every setting live). No sound yet. The HUD has its
 * own camera, so shakes and zooms move only the junction.
 */

const STICK_DEAD_ZONE = 0.15;
const FONT = '"Pixeloid Sans"';
const LAB_OPEN_KEY = 'sgalalla.donutLabOpen';

export class DonutScene extends Phaser.Scene {
    private state!: DonutState;
    private view!: DonutRenderer;
    private readonly clock = new FixedStepClock();
    private readonly stepEvents: DonutEvent[] = [];
    private previous = { angle: 0, radius: 0, slip: 0 };
    /** The throttle key last frame: a fresh stab at speed can shake the camera (LOOK.STAB_SHAKE). */
    private throttleWas = 0;
    private keys!: Record<string, Phaser.Input.Keyboard.Key>;
    /** The HUD's camera: it doesn't shake or zoom. */
    private uiCamera!: Phaser.Cameras.Scene2D.Camera;
    private zoomPunch: Phaser.Tweens.Tween | null = null;
    private lab: DonutLab | null = null;
    /** The Lab's game speed and freeze, and the steps asked for while frozen. */
    private readonly labTime = { scale: 1, frozen: false, steps: 0 };
    private readonly stats = { spins: 0, walkers: 0, boosters: 0 };

    private scoreText!: Phaser.GameObjects.Text;
    private comboText!: Phaser.GameObjects.Text;
    private speedText!: Phaser.GameObjects.Text;
    private balance!: Phaser.GameObjects.Graphics;
    private revLabel!: Phaser.GameObjects.Text;
    private spinText!: Phaser.GameObjects.Text;

    constructor() {
        super({ key: 'DonutScene' });
    }

    create(): void {
        // The Lab's saved changes, on this browser
        loadDonutTuning();
        this.cameras.main.setBackgroundColor('#b8b1a4').setZoom(1);
        this.view = new DonutRenderer(this);
        this.labTime.scale = 1;
        this.labTime.frozen = false;
        this.newRun();
        const world = this.children.list.slice();

        const style = { fontFamily: FONT, color: '#ffffff', stroke: '#000000', strokeThickness: 6 };
        const { width, height } = this.scale;
        this.add.text(40, 30, 'DERAPATE', { ...style, fontSize: '40px', color: '#ffdd66' });
        this.scoreText = this.add.text(width - 40, 30, '', { ...style, fontSize: '44px' }).setOrigin(1, 0);
        this.comboText = this.add.text(width - 40, 84, '', { ...style, fontSize: '28px', color: '#8ab4f8' }).setOrigin(1, 0);
        this.speedText = this.add.text(40, 84, '', { ...style, fontSize: '28px' });
        this.spinText = this.add.text(width / 2, height * 0.3, '', { ...style, fontSize: '64px', color: '#ff5a4a' }).setOrigin(0.5);
        this.balance = this.add.graphics();
        this.revLabel = this.add.text(0, 0, 'GIRI', { ...style, fontSize: '22px', strokeThickness: 5 }).setOrigin(1, 0.5);
        this.throttleWas = 0;
        this.add.text(width / 2, height - 22,
            'ACCELERA: ↑ / W / J / SPAZIO     FRENA: ↓ / S / K     BILANCIA: ← →     R: RICOMINCIA     L: LAB     ESC: MENU',
            { ...style, fontSize: '18px', color: '#e8e2cf', strokeThickness: 4 }).setOrigin(0.5, 1);

        // Everything made after the junction is the HUD, on its own camera
        const hud = this.children.list.filter(object => !world.includes(object));
        this.uiCamera = this.cameras.add(0, 0, width, height);
        this.uiCamera.ignore(world);
        this.cameras.main.ignore(hud);

        const K = Phaser.Input.Keyboard.KeyCodes;
        const keyboard = this.input.keyboard!;
        this.keys = Object.fromEntries(Object.entries({
            up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT, w: K.W, a: K.A, s: K.S, d: K.D,
            j: K.J, k: K.K, space: K.SPACE, r: K.R, esc: K.ESC, l: K.L, f: K.F, n: K.N, h: K.H,
        }).map(([name, code]) => [name, keyboard.addKey(code)]));
        this.stepEvents.length = 0;
        if (loadFlag(LAB_OPEN_KEY)) this.openLab();
        this.sys.events.once('shutdown', () => {
            this.lab?.destroy();
            this.lab = null;
            this.zoomPunch = null;
            this.view.destroy();
            this.input.keyboard?.removeAllKeys();
        });
    }

    /** A fresh start: new car, no rubber, counts back to zero (the Lab stays open). */
    private newRun(): void {
        this.state = createDonut(Math.floor(Math.random() * 1e9));
        this.previous = { angle: this.state.angle, radius: this.state.radius, slip: this.state.slip };
        this.view.clearMarks();
        this.throttleWas = 0;
        this.stats.spins = this.stats.walkers = this.stats.boosters = 0;
    }

    private openLab(): void {
        const scene = this;
        this.lab = new DonutLab(this, {
            get state() { return scene.state; },
            stats: this.stats,
            restart: () => this.newRun(),
            setTime: (scale, frozen) => this.setLabTime(scale, frozen),
            stepFrame: () => { this.labTime.steps++; },
            redrawGround: () => this.view.redrawGround(),
            shake: kind => this.shake(kind),
        });
        saveFlag(LAB_OPEN_KEY, true);
    }

    private closeLab(): void {
        this.lab?.destroy();
        this.lab = null;
        saveFlag(LAB_OPEN_KEY, false);
    }

    /** The Lab's game speed and freeze: the game, its tweens and timers all follow. */
    private setLabTime(scale: number, frozen: boolean): void {
        this.labTime.scale = scale;
        this.labTime.frozen = frozen;
        this.labTime.steps = 0;
        const rate = frozen ? 0 : scale;
        this.tweens.timeScale = rate;
        this.time.timeScale = rate;
    }

    /** Two kinds of shake: a hard jolt for a red walker, a lighter rumble with a zoom punch for a green boost. */
    private shake(kind: 'hit' | 'boost'): void {
        const camera = this.cameras.main;
        if (kind === 'hit') {
            if (LOOK.HIT_SHAKE > 0) camera.shake(LOOK.HIT_SHAKE_MS, LOOK.HIT_SHAKE, true);
            return;
        }
        if (LOOK.BOOST_SHAKE > 0) camera.shake(LOOK.BOOST_SHAKE_MS, LOOK.BOOST_SHAKE, true);
        if (LOOK.BOOST_ZOOM > 0 && LOOK.BOOST_ZOOM_MS > 0) {
            this.zoomPunch?.stop();
            camera.setZoom(1);
            this.zoomPunch = this.tweens.add({
                targets: camera, zoom: 1 + LOOK.BOOST_ZOOM, duration: LOOK.BOOST_ZOOM_MS / 2, ease: 'Quad.easeOut', yoyo: true,
                onComplete: () => camera.setZoom(1),
            });
        }
    }

    update(_time: number, delta: number): void {
        if (Phaser.Input.Keyboard.JustDown(this.keys.esc)) {
            this.scene.start('MainMenuScene');
            return;
        }
        if (Phaser.Input.Keyboard.JustDown(this.keys.r)) {
            this.newRun();
            this.spinText.setAlpha(0);
        }
        if (Phaser.Input.Keyboard.JustDown(this.keys.l)) {
            if (this.lab) this.closeLab();
            else this.openLab();
        }
        if (this.lab) {
            if (Phaser.Input.Keyboard.JustDown(this.keys.f)) this.lab.toggleFreeze();
            if (Phaser.Input.Keyboard.JustDown(this.keys.n)) this.lab.nextFrame();
            if (Phaser.Input.Keyboard.JustDown(this.keys.h)) this.lab.toggleShown();
        }

        const input = this.readInput();
        const share = this.state.speed / DONUT.SPEED_MAX;
        if (LOOK.STAB_SHAKE > 0 && input.throttle > 0.5 && this.throttleWas <= 0.5 && this.state.spinning === 0 && share > LOOK.STAB_FROM) {
            this.cameras.main.shake(140, LOOK.STAB_SHAKE);
        }
        this.throttleWas = input.throttle;
        let steps: number;
        if (this.labTime.frozen) {
            steps = this.labTime.steps;
            this.labTime.steps = 0;
        } else {
            steps = this.clock.advance(delta * this.labTime.scale);
        }
        for (let i = 0; i < steps; i++) {
            this.previous = { angle: this.state.angle, radius: this.state.radius, slip: this.state.slip };
            this.stepEvents.length = 0;
            stepDonut(this.state, input, this.stepEvents);
            for (const event of this.stepEvents) this.onEvent(event);
            const car = carPosition(this.state);
            // Wheelspin lays darker rubber
            if (this.state.spinning === 0) this.view.addMark(car.x, car.y, 0.35 + 0.65 * this.state.revs);
        }
        this.drawFrame();
        this.updateHud();
        this.lab?.update();
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
            this.stats.spins++;
            this.spinText.setText(`TESTACODA!  -${DONUT.SPIN_PENALTY}`).setAlpha(1);
            this.tweens.add({ targets: this.spinText, alpha: 0, delay: 900, duration: 500 });
        } else if (event.type === 'hit') {
            const at = iso(event.x, event.y, 2.2);
            const good = event.points > 0;
            if (good) this.stats.boosters++;
            else this.stats.walkers++;
            this.shake(good ? 'boost' : 'hit');
            const label = this.add.text(at.x, at.y, `${good ? '+' : ''}${event.points}`, {
                fontFamily: FONT, fontSize: '36px', color: good ? '#6dff9e' : '#ff5a4a', stroke: '#000000', strokeThickness: 6,
            }).setOrigin(0.5);
            this.uiCamera.ignore(label);
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
        const slip = this.previous.slip + (s.slip - this.previous.slip) * share;
        const x = DONUT.CENTRE_X + Math.cos(angle) * radius;
        const y = DONUT.CENTRE_Y + Math.sin(angle) * radius;
        this.view.draw({ state: s, x, y, radius, heading: carHeading(s, angle, slip) });
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

        // Revs: a bar above, grey up to the sweet spot, green in it (points x2), red past the red line
        const ry = y - 54;
        const at = (revs: number) => x + barWidth * revs;
        g.fillStyle(0x000000, 0.55).fillRect(x - 6, ry - 6, barWidth + 12, 28);
        g.fillStyle(0x4a4a50).fillRect(x, ry, barWidth, 16);
        g.fillStyle(0x2f6b3a).fillRect(at(DONUT.SWEET_LOW), ry, at(DONUT.REV_RED) - at(DONUT.SWEET_LOW), 16);
        g.fillStyle(0x7a2020).fillRect(at(DONUT.REV_RED), ry, at(1) - at(DONUT.REV_RED), 16);
        const sweet = inSweetSpot(s);
        const limiter = s.revs > DONUT.REV_RED && Math.floor(s.steps / 3) % 2 === 0;
        g.fillStyle(limiter ? 0xff5a4a : sweet ? 0x6dff9e : 0xe8e2cf).fillRect(x, ry + 4, barWidth * s.revs, 8);
        this.revLabel.setPosition(x - 16, ry + 8).setColor(sweet ? '#6dff9e' : s.revs > DONUT.REV_RED ? '#ff5a4a' : '#e8e2cf')
            .setText(sweet ? 'GIRI  x2' : 'GIRI');
    }
}

function loadFlag(key: string): boolean {
    try {
        return localStorage.getItem(key) === 'true';
    } catch {
        return false;
    }
}

function saveFlag(key: string, value: boolean): void {
    try {
        localStorage.setItem(key, String(value));
    } catch {
        // Browser storage unavailable
    }
}
