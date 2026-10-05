import Phaser from 'phaser';

/**
 * DERAPATE's touch controls, for phones: under the left thumb a left/right
 * steering stick (a "cloche": put a thumb down anywhere in the left half and
 * slide it sideways, the further the harder it steers), under the right thumb
 * the accelerator (hold anywhere in the right half). Small buttons top right:
 * the lights on or off (LUCI: the lighting costs a phone the most), start
 * again, and back to the menu. Several fingers at once.
 * Drawn on the HUD's camera; the positions are the game's 1920x1080.
 */

/** How far (px) the thumb slides for full lock, and the dead zone in the middle. */
const STICK_REACH = 150;
const STICK_DEAD = 0.08;
/** Where the stick and the pedal sit when nobody's touching (drawn there, faint). */
const STICK_HOME = { x: 300, y: 860 };
const PEDAL_HOME = { x: 1620, y: 860 };
const BUTTON_SIZE = 96;
/** Touch points to follow at once: the stick, the pedal and a spare. */
const FINGERS = 3;

export class DonutTouch {
    /** The controls now: the pedal 0 or 1, the steering -1 to 1. */
    throttle = 0;
    steer = 0;
    private readonly scene: Phaser.Scene;
    private readonly graphics: Phaser.GameObjects.Graphics;
    private readonly labels: Phaser.GameObjects.Text[] = [];
    private readonly buttons: { x: number; y: number; label: string; size: number; action: () => void }[];
    private readonly lightsOn: () => boolean;
    private lightsLabel: Phaser.GameObjects.Text | null = null;
    /** The stick's finger: where it went down (the stick's centre) and where it is across now. */
    private stick: { id: number; x: number; y: number; at: number } | null = null;
    /** The pedal's finger. */
    private pedalId: number | null = null;

    constructor(scene: Phaser.Scene, actions: { restart: () => void; menu: () => void; lights: (() => void) | null; lightsOn: () => boolean }) {
        this.scene = scene;
        this.lightsOn = actions.lightsOn;
        const missing = FINGERS - scene.input.manager.pointersTotal;
        if (missing > 0) scene.input.addPointer(missing);
        const { width } = scene.scale;
        const step = BUTTON_SIZE + 24;
        this.buttons = [
            { x: width - 70 - step, y: 180, label: '↻', size: 48, action: actions.restart },
            { x: width - 70, y: 180, label: '✕', size: 48, action: actions.menu },
        ];
        // Only where the game can light (otherwise there's nothing to switch)
        const lights = actions.lights;
        if (lights) {
            this.buttons.unshift({ x: width - 70 - 2 * step, y: 180, label: 'LUCI', size: 24, action: () => {
                lights();
                this.draw();
            } });
        }
        this.graphics = scene.add.graphics().setDepth(900);
        const style = { fontFamily: '"Pixeloid Sans"', color: '#ffffff', stroke: '#000000', strokeThickness: 6 };
        for (const button of this.buttons) {
            const label = scene.add.text(button.x, button.y, button.label, { ...style, fontSize: `${button.size}px` }).setOrigin(0.5).setDepth(901);
            if (button.label === 'LUCI') this.lightsLabel = label;
            this.labels.push(label);
        }
        this.labels.push(
            scene.add.text(STICK_HOME.x, STICK_HOME.y + 110, 'STERZO', { ...style, fontSize: '30px' }).setOrigin(0.5).setDepth(901).setAlpha(0.7),
            scene.add.text(PEDAL_HOME.x, PEDAL_HOME.y + 110, 'GAS', { ...style, fontSize: '30px' }).setOrigin(0.5).setDepth(901).setAlpha(0.7),
        );

        scene.input.on('pointerdown', this.onDown, this);
        scene.input.on('pointermove', this.onMove, this);
        scene.input.on('pointerup', this.onUp, this);
        scene.input.on('pointerupoutside', this.onUp, this);
        this.draw();
    }

    destroy(): void {
        this.scene.input.off('pointerdown', this.onDown, this);
        this.scene.input.off('pointermove', this.onMove, this);
        this.scene.input.off('pointerup', this.onUp, this);
        this.scene.input.off('pointerupoutside', this.onUp, this);
        this.graphics.destroy();
        for (const label of this.labels) label.destroy();
    }

    private onDown(pointer: Phaser.Input.Pointer): void {
        const reach = BUTTON_SIZE / 2 + 10;
        const button = this.buttons.find(b => Math.abs(pointer.x - b.x) < reach && Math.abs(pointer.y - b.y) < reach);
        if (button) {
            button.action();
            return;
        }
        if (pointer.x < this.scene.scale.width / 2) {
            if (!this.stick) this.stick = { id: pointer.id, x: pointer.x, y: pointer.y, at: pointer.x };
        } else if (this.pedalId === null) {
            this.pedalId = pointer.id;
        }
        this.update(true);
    }

    private onMove(pointer: Phaser.Input.Pointer): void {
        if (this.stick?.id !== pointer.id) return;
        this.stick.at = pointer.x;
        this.update(false);
    }

    private onUp(pointer: Phaser.Input.Pointer): void {
        if (this.stick?.id === pointer.id) this.stick = null;
        if (this.pedalId === pointer.id) this.pedalId = null;
        this.update(true);
    }

    /** The controls from the fingers; redrawn when a finger came or went, or the steering moved. */
    private update(fingersChanged: boolean): void {
        const throttle = this.pedalId === null ? 0 : 1;
        let steer = 0;
        if (this.stick) {
            const raw = Phaser.Math.Clamp((this.stick.at - this.stick.x) / STICK_REACH, -1, 1);
            if (Math.abs(raw) >= STICK_DEAD) steer = raw;
        }
        const changed = fingersChanged || throttle !== this.throttle || steer !== this.steer;
        this.throttle = throttle;
        this.steer = steer;
        if (changed) this.draw();
    }

    private draw(): void {
        const g = this.graphics.clear();
        // The stick: a track across, and the knob where the thumb is
        const base = this.stick ?? STICK_HOME;
        const active = this.stick !== null;
        g.fillStyle(0x000000, active ? 0.45 : 0.25).fillRoundedRect(base.x - STICK_REACH - 50, base.y - 50, 2 * STICK_REACH + 100, 100, 50);
        g.lineStyle(4, 0xffffff, active ? 0.6 : 0.3).strokeRoundedRect(base.x - STICK_REACH - 50, base.y - 50, 2 * STICK_REACH + 100, 100, 50);
        g.fillStyle(0xffffff, active ? 0.9 : 0.4).fillCircle(base.x + this.steer * STICK_REACH, base.y, 42);
        // The pedal: lit while held
        const held = this.pedalId !== null;
        g.fillStyle(held ? 0x6dff9e : 0x000000, held ? 0.55 : 0.25).fillCircle(PEDAL_HOME.x, PEDAL_HOME.y, 90);
        g.lineStyle(4, 0xffffff, held ? 0.8 : 0.3).strokeCircle(PEDAL_HOME.x, PEDAL_HOME.y, 90);
        // The buttons (LUCI lit while the lights are on)
        const lit = this.lightsOn();
        this.lightsLabel?.setAlpha(lit ? 1 : 0.45);
        for (const button of this.buttons) {
            const on = button.label === 'LUCI' && lit;
            g.fillStyle(on ? 0xffb468 : 0x000000, on ? 0.5 : 0.45).fillRoundedRect(button.x - BUTTON_SIZE / 2, button.y - BUTTON_SIZE / 2, BUTTON_SIZE, BUTTON_SIZE, 18);
            g.lineStyle(3, 0xffffff, 0.5).strokeRoundedRect(button.x - BUTTON_SIZE / 2, button.y - BUTTON_SIZE / 2, BUTTON_SIZE, BUTTON_SIZE, 18);
        }
    }
}
