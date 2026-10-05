import Phaser from 'phaser';
import { LOOK } from './DonutLook';
import { DONUT, topSpeed, type DonutState } from './DonutSim';

/**
 * DERAPATE's HUD, drawn on its own camera (shakes and zooms move only the
 * junction): the title, the score, the combo, the speed and top speed; the big
 * message for a testacoda or an overheat; the steering wheel at the bottom,
 * which shows the balance (it turns by itself as the drift pulls it, and you
 * counter-steer it back to straight); and the upright rev bar beside it (the
 * white filling from the bottom, the green on top, where the fill is the
 * engine's heat). On a phone the writing and the bar are bigger.
 *
 * A text is only rewritten when what it says changes: each rewrite (even of
 * just its colour) redraws its canvas and uploads it to the graphics card.
 */

const FONT = '"Pixeloid Sans"';
/** The steering wheel (Riccardo's art), and the rim's centre (where it turns) as a share of the image. */
const WHEEL = { key: 'donut_wheel', path: 'assets/donut/wheel.webp', originX: 507.5 / 1024, originY: 497.5 / 1024 };
const COLOURS = {
    barBack: 0x4a4a50,
    barGreen: 0x2f6b3a,
    barWhite: 0xe8e2cf,
    heatCool: 0x6dff9e,
    heatWarm: 0xffa040,
    heatHot: 0xff5a4a,
    wheelEdge: 0xff4a3a,
    wheelNearEdge: 0xffb070,
};
/** The label over the rev bar: normal, in the green, warning. */
const LABEL_COLOURS = { white: '#e8e2cf', green: '#6dff9e', warning: '#ff5a4a' };
const POINTS = new Intl.NumberFormat('it-IT');

/** Load the HUD's art (in the scene's preload). */
export function preloadHud(scene: Phaser.Scene): void {
    scene.load.image(WHEEL.key, WHEEL.path);
}

export class DonutHud {
    private readonly scene: Phaser.Scene;
    private readonly phone: boolean;
    private readonly score: Phaser.GameObjects.Text;
    private readonly combo: Phaser.GameObjects.Text;
    private readonly speed: Phaser.GameObjects.Text;
    private readonly message: Phaser.GameObjects.Text;
    private readonly wheel: Phaser.GameObjects.Image;
    private readonly bar: Phaser.GameObjects.Graphics;
    private readonly barLabel: Phaser.GameObjects.Text;
    /** The wheel's drawn turn (radians, eased towards the balance). */
    private wheelAngle = 0;
    /** What the texts show now (the speeds in km/h, the combo in hundredths). */
    private readonly shown = { score: -1, combo: -1, speed: -1, top: -1, boost: false, label: '', labelColour: '' };

    constructor(scene: Phaser.Scene, phone: boolean) {
        this.scene = scene;
        this.phone = phone;
        const style = { fontFamily: FONT, color: '#ffffff', stroke: '#000000', strokeThickness: 6 };
        const { width, height } = scene.scale;
        scene.add.text(40, 30, 'DERAPATE', { ...style, fontSize: '40px', color: '#ffdd66' });
        this.score = scene.add.text(width - 40, 30, '', { ...style, fontSize: '44px' }).setOrigin(1, 0);
        this.combo = scene.add.text(width - 40, 84, '', { ...style, fontSize: '28px', color: '#8ab4f8' }).setOrigin(1, 0);
        this.speed = scene.add.text(40, 84, '', { ...style, fontSize: '28px' });
        this.message = scene.add.text(width / 2, height * 0.3, '', { ...style, fontSize: '64px', color: '#ff5a4a' }).setOrigin(0.5).setAlpha(0);
        this.wheel = scene.add.image(0, 0, WHEEL.key).setOrigin(WHEEL.originX, WHEEL.originY);
        this.bar = scene.add.graphics();
        this.barLabel = scene.add.text(0, 0, 'GIRI', { ...style, fontSize: '22px', strokeThickness: 5 }).setOrigin(0.5, 1);
        if (phone) {
            for (const text of [this.score, this.combo, this.speed, this.barLabel]) text.setScale(1.5);
            this.combo.setY(100);
            this.speed.setY(100);
        }
    }

    /** The big message in the middle (a testacoda, an overheat), fading after a moment. */
    showMessage(text: string): void {
        this.scene.tweens.killTweensOf(this.message);
        this.message.setText(text).setAlpha(1);
        this.scene.tweens.add({ targets: this.message, alpha: 0, delay: 1100, duration: 500 });
    }

    /** A fresh start: no message. */
    reset(): void {
        this.scene.tweens.killTweensOf(this.message);
        this.message.setAlpha(0);
        this.wheelAngle = 0;
    }

    /** Every frame. `dt` in seconds. */
    update(state: DonutState, dt: number): void {
        this.writeNumbers(state);
        this.drawWheel(state, dt);
        this.drawRevBar(state);
    }

    /** The score, the combo, the speed and the top speed. */
    private writeNumbers(state: DonutState): void {
        const shown = this.shown;
        const score = Math.floor(state.score);
        if (score !== shown.score) {
            shown.score = score;
            this.score.setText(`PUNTI  ${POINTS.format(score)}`);
        }
        const combo = Math.round(state.combo * 100);
        if (combo !== shown.combo) {
            shown.combo = combo;
            this.combo.setText(combo > 100 ? `COMBO  x${(combo / 100).toFixed(2)}` : '');
        }
        const speed = Math.round(state.speed * 3.6);
        const top = Math.round(topSpeed(state) * 3.6);
        const boost = state.boost > 0.5;
        if (speed !== shown.speed || top !== shown.top || boost !== shown.boost) {
            shown.speed = speed;
            shown.top = top;
            shown.boost = boost;
            this.speed.setText(`${speed} KM/H   MAX ${top}${boost ? '  BOOST!' : ''}`);
        }
    }

    /**
     * The steering wheel is the balance: it turns by itself as the drift pulls
     * it, and you counter-steer to bring it back to straight (turned left, steer
     * right). At full turn it's at the edge: in the green it goes orange near
     * there and flashes red at it (a moment there is a testacoda).
     */
    private drawWheel(state: DonutState, dt: number): void {
        const turn = (-state.slip * LOOK.WHEEL_TURN * Math.PI) / 180;
        this.wheelAngle += (turn - this.wheelAngle) * Math.min(1, LOOK.WHEEL_EASE * Math.min(0.1, dt));
        this.wheel.setPosition(LOOK.WHEEL_X, LOOK.WHEEL_Y).setScale(LOOK.WHEEL_SCALE).setRotation(this.wheelAngle);
        const flashOn = Math.floor(state.steps / 4) % 2 === 0;
        if (state.locked && state.overEdge > 0 && flashOn) this.wheel.setTint(COLOURS.wheelEdge);
        else if (state.locked && Math.abs(state.slip) > 0.8) this.wheel.setTint(COLOURS.wheelNearEdge);
        else this.wheel.clearTint();
    }

    /**
     * The rev bar, upright: the white fills from the bottom, the green is on
     * top; in the green the fill is the engine's heat (green, orange, flashing
     * red near overheating). The label over it says what's going on.
     */
    private drawRevBar(state: DonutState): void {
        const g = this.bar.clear();
        const width = LOOK.REV_BAR_WIDTH * (this.phone ? 1.3 : 1);
        const height = LOOK.REV_BAR_HEIGHT;
        const left = LOOK.REV_BAR_X - width / 2;
        const bottom = LOOK.REV_BAR_Y;
        const top = bottom - height;
        const at = (revs: number) => bottom - height * revs;
        const inset = Math.max(3, width * 0.2);
        const greenTop = at(DONUT.GREEN_AT);
        const white = at(Math.min(state.revs, DONUT.GREEN_AT));
        g.fillStyle(0x000000, 0.55).fillRect(left - 6, top - 6, width + 12, height + 12);
        g.fillStyle(COLOURS.barBack).fillRect(left, top, width, height);
        g.fillStyle(COLOURS.barGreen).fillRect(left, top, width, greenTop - top);
        g.fillStyle(COLOURS.barWhite).fillRect(left + inset, white, width - 2 * inset, bottom - white);
        const hot = state.locked && state.heat > 0.75;
        if (state.locked) {
            const flashOn = Math.floor(state.steps / 4) % 2 === 0;
            const colour = hot && flashOn ? COLOURS.heatHot : state.heat > 0.5 ? COLOURS.heatWarm : COLOURS.heatCool;
            g.fillStyle(colour).fillRect(left + inset, at(state.revs), width - 2 * inset, greenTop - at(state.revs));
            g.lineStyle(3, colour).strokeRect(left - 2, top - 2, width + 4, greenTop - top + 4);
        }

        const trouble = state.stalled || state.spinning > 0 || hot;
        const label = state.stalled ? 'MOTORE FUSO'
            : state.spinning > 0 ? 'TESTACODA'
            : hot ? 'MOTORE CALDO!'
            : state.locked ? 'IN VERDE  x2'
            : 'GIRI';
        const colour = trouble ? LABEL_COLOURS.warning : state.locked ? LABEL_COLOURS.green : LABEL_COLOURS.white;
        this.barLabel.setPosition(LOOK.REV_BAR_X, top - 14);
        if (label !== this.shown.label || colour !== this.shown.labelColour) {
            this.shown.label = label;
            this.shown.labelColour = colour;
            this.barLabel.setColor(colour).setText(label);
        }
    }
}
