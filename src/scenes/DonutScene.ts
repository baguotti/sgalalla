import Phaser from 'phaser';
import { getConfirmButtonIndex } from '../input/JoyConMapper';
import { DonutLab, loadDonutTuning } from '../minigames/donut/DonutLab';
import { LOOK } from '../minigames/donut/DonutLook';
import { DonutRenderer, carHeading, iso } from '../minigames/donut/DonutRenderer';
import { DonutTouch } from '../minigames/donut/DonutTouch';
import { enterFullscreenOnPhone, isPhone } from '../input/Touch';
import {
    DONUT, carPosition, createDonut, drawnRadius, stepDonut, topSpeed,
    type DonutEvent, type DonutInput, type DonutState,
} from '../minigames/donut/DonutSim';
import { FixedStepClock } from '../../shared/FixedStepClock';

/**
 * DERAPATE (main menu), a prototype: a car doing donuts in the middle of a
 * junction, seen from a fixed isometric camera, all in plain blocks. Only the
 * pedal for now (Up / W / J / Space, gamepad RT or A): held, the revs climb
 * through the white and the donut gets faster and wider; let go, the car rolls
 * to a stop. In the green the speed holds while the pedal stays down, but the
 * engine heats up: hold too long and it overheats (back to the start, a
 * testacoda on the spot). People
 * crossing: red ones cost points and speed, green ones give a boost (each
 * with its own camera shake). R starts again, ESC goes back to the menu, L
 * opens the DERAPATE Lab (every setting live). No sound yet. The HUD has its
 * own camera, so shakes and zooms move only the junction.
 */

const TRIGGER_DEAD_ZONE = 0.1;
const STICK_DEAD_ZONE = 0.15;
const FONT = '"Pixeloid Sans"';
const LAB_OPEN_KEY = 'sgalalla.donutLabOpen';
/** The STERZO bar above the rev bar: hidden for now. */
const SHOW_STEER_BAR = false;

export class DonutScene extends Phaser.Scene {
    private state!: DonutState;
    private view!: DonutRenderer;
    private readonly clock = new FixedStepClock();
    private readonly stepEvents: DonutEvent[] = [];
    private previous = { angle: 0, radius: 0 };
    /** The throttle key last frame: a fresh stab at speed can shake the camera (LOOK.STAB_SHAKE). */
    private throttleWas = 0;
    private keys!: Record<string, Phaser.Input.Keyboard.Key>;
    /** The HUD's camera: it doesn't shake or zoom. */
    private uiCamera!: Phaser.Cameras.Scene2D.Camera;
    private zoomPunch: Phaser.Tweens.Tween | null = null;
    private lab: DonutLab | null = null;
    /** The thumb controls, on a phone. */
    private touch: DonutTouch | null = null;
    /** The Lab's game speed and freeze, and the steps asked for while frozen. */
    private readonly labTime = { scale: 1, frozen: false, steps: 0 };
    private readonly stats = { spins: 0, overheats: 0, walkers: 0, boosters: 0 };

    private scoreText!: Phaser.GameObjects.Text;
    private comboText!: Phaser.GameObjects.Text;
    private speedText!: Phaser.GameObjects.Text;
    private balance!: Phaser.GameObjects.Graphics;
    private revLabel!: Phaser.GameObjects.Text;
    private steerLabel!: Phaser.GameObjects.Text;
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
        this.steerLabel = this.add.text(0, 0, 'STERZO', { ...style, fontSize: '20px', strokeThickness: 5 }).setOrigin(1, 0.5);
        this.throttleWas = 0;
        this.touch = null;
        if (isPhone(this)) {
            // A phone: thumb controls, bigger writing, full screen on the first tap
            this.touch = new DonutTouch(this, {
                restart: () => {
                    this.newRun();
                    this.spinText.setAlpha(0);
                },
                menu: () => this.scene.start('MainMenuScene'),
            });
            for (const text of [this.scoreText, this.comboText, this.speedText, this.revLabel, this.steerLabel]) text.setScale(1.5);
            this.comboText.setY(100);
            this.speedText.setY(100);
            this.input.once('pointerup', () => enterFullscreenOnPhone(this));
        } else {
            this.add.text(width / 2, height - 22,
                'ACCELERA: ↑ / W / J / SPAZIO     BILANCIA: ← →     R: RICOMINCIA     L: LAB     ESC: MENU',
                { ...style, fontSize: '18px', color: '#e8e2cf', strokeThickness: 4 }).setOrigin(0.5, 1);
        }

        // Everything made after the junction is the HUD, on its own camera
        const hud = this.children.list.filter(object => !world.includes(object));
        this.uiCamera = this.cameras.add(0, 0, width, height);
        this.uiCamera.ignore(world);
        this.cameras.main.ignore(hud);

        const K = Phaser.Input.Keyboard.KeyCodes;
        const keyboard = this.input.keyboard!;
        this.keys = Object.fromEntries(Object.entries({
            up: K.UP, left: K.LEFT, right: K.RIGHT, w: K.W, a: K.A, s: K.S, d: K.D,
            j: K.J, k: K.K, space: K.SPACE, r: K.R, esc: K.ESC, l: K.L, f: K.F, n: K.N, h: K.H,
        }).map(([name, code]) => [name, keyboard.addKey(code)]));
        this.stepEvents.length = 0;
        if (loadFlag(LAB_OPEN_KEY)) this.openLab();
        this.sys.events.once('shutdown', () => {
            this.touch?.destroy();
            this.touch = null;
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
        this.previous = { angle: this.state.angle, radius: this.state.radius };
        this.view.clearMarks();
        this.throttleWas = 0;
        this.stats.spins = this.stats.overheats = this.stats.walkers = this.stats.boosters = 0;
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
        // Lifting off at high revs: the exhaust backfires
        if (input.throttle === 0 && this.throttleWas > 0 && this.state.revs >= LOOK.BACKFIRE_FROM && this.state.spinning === 0 && !this.state.stalled) {
            this.view.backfire(Math.min(1, this.state.revs));
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
            this.previous = { angle: this.state.angle, radius: this.state.radius };
            this.stepEvents.length = 0;
            stepDonut(this.state, input, this.stepEvents);
            this.view.tick(1 / 60);
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
        let steer = (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0);
        for (const pad of navigator.getGamepads()) {
            if (!pad) continue;
            // A resting trigger can read a little above 0: below the dead zone it's off
            const trigger = pad.buttons[7]?.value ?? 0;
            throttle = Math.max(throttle, trigger > TRIGGER_DEAD_ZONE ? trigger : 0, pad.buttons[getConfirmButtonIndex(pad)]?.pressed ? 1 : 0);
            const stick = pad.axes[0] ?? 0;
            if (Math.abs(stick) > STICK_DEAD_ZONE) steer = Math.sign(stick) * (Math.abs(stick) - STICK_DEAD_ZONE) / (1 - STICK_DEAD_ZONE);
            if (pad.buttons[14]?.pressed) steer = -1;
            if (pad.buttons[15]?.pressed) steer = 1;
        }
        // Thumbs on a phone
        if (this.touch) {
            throttle = Math.max(throttle, this.touch.throttle);
            if (this.touch.steer !== 0) steer = this.touch.steer;
        }
        return { throttle, steer };
    }

    private onEvent(event: DonutEvent): void {
        if (event.type === 'lock') this.view.backfire(1);
        if (event.type === 'overheat' || event.type === 'spin') {
            if (event.type === 'spin') this.stats.spins++;
            else this.stats.overheats++;
            this.shake('hit');
            this.spinText.setText(event.type === 'overheat'
                ? `MOTORE FUSO!  -${DONUT.OVERHEAT_PENALTY}`
                : `TESTACODA!  -${DONUT.SPIN_PENALTY}`).setAlpha(1);
            this.tweens.add({ targets: this.spinText, alpha: 0, delay: 1100, duration: 500 });
        } else if (event.type === 'hit') {
            const at = iso(event.x, event.y, 2.2);
            const good = event.points > 0;
            if (good) this.stats.boosters++;
            else this.stats.walkers++;
            this.shake(good ? 'boost' : 'hit');
            const label = this.add.text(at.x, at.y, `${good ? '+' : ''}${event.points}`, {
                fontFamily: FONT, fontSize: '36px', color: good ? '#ffffff' : '#3a55c8', stroke: good ? '#000000' : '#ffffff', strokeThickness: 6,
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
        // The balance pushes the car out of its circle (or in): losing control
        const r = drawnRadius(radius, s.slip);
        const x = DONUT.CENTRE_X + Math.cos(angle) * r;
        const y = DONUT.CENTRE_Y + Math.sin(angle) * r;
        this.view.draw({ state: s, x, y, radius, heading: carHeading(s, angle) });
    }

    private updateHud(): void {
        const s = this.state;
        this.scoreText.setText(`PUNTI  ${Math.floor(s.score).toLocaleString('it-IT')}`);
        this.comboText.setText(s.combo > 1 ? `COMBO  x${s.combo.toFixed(2)}` : '');
        this.speedText.setText(`${Math.round(s.speed * 3.6)} KM/H   MAX ${Math.round(topSpeed(s) * 3.6)}${s.boost > 0.5 ? '  BOOST!' : ''}`);

        // The rev bar: the white (accelerating) and the green; in the green the fill is the engine's heat
        const { width, height } = this.scale;
        // On a phone everything is drawn bigger (the screen is small), between the thumb controls
        const k = this.touch ? 1.6 : 1;
        const barWidth = 720;
        const x = width / 2 - barWidth / 2;
        const y = height - (this.touch ? 110 : 92);
        const at = (revs: number) => x + barWidth * revs;
        const g = this.balance.clear();
        g.fillStyle(0x000000, 0.55).fillRect(x - 6, y - 6, barWidth + 12, 40 * k);
        g.fillStyle(0x4a4a50).fillRect(x, y, barWidth, 28 * k);
        g.fillStyle(0x2f6b3a).fillRect(at(DONUT.GREEN_AT), y, at(1) - at(DONUT.GREEN_AT), 28 * k);
        // White up to the green, then the heat: green, turning orange and flashing red near overheating
        g.fillStyle(0xe8e2cf).fillRect(x, y + 6 * k, at(Math.min(s.revs, DONUT.GREEN_AT)) - x, 16 * k);
        if (s.locked) {
            const hot = s.heat > 0.75 && Math.floor(s.steps / 4) % 2 === 0;
            const colour = hot ? 0xff5a4a : s.heat > 0.5 ? 0xffa040 : 0x6dff9e;
            g.fillStyle(colour).fillRect(at(DONUT.GREEN_AT), y + 6 * k, at(s.revs) - at(DONUT.GREEN_AT), 16 * k);
            g.lineStyle(3, colour).strokeRect(at(DONUT.GREEN_AT) - 2, y - 2, at(1) - at(DONUT.GREEN_AT) + 4, 28 * k + 4);
        }
        const label = s.stalled ? 'MOTORE FUSO' : s.spinning > 0 ? 'TESTACODA' : s.locked ? (s.heat > 0.75 ? 'MOTORE CALDO!' : 'IN VERDE  x2') : 'GIRI';
        const labelColour = s.stalled || s.spinning > 0 || (s.locked && s.heat > 0.75) ? '#ff5a4a' : s.locked ? '#6dff9e' : '#e8e2cf';
        this.revLabel.setPosition(x - 16, y + 14 * k).setColor(labelColour).setText(label);

        // The steering bar is hidden for now (the balance still plays; SHOW_STEER_BAR brings it back)
        this.steerLabel.setVisible(SHOW_STEER_BAR);
        if (!SHOW_STEER_BAR) return;
        // The balance (steering), above: green in the middle (clean), yellow, orange, red at the edges.
        // In the white the edges are safe and the colours are dimmed; in the green they're bright.
        const bw = 440 * (this.touch ? 1.3 : 1);
        const bh = 16 * k;
        const bx = width / 2 - bw / 2;
        const by = y - 24 - bh;
        const live = s.locked ? 1 : 0.45;
        g.fillStyle(0x000000, 0.6).fillRect(bx - 5, by - 5, bw + 10, bh + 10);
        const zones: [number, number][] = [[1, 0xd03a30], [0.8, 0xe08030], [0.6, 0xe0c040], [DONUT.CLEAN, 0x4cd86a]];
        for (const [reach, colour] of zones) {
            g.fillStyle(colour, live).fillRect(bx + bw * (0.5 - reach / 2), by, bw * reach, bh);
        }
        g.fillStyle(0xffffff, 0.5).fillRect(bx + bw / 2 - 1, by, 2, bh);
        const reach = Math.abs(s.slip);
        const zone = zones.slice().reverse().find(([r]) => reach <= r) ?? zones[0];
        const needle = bx + bw * (0.5 + s.slip / 2);
        const danger = s.overEdge > 0 && Math.floor(s.steps / 4) % 2 === 0;
        g.fillStyle(0x000000).fillRect(needle - 5, by - 8, 10, bh + 16);
        g.fillStyle(danger ? 0xff3a2e : s.locked ? zone[1] : 0xffffff).fillRect(needle - 3, by - 6, 6, bh + 12);
        this.steerLabel.setPosition(bx - 16, by + bh / 2).setColor(s.locked && reach > 0.8 ? '#ff5a4a' : '#e8e2cf');
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
