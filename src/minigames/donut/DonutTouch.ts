import Phaser from 'phaser';

/**
 * DERAPATE's touch controls, for phones: under the left thumb a left/right
 * steering stick (a "cloche": put a thumb down anywhere in the left half and
 * slide it sideways, the further the harder it steers), under the right thumb
 * the accelerator (hold anywhere in the right half). Two small buttons top
 * right: start again, and back to the menu. Several fingers at once.
 * Drawn on the HUD's camera; the positions are the game's 1920x1080.
 */

/** How far (px) the thumb slides for full lock, and the dead zone in the middle. */
const STICK_REACH = 150;
const STICK_DEAD = 0.08;
/** Where the stick and the pedal sit when nobody's touching (drawn there, faint). */
const STICK_HOME = { x: 300, y: 860 };
const PEDAL_HOME = { x: 1620, y: 860 };
const BUTTON_SIZE = 96;

export class DonutTouch {
    /** The controls now: the pedal 0 or 1, the steering -1 to 1. */
    throttle = 0;
    steer = 0;
    private readonly graphics: Phaser.GameObjects.Graphics;
    private readonly labels: Phaser.GameObjects.Text[] = [];
    private stick: { id: number; x: number; y: number; at: number } | null = null;
    private pedal: { id: number; x: number; y: number } | null = null;
    private readonly scene: Phaser.Scene;
    private readonly buttons: { x: number; y: number; label: string; action: () => void }[];

    constructor(scene: Phaser.Scene, actions: { restart: () => void; menu: () => void }) {
        this.scene = scene;
        // Three fingers: the stick, the pedal and a spare
        scene.input.addPointer(2);
        const { width } = scene.scale;
        this.buttons = [
            { x: width - 70 - BUTTON_SIZE - 24, y: 180, label: '↻', action: actions.restart },
            { x: width - 70, y: 180, label: '✕', action: actions.menu },
        ];
        this.graphics = scene.add.graphics().setDepth(900);
        const style = { fontFamily: '"Pixeloid Sans"', color: '#ffffff', stroke: '#000000', strokeThickness: 6 };
        for (const button of this.buttons) {
            this.labels.push(scene.add.text(button.x, button.y, button.label, { ...style, fontSize: '48px' }).setOrigin(0.5).setDepth(901));
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

    /** Everything the controls drew, for the cameras to sort out. */
    get objects(): Phaser.GameObjects.GameObject[] {
        return [this.graphics, ...this.labels];
    }

    private onDown(pointer: Phaser.Input.Pointer): void {
        const button = this.buttons.find(b => Math.abs(pointer.x - b.x) < BUTTON_SIZE / 2 + 10 && Math.abs(pointer.y - b.y) < BUTTON_SIZE / 2 + 10);
        if (button) {
            button.action();
            return;
        }
        if (pointer.x < this.scene.scale.width / 2) {
            if (!this.stick) this.stick = { id: pointer.id, x: pointer.x, y: pointer.y, at: pointer.x };
        } else if (!this.pedal) {
            this.pedal = { id: pointer.id, x: pointer.x, y: pointer.y };
        }
        this.update();
    }

    private onMove(pointer: Phaser.Input.Pointer): void {
        if (this.stick?.id === pointer.id) this.stick.at = pointer.x;
        this.update();
    }

    private onUp(pointer: Phaser.Input.Pointer): void {
        if (this.stick?.id === pointer.id) this.stick = null;
        if (this.pedal?.id === pointer.id) this.pedal = null;
        this.update();
    }

    private update(): void {
        this.throttle = this.pedal ? 1 : 0;
        if (this.stick) {
            const raw = Math.max(-1, Math.min(1, (this.stick.at - this.stick.x) / STICK_REACH));
            this.steer = Math.abs(raw) < STICK_DEAD ? 0 : raw;
        } else {
            this.steer = 0;
        }
        this.draw();
    }

    private draw(): void {
        const g = this.graphics.clear();
        // The stick: a track across, and the knob where the thumb is
        const base = this.stick ?? { x: STICK_HOME.x, y: STICK_HOME.y };
        const active = this.stick !== null;
        g.fillStyle(0x000000, active ? 0.45 : 0.25).fillRoundedRect(base.x - STICK_REACH - 50, base.y - 50, 2 * STICK_REACH + 100, 100, 50);
        g.lineStyle(4, 0xffffff, active ? 0.6 : 0.3).strokeRoundedRect(base.x - STICK_REACH - 50, base.y - 50, 2 * STICK_REACH + 100, 100, 50);
        g.fillStyle(0xffffff, active ? 0.9 : 0.4).fillCircle(base.x + this.steer * STICK_REACH, base.y, 42);
        // The pedal: lit while held
        const pedal = this.pedal ? { x: PEDAL_HOME.x, y: PEDAL_HOME.y } : PEDAL_HOME;
        g.fillStyle(this.pedal ? 0x6dff9e : 0x000000, this.pedal ? 0.55 : 0.25).fillCircle(pedal.x, pedal.y, 90);
        g.lineStyle(4, 0xffffff, this.pedal ? 0.8 : 0.3).strokeCircle(pedal.x, pedal.y, 90);
        // The buttons
        for (const button of this.buttons) {
            g.fillStyle(0x000000, 0.45).fillRoundedRect(button.x - BUTTON_SIZE / 2, button.y - BUTTON_SIZE / 2, BUTTON_SIZE, BUTTON_SIZE, 18);
            g.lineStyle(3, 0xffffff, 0.5).strokeRoundedRect(button.x - BUTTON_SIZE / 2, button.y - BUTTON_SIZE / 2, BUTTON_SIZE, BUTTON_SIZE, 18);
        }
    }

    destroy(): void {
        this.scene.input.off('pointerdown', this.onDown, this);
        this.scene.input.off('pointermove', this.onMove, this);
        this.scene.input.off('pointerup', this.onUp, this);
        this.scene.input.off('pointerupoutside', this.onUp, this);
        this.graphics.destroy();
        for (const label of this.labels) label.destroy();
    }
}
