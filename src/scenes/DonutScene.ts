import Phaser from 'phaser';
import { getConfirmButtonIndex } from '../input/JoyConMapper';
import { enterFullscreenOnPhone, isPhone } from '../input/Touch';
import { DonutAudio, preloadDonutSounds } from '../minigames/donut/DonutAudio';
import { DonutHud, preloadHud } from '../minigames/donut/DonutHud';
import { DonutLab, donutLabWasOpen, loadDonutTuning } from '../minigames/donut/DonutLab';
import { LOOK } from '../minigames/donut/DonutLook';
import { DonutRenderer, carHeading, iso, preloadDonutCar } from '../minigames/donut/DonutRenderer';
import { DonutTouch } from '../minigames/donut/DonutTouch';
import {
    DONUT, carPosition, createDonut, drawnRadius, stepDonut,
    type DonutEvent, type DonutState,
} from '../minigames/donut/DonutSim';
import { FixedStepClock } from '../../shared/FixedStepClock';

/**
 * DERAPATE (main menu): a car doing donuts in the middle of a junction, seen
 * from a fixed isometric camera. The pedal (Up / W / J / Space, gamepad RT or
 * A, the right thumb on a phone) climbs the revs through the white, the donut
 * getting faster and wider; let go and it shrinks back towards the middle. In
 * the green the speed holds and the points double, but the engine heats up:
 * hold too long and it overheats (MOTORE FUSO: it coasts back to the middle).
 * The steering (Left/Right / A/D, the stick, the left thumb) keeps the balance,
 * shown by the steering wheel: in the green, a moment at the edge is a
 * testacoda. People crossing: white ones boost (and a streak of them raises
 * the top speed), blue ones cost points and speed. R starts again, ESC goes
 * back to the menu, L opens the DERAPATE Lab (every setting live).
 *
 * The rules are DonutSim (fixed 60 Hz steps); this scene reads the controls,
 * steps the sim and hands what happened to the drawing (DonutRenderer), the
 * sounds (DonutAudio) and the HUD (DonutHud). The HUD has its own camera, so
 * shakes and zooms move only the junction.
 */

const TRIGGER_DEAD_ZONE = 0.1;
const STICK_DEAD_ZONE = 0.15;
const STAB_SHAKE_MS = 140;
const FONT = '"Pixeloid Sans"';
const K = Phaser.Input.Keyboard.KeyCodes;
const KEYS = {
    up: K.UP, left: K.LEFT, right: K.RIGHT, w: K.W, a: K.A, d: K.D, j: K.J, space: K.SPACE,
    r: K.R, esc: K.ESC, l: K.L, f: K.F, n: K.N, h: K.H,
};

export class DonutScene extends Phaser.Scene {
    private state!: DonutState;
    private view!: DonutRenderer;
    private hud!: DonutHud;
    private audio!: DonutAudio;
    private keys!: Record<keyof typeof KEYS, Phaser.Input.Keyboard.Key>;
    /** The HUD's camera: it doesn't shake or zoom. */
    private uiCamera!: Phaser.Cameras.Scene2D.Camera;
    private readonly clock = new FixedStepClock();
    private readonly stepEvents: DonutEvent[] = [];
    /** The controls this frame (the pedal 0 to 1, the steering -1 left to 1 right). */
    private readonly controls = { throttle: 0, steer: 0 };
    /** The car's angle and radius before the last step, to draw it between steps. */
    private readonly previous = { angle: 0, radius: 0 };
    /** The pedal last frame: a fresh stab can shake the camera, lifting off can backfire. */
    private throttleWas = 0;
    private zoomPunch: Phaser.Tweens.Tween | null = null;
    private lab: DonutLab | null = null;
    /** The thumb controls, on a phone. */
    private touch: DonutTouch | null = null;
    /** The Lab's game speed and freeze, and the steps asked for while frozen. */
    private readonly labTime = { scale: 1, frozen: false, steps: 0 };
    private readonly stats = { spins: 0, overheats: 0, walkers: 0, boosters: 0 };

    constructor() {
        super({ key: 'DonutScene' });
    }

    preload(): void {
        preloadDonutCar(this);
        preloadHud(this);
        preloadDonutSounds(this);
    }

    create(): void {
        // The Lab's saved changes, on this browser
        loadDonutTuning();
        this.cameras.main.setBackgroundColor('#b8b1a4');
        this.view = new DonutRenderer(this);
        const world = this.children.list.slice();

        // Everything made after the junction is the HUD (and the thumb controls), on its own camera
        const phone = isPhone(this);
        this.hud = new DonutHud(this, phone);
        this.touch = null;
        if (phone) {
            this.touch = new DonutTouch(this, { restart: () => this.newRun(), menu: () => this.scene.start('MainMenuScene') });
            this.input.once('pointerup', () => enterFullscreenOnPhone(this));
        }
        const hud = this.children.list.filter(object => !world.includes(object));
        const { width, height } = this.scale;
        this.uiCamera = this.cameras.add(0, 0, width, height);
        this.uiCamera.ignore(world);
        this.cameras.main.ignore(hud);

        this.keys = this.input.keyboard!.addKeys(KEYS) as Record<keyof typeof KEYS, Phaser.Input.Keyboard.Key>;
        this.audio = new DonutAudio(this);
        this.setLabTime(1, false);
        this.newRun();
        if (donutLabWasOpen()) this.openLab();
        this.sys.events.once('shutdown', () => {
            this.touch?.destroy();
            this.touch = null;
            this.lab?.destroy();
            this.lab = null;
            this.zoomPunch = null;
            this.view.destroy();
            this.audio.destroy();
            this.input.keyboard?.removeAllKeys();
        });
    }

    update(_time: number, delta: number): void {
        if (this.handleKeys()) return;
        const controls = this.readControls();
        this.reactToPedal(controls.throttle);
        const steps = this.stepsDue(delta);
        for (let i = 0; i < steps; i++) this.step();
        // Seconds of game this frame: slowed by the Lab, none while frozen (the HUD's wheel eases in real time)
        const seconds = delta / 1000;
        const gameSeconds = this.labTime.frozen ? 0 : seconds * this.labTime.scale;
        this.drawFrame(gameSeconds);
        this.audio.update(this.state, gameSeconds, controls.steer);
        this.hud.update(this.state, seconds);
        this.lab?.update();
    }

    /** A fresh start: new car, no rubber, counts back to zero (the Lab stays open). */
    private newRun(): void {
        this.state = createDonut(Math.floor(Math.random() * 1e9));
        this.previous.angle = this.state.angle;
        this.previous.radius = this.state.radius;
        this.throttleWas = 0;
        this.stats.spins = this.stats.overheats = this.stats.walkers = this.stats.boosters = 0;
        this.view.reset();
        this.audio.reset();
        this.hud.reset();
    }

    /** The keys that act at once (not the driving). True when the scene is left. */
    private handleKeys(): boolean {
        const k = this.keys;
        const pressed = Phaser.Input.Keyboard.JustDown;
        if (pressed(k.esc)) {
            this.scene.start('MainMenuScene');
            return true;
        }
        if (pressed(k.r)) this.newRun();
        if (pressed(k.l)) {
            if (this.lab) this.closeLab();
            else this.openLab();
        }
        if (this.lab) {
            if (pressed(k.f)) this.lab.toggleFreeze();
            if (pressed(k.n)) this.lab.nextFrame();
            if (pressed(k.h)) this.lab.toggleShown();
        }
        return false;
    }

    /** Keys, gamepads and thumbs together: the pedal is the hardest press, the steering the last one moved. */
    private readControls(): { throttle: number; steer: number } {
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
        if (this.touch) {
            throttle = Math.max(throttle, this.touch.throttle);
            if (this.touch.steer !== 0) steer = this.touch.steer;
        }
        this.controls.throttle = throttle;
        this.controls.steer = steer;
        return this.controls;
    }

    /** A fresh stab of the pedal at speed shakes the camera a little; lifting off at high revs, the exhaust backfires. */
    private reactToPedal(throttle: number): void {
        const s = this.state;
        const pressed = throttle > 0.5 && this.throttleWas <= 0.5;
        const lifted = throttle === 0 && this.throttleWas > 0;
        this.throttleWas = throttle;
        if (s.spinning > 0) return;
        if (pressed && LOOK.STAB_SHAKE > 0 && s.speed / DONUT.SPEED_MAX > LOOK.STAB_FROM) {
            this.cameras.main.shake(STAB_SHAKE_MS, LOOK.STAB_SHAKE);
        }
        if (lifted && s.revs >= LOOK.BACKFIRE_FROM && !s.stalled) {
            this.view.backfire(Math.min(1, s.revs));
            this.audio.backfire(true);
        }
    }

    /** How many sim steps this frame: real time (scaled by the Lab), or while frozen the steps the Lab asked for. */
    private stepsDue(delta: number): number {
        if (!this.labTime.frozen) return this.clock.advance(delta * this.labTime.scale);
        const steps = this.labTime.steps;
        this.labTime.steps = 0;
        return steps;
    }

    /** One step of the game, what it set off, and the rubber it laid. */
    private step(): void {
        const s = this.state;
        this.previous.angle = s.angle;
        this.previous.radius = s.radius;
        this.stepEvents.length = 0;
        stepDonut(s, this.controls, this.stepEvents);
        for (const event of this.stepEvents) this.onEvent(event);
        // Rubber under the rear tyres: dark with the pedal down, a trace coasting, none spinning or standing still
        const car = carPosition(s);
        const strength = s.spinning > 0 || s.speed < 0.3 ? 0 : s.lifted === 0 ? 0.45 + 0.55 * s.revs : 0.2;
        this.view.addMarks(car.x, car.y, carHeading(s, s.angle), strength);
    }

    private onEvent(event: DonutEvent): void {
        switch (event.type) {
            case 'lock':
                this.view.backfire(1);
                this.audio.lock();
                break;
            case 'spin':
                this.stats.spins++;
                this.view.bump(1);
                this.audio.spin();
                this.shake('hit');
                this.hud.showMessage(`TESTACODA!  -${DONUT.SPIN_PENALTY}`);
                break;
            case 'overheat':
                this.stats.overheats++;
                this.audio.overheat();
                this.shake('hit');
                this.hud.showMessage(`MOTORE FUSO!  -${DONUT.OVERHEAT_PENALTY}`);
                break;
            case 'hit':
                this.onHit(event);
                break;
            case 'unlock':
                break;
        }
    }

    /**
     * Someone hit: a white one boosts (a lighter shake with a zoom punch, the
     * nitrous), a blue one costs (a jolt, a thud and a horn); the points float
     * up from where it happened.
     */
    private onHit(event: Extract<DonutEvent, { type: 'hit' }>): void {
        const boost = event.kind === 'booster';
        if (boost) this.stats.boosters++;
        else this.stats.walkers++;
        this.shake(boost ? 'boost' : 'hit');
        this.audio.hit(boost);
        this.view.bump(boost ? 0.5 : 1);
        const at = iso(event.x, event.y, 2.2);
        const label = this.add.text(at.x, at.y, `${event.points > 0 ? '+' : ''}${event.points}`, {
            fontFamily: FONT, fontSize: '36px', strokeThickness: 6,
            color: boost ? '#ffffff' : '#3a55c8', stroke: boost ? '#000000' : '#ffffff',
        }).setOrigin(0.5);
        this.uiCamera.ignore(label);
        this.tweens.add({ targets: label, y: at.y - 70, alpha: 0, duration: 900, onComplete: () => label.destroy() });
    }

    /** Two kinds of shake: a hard jolt (a blue hit, a testacoda, an overheat), a lighter rumble with a zoom punch for a white boost. */
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

    /** The car part of the way between its last two steps, so it moves smoothly on fast screens. */
    private drawFrame(dt: number): void {
        const share = this.clock.stepShare;
        const s = this.state;
        let turned = s.angle - this.previous.angle;
        if (turned < -Math.PI) turned += Math.PI * 2;
        const angle = this.previous.angle + turned * share;
        const radius = this.previous.radius + (s.radius - this.previous.radius) * share;
        // The balance pushes the car out of its circle (or in): losing control
        const r = drawnRadius(radius, s.slip);
        const x = DONUT.CENTRE_X + Math.cos(angle) * r;
        const y = DONUT.CENTRE_Y + Math.sin(angle) * r;
        this.view.draw({ state: s, x, y, radius, heading: carHeading(s, angle), dt });
    }

    private openLab(): void {
        this.lab = new DonutLab(this, {
            state: () => this.state,
            stats: this.stats,
            restart: () => this.newRun(),
            setTime: (scale, frozen) => this.setLabTime(scale, frozen),
            stepFrame: () => { this.labTime.steps++; },
            redrawGround: () => this.view.redrawGround(),
            shake: kind => this.shake(kind),
        });
    }

    private closeLab(): void {
        this.lab?.close();
        this.lab = null;
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
}
