import Phaser from 'phaser';
import { MenuInput } from '../input/MenuInput';
import { getConfirmButtonIndex } from '../input/JoyConMapper';
import { AudioManager } from '../managers/AudioManager';
import { EngineSound } from '../minigames/racing/EngineSound';
import { CAR, createRace, stepRace, type RaceEvent, type RaceInput, type RaceState } from '../minigames/racing/RaceSim';
import { RoadRenderer, VIEW_HEIGHT, VIEW_WIDTH, type RaceView } from '../minigames/racing/RoadRenderer';
import { segmentAt } from '../minigames/racing/RaceTrack';
import { FixedStepClock } from '../../shared/FixedStepClock';

/**
 * CORSA (main menu): an Outrun-style cruise down an endless coastal highway.
 * The race runs in fixed 60 Hz steps (minigames/racing/RaceSim); the road is
 * drawn on a 480x270 canvas scaled up with hard pixels, the HUD on top at full
 * size. Up / W / J accelerates, Down / S / K brakes, Left / Right or A / D
 * steers; on a gamepad, RT or A accelerates, LT or X brakes, the stick steers.
 * ESC or Start pauses.
 */

/** Screen sizes below were set for a 480 px wide screen: this scales them to the 1920 px one. */
const PX = VIEW_WIDTH / 480;
/** Top speed as the speedometer shows it. */
const TOP_KMH = 260;
const PAUSE_OPTIONS = ['RIPRENDI', 'RICOMINCIA', 'TORNA AL MENU'] as const;
const STICK_DEAD_ZONE = 0.18;

interface Dust {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    /** Grass dust, or grey tyre smoke from a slide. */
    colour: number;
}

export class RacingScene extends Phaser.Scene {
    private race!: RaceState;
    private road!: RoadRenderer;
    private canvas!: Phaser.GameObjects.RenderTexture;
    private car!: Phaser.GameObjects.Image;
    private underCar!: Phaser.GameObjects.Graphics;
    private readonly clock = new FixedStepClock();
    private readonly raceEvents: RaceEvent[] = [];
    private engine: EngineSound | null = null;
    private menuInput!: MenuInput;
    private keys!: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'j' | 'k', Phaser.Input.Keyboard.Key>;
    private input0: RaceInput = { throttle: 0, brake: 0, steer: 0 };

    // Feel
    private crashShake = 0;
    private readonly dust: Dust[] = [];
    /** The race as it was a step ago, and how far the sky has slid: frames are drawn between the two. */
    private previous = { z: 0, x: 0, speed: 0, skyOffset: 0, traffic: [] as number[], trafficX: [] as number[] };
    private skyOffset = 0;
    private readonly view: RaceView = { track: null!, z: 0, x: 0, speed: 0, traffic: [], skyOffset: 0, slipstream: 0 };

    // HUD
    private speedText!: Phaser.GameObjects.Text;
    private speedBar!: Phaser.GameObjects.Graphics;
    private timeText!: Phaser.GameObjects.Text;
    private distanceText!: Phaser.GameObjects.Text;
    private scoreText!: Phaser.GameObjects.Text;
    private slipText!: Phaser.GameObjects.Text;
    private hint!: Phaser.GameObjects.Text;

    // Pause
    private paused = false;
    private pauseItems: Phaser.GameObjects.Text[] = [];
    private pauseLayer!: Phaser.GameObjects.Container;
    private pauseIndex = 0;

    constructor() {
        super({ key: 'RacingScene' });
    }

    preload(): void {
        this.load.image('race_car', 'assets/racing/car_temp.png');
        this.load.audio('race_bump', 'assets/audio/sfx/fight/fight_side_light_hit.wav');
        this.load.audio('race_crash', 'assets/audio/sfx/fight/fight_landing.wav');
        this.load.audio('race_whoosh', 'assets/audio/sfx/fight/fight_dash.wav');
    }

    create(): void {
        this.race = createRace(1);
        this.view.track = this.race.track;
        this.skyOffset = 0;
        this.remember();
        this.paused = false;
        this.crashShake = 0;
        this.dust.length = 0;
        this.cameras.main.setBackgroundColor('#000000');

        this.road = new RoadRenderer(this);
        this.canvas = this.add.renderTexture(0, 0, VIEW_WIDTH, VIEW_HEIGHT).setOrigin(0);
        this.car = this.make.image({ key: 'race_car', add: false }).setOrigin(0.5, 1);
        this.underCar = this.make.graphics({}, false);

        this.createHud();
        this.createPauseMenu();

        const keyboard = this.input.keyboard!;
        const K = Phaser.Input.Keyboard.KeyCodes;
        this.keys = {
            up: keyboard.addKey(K.UP), down: keyboard.addKey(K.DOWN), left: keyboard.addKey(K.LEFT), right: keyboard.addKey(K.RIGHT),
            w: keyboard.addKey(K.W), a: keyboard.addKey(K.A), s: keyboard.addKey(K.S), d: keyboard.addKey(K.D),
            j: keyboard.addKey(K.J), k: keyboard.addKey(K.K),
        };
        this.menuInput = new MenuInput(this);

        // The game's music, quieter under the engine
        const music = this.sound.get('global_music_loop');
        if (music) this.tweens.add({ targets: music, volume: 0.25 * AudioManager.getInstance().getMusicVolume(), duration: 800 });
        this.engine = new EngineSound(this);

        this.raceEvents.length = 0;
        this.events.once('shutdown', () => this.cleanUp());
    }

    update(_time: number, delta: number): void {
        for (const press of this.menuInput.poll()) {
            if (this.paused) {
                this.onPauseInput(press.action);
            } else if (press.action === 'start' || (press.action === 'back' && press.pad === null)) {
                // A gamepad's back button brakes, so only Start pauses on a pad
                this.setPaused(true);
            }
        }
        if (this.paused) {
            this.engine?.update(0, 0, false);
            return;
        }

        this.input0 = this.readInput();
        const steps = this.clock.advance(delta);
        for (let i = 0; i < steps; i++) {
            this.remember();
            this.raceEvents.length = 0;
            stepRace(this.race, this.input0, this.raceEvents);
            for (const event of this.raceEvents) this.onEvent(event);
            this.stepFeel();
        }
        this.drawFrame(delta / 1000);
        this.updateHud();
        const car = this.race.player;
        this.engine?.update(car.speed / CAR.MAX_SPEED, this.input0.throttle, car.offRoad);
    }

    // ─── Input ───

    private readInput(): RaceInput {
        const k = this.keys;
        let throttle = k.up.isDown || k.w.isDown || k.j.isDown ? 1 : 0;
        let brake = k.down.isDown || k.s.isDown || k.k.isDown ? 1 : 0;
        let steer = (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0);

        for (const pad of navigator.getGamepads()) {
            if (!pad) continue;
            // Triggers are analogue: half pressed is half throttle
            throttle = Math.max(throttle, pad.buttons[7]?.value ?? 0, pad.buttons[getConfirmButtonIndex(pad)]?.pressed ? 1 : 0);
            brake = Math.max(brake, pad.buttons[6]?.value ?? 0, pad.buttons[2]?.pressed ? 1 : 0);
            const stick = pad.axes[0] ?? 0;
            if (Math.abs(stick) > STICK_DEAD_ZONE) steer = Math.sign(stick) * (Math.abs(stick) - STICK_DEAD_ZONE) / (1 - STICK_DEAD_ZONE);
            if (pad.buttons[14]?.pressed) steer = -1;
            if (pad.buttons[15]?.pressed) steer = 1;
        }
        return { throttle, brake, steer };
    }

    // ─── Feel ───

    private onEvent(event: RaceEvent): void {
        const sfx = AudioManager.getInstance().getSFXVolume();
        if (event.type === 'crash') {
            this.crashShake = 1;
            this.sound.play('race_crash', { volume: 0.9 * sfx, rate: 0.8 });
        } else if (event.type === 'glance') {
            this.crashShake = Math.max(this.crashShake, 0.4);
            this.sound.play('race_bump', { volume: 0.6 * sfx, rate: 0.9 });
        } else if (event.type === 'bump') {
            this.crashShake = Math.max(this.crashShake, 0.6);
            this.sound.play('race_bump', { volume: 0.8 * sfx, rate: 0.7 });
        } else if (event.type === 'nearMiss') {
            this.sound.play('race_whoosh', { volume: 0.7 * sfx, rate: 1.2 });
            this.popup('SFIORATO!  +250');
        }
    }

    /** Where everything was before this step. */
    private remember(): void {
        const car = this.race.player;
        this.previous.z = car.z;
        this.previous.x = car.x;
        this.previous.speed = car.speed;
        this.previous.skyOffset = this.skyOffset;
        this.previous.traffic = this.race.traffic.map(t => t.z);
        this.previous.trafficX = this.race.traffic.map(t => t.x);
    }

    /** The race `share` of the way from the last step's to this one's, for drawing. */
    private interpolate(share: number): RaceView {
        const race = this.race;
        const car = race.player;
        const length = race.track.length;
        const between = (from: number, to: number) => from + (to - from) * share;
        // Positions round the loop: a step across the start line mustn't draw the car going backwards
        const along = (from: number, to: number) => (from + (((to - from) % length + length * 1.5) % length - length / 2) * share + length) % length;
        const view = this.view;
        view.z = along(this.previous.z, car.z);
        view.x = between(this.previous.x, car.x);
        view.speed = between(this.previous.speed, car.speed);
        view.skyOffset = between(this.previous.skyOffset, this.skyOffset);
        view.slipstream = car.slipstream;
        view.traffic.length = race.traffic.length;
        race.traffic.forEach((other, i) => {
            const from = this.previous.traffic[i] ?? other.z;
            const drawn = view.traffic[i] ?? (view.traffic[i] = { z: 0, x: 0, look: 0, blink: 0 });
            drawn.z = along(from, other.z);
            drawn.x = between(this.previous.trafficX[i] ?? other.x, other.x);
            drawn.look = other.look;
            drawn.blink = other.signal > 0 && Math.floor(other.signal / 9) % 2 === 0 ? Math.sign(other.toLane - other.lane) : 0;
        });
        return view;
    }

    /** A line of text over the car that floats up and fades. */
    private popup(text: string): void {
        const label = this.add.text(this.scale.width / 2, this.scale.height * 0.52, text, {
            fontFamily: '"Pixeloid Sans"', fontSize: '40px', color: '#7ef0ff', stroke: '#000000', strokeThickness: 6,
        }).setOrigin(0.5).setDepth(50);
        this.tweens.add({ targets: label, y: label.y - 90, alpha: 0, duration: 900, ease: 'Quad.easeOut', onComplete: () => label.destroy() });
    }

    /** Once per step: shakes settle, dust flies, the sky slides with the bends. */
    private stepFeel(): void {
        this.crashShake *= 0.88;
        const car = this.race.player;
        const share = car.speed / CAR.MAX_SPEED;
        this.skyOffset -= segmentAt(this.race.track, car.z).curve * share * 0.9;
        // Dust from the back wheels off the road; smoke from them when the tyres slide in a bend
        const smoke = !car.offRoad && car.sliding > 0.15;
        if ((car.offRoad && share > 0.08 || smoke) && this.race.steps % 2 === 0) {
            for (const side of [-1, 1]) {
                this.dust.push({
                    x: VIEW_WIDTH / 2 + side * 40 * PX, y: this.road.carY - 4 * PX,
                    vx: (side * (0.3 + Math.random() * 0.6) - car.vx * 0.4) * PX, vy: (-0.4 - Math.random() * 0.6) * PX, life: 1,
                    colour: smoke ? 0xd8d8dc : 0xd9c79a,
                });
            }
        }
        for (const d of this.dust) {
            d.x += d.vx;
            d.y += d.vy;
            d.vy += 0.03 * PX;
            d.life -= 0.04;
        }
        while (this.dust.length > 0 && this.dust[0].life <= 0) this.dust.shift();
    }

    /** One frame, drawn between the last two steps; everything lands on whole pixels, and nothing jitters at random. */
    private drawFrame(deltaS: number): void {
        const race = this.race;
        const car = race.player;
        const share = car.speed / CAR.MAX_SPEED;
        const view = this.interpolate(this.clock.stepShare);
        const time = race.steps + this.clock.stepShare;

        // Crashes shake the screen, easing off; rough ground knocks it a pixel at a steady beat
        const rough = car.offRoad && share > 0.05;
        const shake = {
            x: Math.round(Math.sin(time * 2.1) * 3 * PX * this.crashShake),
            y: Math.round(Math.cos(time * 2.7) * 3 * PX * this.crashShake) + (rough ? Math.round(Math.sin(time * 1.9) * 2) : 0),
        };
        this.road.draw(view, shake, deltaS);

        // The car slides a pixel or two the way it's moving, never rotated, so its pixels stay whole
        const lean = Math.round((car.vx / CAR.LATERAL) * 4 * PX);
        const carX = Math.round(VIEW_WIDTH / 2 + lean + shake.x);
        const carY = Math.round(this.road.carY - 2 * PX - (rough ? Math.abs(Math.sin(time * 1.3)) * 4 : 0));
        this.car.setPosition(carX, carY);

        const under = this.underCar;
        under.clear();
        under.fillStyle(0x000000, 0.35).fillRect(carX - 52 * PX, carY - 6 * PX, 104 * PX, 8 * PX);
        for (const d of this.dust) {
            const size = Math.round((2 + (1 - d.life) * 4) * PX);
            under.fillStyle(d.colour, d.life * 0.8).fillRect(Math.round(d.x - size / 2), Math.round(d.y - size / 2), size, size);
        }

        this.canvas.clear();
        this.canvas.draw(this.road.far);
        this.canvas.draw(under);
        this.canvas.draw(this.car);
        this.canvas.draw(this.road.near);
    }

    // ─── HUD ───

    private createHud(): void {
        const style = { fontFamily: '"Pixeloid Sans"', color: '#ffffff', stroke: '#000000', strokeThickness: 6 };
        const { width, height } = this.scale;
        this.timeText = this.add.text(40, 32, '', { ...style, fontSize: '40px' });
        this.distanceText = this.add.text(40, 84, '', { ...style, fontSize: '28px', color: '#ffe066' });
        this.scoreText = this.add.text(width - 40, 32, '', { ...style, fontSize: '40px' }).setOrigin(1, 0);
        this.slipText = this.add.text(width - 40, height - 150, 'SCIA', { ...style, fontSize: '28px', color: '#7ef0ff' }).setOrigin(1, 1);
        this.speedText = this.add.text(width - 40, height - 60, '', { ...style, fontSize: '64px' }).setOrigin(1, 1);
        this.speedBar = this.add.graphics();
        this.hint = this.add.text(width / 2, height - 44,
            '↑ / W / J  ACCELERA    ↓ / S / K  FRENA    ← →  STERZA    ESC  PAUSA', { ...style, fontSize: '22px' }).setOrigin(0.5, 1);
        this.tweens.add({ targets: this.hint, alpha: 0, delay: 6000, duration: 1500 });
    }

    private updateHud(): void {
        const race = this.race;
        const share = race.player.speed / CAR.MAX_SPEED;
        const seconds = race.steps / 60;
        const minutes = Math.floor(seconds / 60);
        this.timeText.setText(`TEMPO  ${minutes}:${(seconds % 60).toFixed(1).padStart(4, '0')}`);
        this.distanceText.setText(`${(race.distance / 20000).toFixed(1)} KM`);
        this.speedText.setText(`${Math.round(share * TOP_KMH)} KM/H`);
        this.scoreText.setText(`PUNTI  ${Math.floor(race.score).toLocaleString('it-IT')}`);
        const slip = race.player.slipstream;
        this.slipText.setAlpha(slip > 0.05 ? 0.4 + 0.6 * slip : 0).setText(slip >= 1 ? 'SCIA  MAX' : 'SCIA');

        // A segmented rev bar under the speed, green to red
        const { width, height } = this.scale;
        const bars = 20;
        const lit = Math.round(share * bars);
        const g = this.speedBar.clear();
        for (let i = 0; i < bars; i++) {
            const colour = i < 12 ? 0x4fe36b : i < 17 ? 0xffd23f : 0xff4a3a;
            g.fillStyle(i < lit ? colour : 0x222222, i < lit ? 1 : 0.6).fillRect(width - 40 - (bars - i) * 18, height - 44, 14, 16);
        }
    }

    // ─── Pause ───

    private createPauseMenu(): void {
        const { width, height } = this.scale;
        const shade = this.add.rectangle(0, 0, width, height, 0x000000, 0.7).setOrigin(0);
        const title = this.add.text(width / 2, height / 2 - 170, 'PAUSA', { fontFamily: '"Pixeloid Sans"', fontSize: '72px', color: '#ffffff' }).setOrigin(0.5);
        this.pauseItems = PAUSE_OPTIONS.map((label, i) => this.add.text(width / 2, height / 2 - 40 + i * 70, label, {
            fontFamily: '"Pixeloid Sans"', fontSize: '44px', color: '#ffffff',
        }).setOrigin(0.5));
        this.pauseLayer = this.add.container(0, 0, [shade, title, ...this.pauseItems]).setDepth(100).setVisible(false);
    }

    private setPaused(paused: boolean): void {
        this.paused = paused;
        this.pauseIndex = 0;
        this.pauseLayer.setVisible(paused);
        this.showPauseSelection();
        if (paused) this.menuInput.holdEverything();
        AudioManager.getInstance().playSFX(paused ? 'ui_confirm' : 'ui_back', { volume: 0.5 });
    }

    private onPauseInput(action: string): void {
        if (action === 'up' || action === 'down') {
            this.pauseIndex = (this.pauseIndex + (action === 'up' ? PAUSE_OPTIONS.length - 1 : 1)) % PAUSE_OPTIONS.length;
            this.showPauseSelection();
            AudioManager.getInstance().playSFX('ui_menu_hover', { volume: 0.5 });
        } else if (action === 'back' || action === 'start') {
            this.setPaused(false);
        } else if (action === 'confirm') {
            const choice = PAUSE_OPTIONS[this.pauseIndex];
            if (choice === 'RIPRENDI') this.setPaused(false);
            else if (choice === 'RICOMINCIA') this.scene.restart();
            else this.scene.start('MainMenuScene');
        }
    }

    private showPauseSelection(): void {
        this.pauseItems.forEach((item, i) => item.setColor(i === this.pauseIndex ? '#ffdd00' : '#ffffff').setScale(i === this.pauseIndex ? 1.1 : 1));
    }

    private cleanUp(): void {
        this.engine?.destroy();
        this.engine = null;
        this.road.destroy();
        this.car.destroy();
        this.underCar.destroy();
        this.input.keyboard?.removeAllKeys();
        const music = this.sound.get('global_music_loop');
        if (music) (music as Phaser.Sound.WebAudioSound).setVolume(AudioManager.getInstance().getMusicVolume());
    }
}
