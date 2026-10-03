import Phaser from 'phaser';
import { getConfirmButtonIndex } from '../input/JoyConMapper';
import { DonutLab, loadDonutTuning } from '../minigames/donut/DonutLab';
import { LOOK } from '../minigames/donut/DonutLook';
import { CAR_SHEET, DonutRenderer, carHeading, iso, type CarSheetInfo } from '../minigames/donut/DonutRenderer';
import { DonutTouch } from '../minigames/donut/DonutTouch';
import { DonutAudio, preloadDonutSounds } from '../minigames/donut/DonutAudio';
import { AudioManager } from '../managers/AudioManager';
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
/** DERAPATE's song, loaded once the scene is up. */
const SOUNDTRACK = { key: 'derapate_soundtrack', path: 'assets/audio/music/derapate_zutomayo_001.mp3' };
/** The car sheet's frame size (scripts/donut-car-sprites.py prints it; the loader needs it before the JSON is read). */
const CAR_FRAME = { width: 320, height: 230 };
/** The steering wheel (Riccardo's art), and the rim's centre (the turning point) as a share of the image. */
const WHEEL = { key: 'donut_wheel', path: 'assets/donut/wheel.webp', originX: 507.5 / 1024, originY: 497.5 / 1024 };
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
    private audio: DonutAudio | null = null;
    private soundtrack: Phaser.Sound.BaseSound | null = null;
    /** The steering last read (for the tyres' screech). */
    private lastSteer = 0;
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
    private wheel!: Phaser.GameObjects.Image;
    /** The wheel's drawn turn (radians, eased). */
    private wheelAngle = 0;
    private steerLabel!: Phaser.GameObjects.Text;
    private spinText!: Phaser.GameObjects.Text;

    constructor() {
        super({ key: 'DonutScene' });
    }

    preload(): void {
        this.load.image(WHEEL.key, WHEEL.path);
        preloadDonutSounds(this);
        this.load.spritesheet(CAR_SHEET.body, CAR_SHEET.bodyPath, { frameWidth: CAR_FRAME.width, frameHeight: CAR_FRAME.height });
        this.load.spritesheet(CAR_SHEET.wheels, CAR_SHEET.wheelsPath, { frameWidth: CAR_FRAME.width, frameHeight: CAR_FRAME.height });
        this.load.json(CAR_SHEET.json, CAR_SHEET.jsonPath);
    }

    create(): void {
        // The Lab's saved changes, on this browser
        loadDonutTuning();
        this.cameras.main.setBackgroundColor('#b8b1a4').setZoom(1);
        this.view = new DonutRenderer(this, this.cache.json.get(CAR_SHEET.json) as CarSheetInfo ?? null);
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
        // The steering wheel at the bottom: only its top shows, turning with the steering
        this.wheel = this.add.image(0, 0, WHEEL.key).setOrigin(WHEEL.originX, WHEEL.originY);
        this.wheelAngle = 0;
        this.balance = this.add.graphics();
        this.revLabel = this.add.text(0, 0, 'GIRI', { ...style, fontSize: '22px', strokeThickness: 5 }).setOrigin(0.5, 1);
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
        // The engine and the tyres, and DERAPATE's own song instead of the game's music
        this.audio = new DonutAudio(this);
        this.startSoundtrack();
        if (loadFlag(LAB_OPEN_KEY)) this.openLab();
        this.sys.events.once('shutdown', () => {
            this.touch?.destroy();
            this.touch = null;
            this.lab?.destroy();
            this.lab = null;
            this.zoomPunch = null;
            this.view.destroy();
            this.audio?.destroy();
            this.audio = null;
            // The song off, the game's music back
            this.soundtrack?.stop();
            this.soundtrack?.destroy();
            this.soundtrack = null;
            const music = this.sound.get('global_music_loop') as Phaser.Sound.WebAudioSound | null;
            if (music) {
                music.setVolume(AudioManager.getInstance().getMusicVolume());
                if (music.isPaused) music.resume();
                else if (!music.isPlaying) music.play({ loop: true });
            }
            this.input.keyboard?.removeAllKeys();
        });
    }

    /**
     * DERAPATE's song (Zutomayo_001): the game's music fades out and pauses, the
     * song loads in the background (so the game starts at once) and loops at
     * the Settings' music volume times LOOK.MUSIC_VOLUME.
     */
    private startSoundtrack(): void {
        const music = this.sound.get('global_music_loop');
        if (music?.isPlaying) this.tweens.add({ targets: music, volume: 0, duration: 600, onComplete: () => music.pause() });
        const play = () => {
            if (!this.sys.isActive() || this.soundtrack) return;
            this.soundtrack = this.sound.add(SOUNDTRACK.key, { loop: true, volume: 0 });
            this.soundtrack.play();
            this.tweens.add({ targets: this.soundtrack, volume: this.soundtrackVolume(), duration: 1200 });
        };
        if (this.cache.audio.exists(SOUNDTRACK.key)) {
            play();
            return;
        }
        this.load.audio(SOUNDTRACK.key, SOUNDTRACK.path);
        this.load.once(`filecomplete-audio-${SOUNDTRACK.key}`, play);
        this.load.start();
    }

    private soundtrackVolume(): number {
        return AudioManager.getInstance().getMusicVolume() * LOOK.MUSIC_VOLUME;
    }

    /** A fresh start: new car, no rubber, counts back to zero (the Lab stays open). */
    private newRun(): void {
        this.audio?.reset();
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
        this.lastSteer = input.steer ?? 0;
        const share = this.state.speed / DONUT.SPEED_MAX;
        if (LOOK.STAB_SHAKE > 0 && input.throttle > 0.5 && this.throttleWas <= 0.5 && this.state.spinning === 0 && share > LOOK.STAB_FROM) {
            this.cameras.main.shake(140, LOOK.STAB_SHAKE);
        }
        // Lifting off at high revs: the exhaust backfires
        if (input.throttle === 0 && this.throttleWas > 0 && this.state.revs >= LOOK.BACKFIRE_FROM && this.state.spinning === 0 && !this.state.stalled) {
            this.view.backfire(Math.min(1, this.state.revs));
            this.audio?.backfire(true);
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
            // Rubber under the rear tyres: dark with the pedal down, a trace coasting, none spinning or standing still
            const st = this.state;
            const strength = st.spinning > 0 || st.speed < 0.3 ? 0 : st.lifted === 0 ? 0.45 + 0.55 * st.revs : 0.2;
            this.view.addMarks(car.x, car.y, carHeading(st, st.angle), strength);
        }
        this.drawFrame();
        // The song follows the Lab's and Settings' volume (unless it's fading in), and keeps playing:
        // if anything stops it while the page is showing (focus, full screen…), it picks up again
        const song = this.soundtrack as Phaser.Sound.WebAudioSound | null;
        if (song && !song.isPlaying && !document.hidden && !this.sound.locked) {
            if (song.isPaused) song.resume();
            else song.play({ loop: true, volume: this.soundtrackVolume() });
        }
        if (song?.isPlaying && !this.tweens.isTweening(song)) song.setVolume(this.soundtrackVolume());
        this.audio?.update(this.state, this.labTime.frozen ? 0 : (this.game.loop.delta / 1000) * this.labTime.scale, this.lastSteer);
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
        if (event.type === 'lock') {
            this.view.backfire(1);
            this.audio?.play('green', 1, 0);
        }
        if (event.type === 'overheat' || event.type === 'spin') {
            if (event.type === 'spin') {
                this.stats.spins++;
                this.view.bump(1);
                this.audio?.play('screech_spin', 0.9, 150);
            } else {
                this.stats.overheats++;
                this.audio?.overheat();
            }
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
            if (good) {
                this.audio?.play('boost', 0.8);
            } else {
                this.audio?.play('thud', 1);
                this.time.delayedCall(140, () => this.audio?.play('horn', 0.45, 150));
            }
            this.view.bump(good ? 0.5 : 1);
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
        const dt = this.labTime.frozen ? 0 : (this.game.loop.delta / 1000) * this.labTime.scale;
        this.view.draw({ state: s, x, y, radius, heading: carHeading(s, angle), dt });
    }

    private updateHud(): void {
        const s = this.state;
        this.scoreText.setText(`PUNTI  ${Math.floor(s.score).toLocaleString('it-IT')}`);
        this.comboText.setText(s.combo > 1 ? `COMBO  x${s.combo.toFixed(2)}` : '');
        this.speedText.setText(`${Math.round(s.speed * 3.6)} KM/H   MAX ${Math.round(topSpeed(s) * 3.6)}${s.boost > 0.5 ? '  BOOST!' : ''}`);

        const { width } = this.scale;
        const g = this.balance.clear();

        // The steering wheel is the balance (what the STERZO bar showed): it turns by itself as the drift
        // pulls it, and you counter-steer to bring it back to straight (the tail out one way turns it the
        // other way: steer right when it's turned left). At full turn it's at the edge: in the green it
        // goes orange near there and flashes red at it (a moment there is a testacoda).
        const dt = Math.min(0.1, this.game.loop.delta / 1000);
        const turn = (-s.slip * LOOK.WHEEL_TURN * Math.PI) / 180;
        this.wheelAngle += (turn - this.wheelAngle) * Math.min(1, LOOK.WHEEL_EASE * dt);
        this.wheel.setPosition(LOOK.WHEEL_X, LOOK.WHEEL_Y).setScale(LOOK.WHEEL_SCALE).setRotation(this.wheelAngle);
        const atEdge = s.locked && s.overEdge > 0;
        if (atEdge && Math.floor(s.steps / 4) % 2 === 0) this.wheel.setTint(0xff4a3a);
        else if (s.locked && Math.abs(s.slip) > 0.8) this.wheel.setTint(0xffb070);
        else this.wheel.clearTint();

        // The rev bar, upright beside the wheel: the white fills from the bottom, the green on top;
        // in the green the fill is the engine's heat, green turning orange and flashing red near overheating
        const k = this.touch ? 1.3 : 1;
        const barW = LOOK.REV_BAR_WIDTH * k;
        const barH = LOOK.REV_BAR_HEIGHT;
        const x = LOOK.REV_BAR_X - barW / 2;
        const bottom = LOOK.REV_BAR_Y;
        const top = bottom - barH;
        const at = (revs: number) => bottom - barH * revs;
        const inset = Math.max(3, barW * 0.2);
        g.fillStyle(0x000000, 0.55).fillRect(x - 6, top - 6, barW + 12, barH + 12);
        g.fillStyle(0x4a4a50).fillRect(x, top, barW, barH);
        g.fillStyle(0x2f6b3a).fillRect(x, top, barW, at(DONUT.GREEN_AT) - top);
        g.fillStyle(0xe8e2cf).fillRect(x + inset, at(Math.min(s.revs, DONUT.GREEN_AT)), barW - 2 * inset, bottom - at(Math.min(s.revs, DONUT.GREEN_AT)));
        if (s.locked) {
            const hot = s.heat > 0.75 && Math.floor(s.steps / 4) % 2 === 0;
            const colour = hot ? 0xff5a4a : s.heat > 0.5 ? 0xffa040 : 0x6dff9e;
            g.fillStyle(colour).fillRect(x + inset, at(s.revs), barW - 2 * inset, at(DONUT.GREEN_AT) - at(s.revs));
            g.lineStyle(3, colour).strokeRect(x - 2, top - 2, barW + 4, at(DONUT.GREEN_AT) - top + 4);
        }
        const label = s.stalled ? 'MOTORE FUSO' : s.spinning > 0 ? 'TESTACODA' : s.locked ? (s.heat > 0.75 ? 'MOTORE CALDO!' : 'IN VERDE  x2') : 'GIRI';
        const labelColour = s.stalled || s.spinning > 0 || (s.locked && s.heat > 0.75) ? '#ff5a4a' : s.locked ? '#6dff9e' : '#e8e2cf';
        this.revLabel.setPosition(LOOK.REV_BAR_X, top - 14).setColor(labelColour).setText(label);
        const y = this.scale.height - 92;

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
