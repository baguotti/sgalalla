import Phaser from 'phaser';
import { LOOK } from './DonutLook';
import { DONUT, JUNCTION, pedestrianPosition, whiteShare, type DonutState, type Pedestrian } from './DonutSim';

/**
 * Draws DERAPATE from a fixed isometric camera, all in plain blocks until the
 * art comes: the junction (roads, zebra crossings, pavements, corner blocks),
 * the tyre marks the donuts leave, the car and the people, nearer things over
 * farther ones.
 */

/** Isometric: across the screen and down it per metre of ground (the camera's scale is LOOK.SCALE). */
const isoX = () => LOOK.SCALE * 0.866;
const isoY = () => LOOK.SCALE * 0.5;
/** How far the road runs out from the centre (off screen). */
const ROAD_REACH = 70;

const COLOURS = {
    pavement: 0xb8b1a4,
    pavementLine: 0xa39c8f,
    road: 0x3d3f45,
    kerb: 0xd8d2c6,
    lane: 0xe8e2cf,
    zebra: 0xf1eee6,
    marks: 0x16161a,
    ring: 0xffffff,
    building: [0xcdbfa6, 0xbfae92, 0xd6c9b3],
    /** The car is black, tinted by the revs (see carBodyColour). */
    car: 0x18181c,
    cabin: 0x3a4150,
    tintWhite: 0xf2efe6,
    tintGreen: 0x4cff8a,
    tintHot: 0xffa040,
    tintRed: 0xff3a2e,
    /** The people: navy blue cost you, white give a boost. */
    walker: 0x23306b,
    booster: 0xf4f2ec,
    shadow: 0x000000,
    smoke: 0xe4e4e8,
};

/** A point on the ground (or `z` metres above it) on screen. */
export function iso(x: number, y: number, z = 0): { x: number; y: number } {
    return { x: LOOK.CENTRE_X + (x - y) * isoX(), y: LOOK.CENTRE_Y + (x + y) * isoY() - z * LOOK.SCALE };
}

/** What a frame shows: the car placed between its last two steps. */
export interface DonutView {
    state: DonutState;
    x: number;
    y: number;
    radius: number;
    /** Which way the car's nose points. */
    heading: number;
    /** Seconds since the last frame (0 while frozen), for the suspension. */
    dt: number;
}

/**
 * The car's sprite sheets (scripts/donut-car-sprites.py: Riccardo's renders of the
 * car turning on the spot), the body and the wheels as separate layers with the
 * same frames, and what their JSON says: frame size, where the car's centre on
 * the ground is in a frame, which frame faces straight down the screen (heading
 * 45°), degrees per frame (the frames turn the other way round as they go), and
 * the car's length in a frame's pixels.
 */
export const CAR_SHEET = {
    body: 'donut_car_body', bodyPath: 'assets/donut/car_body.webp',
    wheels: 'donut_car_wheels', wheelsPath: 'assets/donut/car_wheels.webp',
    json: 'donut_car_info', jsonPath: 'assets/donut/car.json',
};
export interface CarSheetInfo {
    frameWidth: number;
    frameHeight: number;
    frames: number;
    pivotX: number;
    pivotY: number;
    noseDownFrame: number;
    degreesPerFrame: number;
    lengthPx: number;
}
/** The most smoke cubes in the air at once. */
const SMOKE_MAX = 800;
/** The car is drawn as long as the block car was: 4.4 m, times LOOK.CAR_SIZE. */
const CAR_LENGTH_M = 4.4;

export class DonutRenderer {
    readonly graphics: Phaser.GameObjects.Graphics;
    /** The ground and everything fixed on it, drawn once (again when the Lab moves it). */
    private readonly ground: Phaser.GameObjects.Graphics;
    /** The car: the wheels, the body over them (on its springs), a copy of the body filled with the revs' tint; and what's nearer the camera than the car. */
    private readonly wheels: Phaser.GameObjects.Sprite | null = null;
    private readonly body: Phaser.GameObjects.Sprite | null = null;
    private readonly bodyTint: Phaser.GameObjects.Sprite | null = null;
    /** The body's offset on its springs (screen px; only up and down), how fast it's moving, and the speed last frame. */
    private readonly spring = { x: 0, y: 0, vx: 0, vy: 0, tilt: 0, speed: 0 };
    /** Tyre smoke: little cubes on the ground (metres), rising, growing and fading; and the part-puff due. */
    private readonly smoke: { x: number; y: number; z: number; vx: number; vy: number; size: number; age: number; life: number; shade: number }[] = [];
    private smokeDue = 0;
    private readonly front: Phaser.GameObjects.Graphics;
    private readonly sheet: CarSheetInfo | null;
    /**
     * The tyre marks: rubber laid on a texture over the road, a strip under
     * each rear tyre, built up lap after lap and fading slowly. The brush draws
     * the new strips each step; the fader rubs the old ones out a little.
     */
    private readonly rubber: Phaser.GameObjects.RenderTexture;
    private readonly brush: Phaser.GameObjects.Graphics;
    private readonly fader: Phaser.GameObjects.Graphics;
    private brushDirty = false;
    private fadeDue = 0;
    /** Where each rear tyre was at the last mark (null: start a new strip). */
    private readonly tyres: ({ x: number; y: number } | null)[] = [null, null];

    constructor(scene: Phaser.Scene, sheet: CarSheetInfo | null = null) {
        this.ground = scene.add.graphics();
        drawJunction(this.ground);
        const { width, height } = scene.scale;
        this.rubber = scene.add.renderTexture(0, 0, width, height).setOrigin(0, 0);
        this.brush = new Phaser.GameObjects.Graphics(scene);
        this.fader = new Phaser.GameObjects.Graphics(scene);
        this.graphics = scene.add.graphics();
        this.sheet = sheet;
        if (sheet) {
            const originX = sheet.pivotX / sheet.frameWidth;
            const originY = sheet.pivotY / sheet.frameHeight;
            this.wheels = scene.add.sprite(0, 0, CAR_SHEET.wheels, 0).setOrigin(originX, originY);
            this.body = scene.add.sprite(0, 0, CAR_SHEET.body, 0).setOrigin(originX, originY);
            this.bodyTint = scene.add.sprite(0, 0, CAR_SHEET.body, 0).setOrigin(originX, originY);
        }
        this.front = scene.add.graphics();
    }

    /** How much bigger than life the car is drawn: the size the rear tyres, marks and smoke follow. */
    private carScale(): number {
        return LOOK.CAR_SIZE * (this.sheet && LOOK.CAR_SPRITES !== 0 ? LOOK.CAR_SPRITE_SCALE : 1);
    }

    /** Where the two rear tyres touch the ground, for the car at x, y pointing along `heading`. */
    rearTyres(x: number, y: number, heading: number): { x: number; y: number }[] {
        const k = this.carScale();
        const c = Math.cos(heading);
        const s = Math.sin(heading);
        const back = LOOK.REAR_AXLE * k;
        return [-1, 1].map(side => ({
            x: x - c * back - s * side * LOOK.HALF_TRACK * k,
            y: y - s * back + c * side * LOOK.HALF_TRACK * k,
        }));
    }

    /**
     * Called each step with the car: a strip of rubber under each rear tyre from
     * where it was, darker the harder the wheels spin (`strength` 0 to 1; 0 lifts
     * the tyres off: the next mark starts a new strip).
     */
    addMarks(x: number, y: number, heading: number, strength: number): void {
        const tyres = this.rearTyres(x, y, heading);
        const width = LOOK.MARK_WIDTH * this.carScale();
        tyres.forEach((tyre, i) => {
            const last = this.tyres[i];
            this.tyres[i] = strength > 0 ? tyre : null;
            if (!last || strength <= 0) return;
            const dx = tyre.x - last.x;
            const dy = tyre.y - last.y;
            const length = Math.hypot(dx, dy);
            if (length < 1e-4 || length > 2) return;
            // A strip as wide as the tyre on the ground, a little ragged; a darker core where it bites hardest
            const nx = -dy / length;
            const ny = dx / length;
            const alpha = Math.min(1, LOOK.MARK_DARKNESS * strength * (0.8 + 0.2 * Math.random()));
            for (const [share, a] of [[1, alpha * 0.6], [0.45, alpha * 0.55]] as const) {
                const h = (width * share * (0.9 + 0.2 * Math.random())) / 2;
                this.brush.fillStyle(COLOURS.marks, a).fillPoints([
                    iso(last.x + nx * h, last.y + ny * h), iso(tyre.x + nx * h, tyre.y + ny * h),
                    iso(tyre.x - nx * h, tyre.y - ny * h), iso(last.x - nx * h, last.y - ny * h),
                ], true);
            }
            this.brushDirty = true;
        });
    }

    /** The junction again, after the Lab changed its size or the camera (the rubber can't follow: it's cleared). */
    redrawGround(): void {
        drawJunction(this.ground.clear());
        this.clearMarks();
    }

    /** A fresh start: no rubber on the road, no smoke. */
    clearMarks(): void {
        this.rubber.clear();
        this.brush.clear();
        this.brushDirty = false;
        this.tyres[0] = this.tyres[1] = null;
        this.smoke.length = 0;
    }

    /** The new rubber onto the road, and every couple of seconds the old rubbed out a little. */
    private layRubber(dt: number): void {
        if (this.brushDirty) {
            this.rubber.draw(this.brush);
            this.brush.clear();
            this.brushDirty = false;
        }
        this.fadeDue += dt;
        if (this.fadeDue >= 2 && LOOK.MARK_FADE > 0) {
            const share = 1 - Math.pow(1 - Math.min(0.99, LOOK.MARK_FADE), this.fadeDue);
            this.fadeDue = 0;
            const { width, height } = this.rubber;
            this.fader.clear().fillStyle(0xffffff, share).fillRect(0, 0, width, height);
            this.rubber.erase(this.fader);
        }
    }

    draw(view: DonutView): void {
        const g = this.graphics.clear();
        this.layRubber(Math.min(0.1, view.dt));

        // Where the donut runs now, faintly
        g.lineStyle(2, COLOURS.ring, LOOK.RING);
        g.beginPath();
        for (let i = 0; i <= 64; i++) {
            const angle = (i / 64) * Math.PI * 2;
            const p = iso(DONUT.CENTRE_X + Math.cos(angle) * view.radius, DONUT.CENTRE_Y + Math.sin(angle) * view.radius);
            if (i === 0) g.moveTo(p.x, p.y);
            else g.lineTo(p.x, p.y);
        }
        g.strokePath();

        const f = this.front.clear();
        const tint = this.revsTint(view.state);
        const sprites = this.sheet !== null && LOOK.CAR_SPRITES !== 0;
        this.wheels?.setVisible(sprites);
        this.body?.setVisible(sprites);
        this.bodyTint?.setVisible(sprites && tint.alpha > 0.01);
        if (!sprites || !this.sheet || !this.wheels || !this.body || !this.bodyTint) {
            // The block car: the car and the people, farthest first
            const things: { depth: number; draw: () => void }[] = [
                { depth: view.x + view.y, draw: () => {
                    drawCar(g, view.x, view.y, view.heading, mix(COLOURS.car, tint.colour, tint.alpha));
                    this.drawBackfire(g, view.x, view.y, view.heading);
                } },
                ...view.state.pedestrians.map(p => {
                    const at = pedestrianPosition(p);
                    return { depth: at.x + at.y, draw: () => drawPedestrian(g, p, at.x, at.y) };
                }),
            ];
            things.sort((a, b) => a.depth - b.depth);
            for (const thing of things) thing.draw();
            this.updateSmoke(view);
            this.drawSmoke(g, g, Infinity);
            return;
        }

        // The sprite car: its shadow, the people behind it, the car (and its tint), the people in front
        const carDepth = view.x + view.y;
        const shadow = iso(view.x, view.y);
        const k = LOOK.CAR_SIZE;
        g.fillStyle(COLOURS.shadow, LOOK.CAR_SHADOW).fillEllipse(shadow.x, shadow.y, 4.6 * k * isoX(), 4.6 * k * isoY());
        const people = view.state.pedestrians.map(p => ({ p, at: pedestrianPosition(p) }))
            .sort((a, b) => (a.at.x + a.at.y) - (b.at.x + b.at.y));
        for (const { p, at } of people) drawPedestrian(at.x + at.y > carDepth ? f : g, p, at.x, at.y);
        // The exhaust is behind the car when the rear points away from the camera
        const rearDepth = -Math.cos(view.heading) - Math.sin(view.heading);
        this.drawBackfire(rearDepth > 0 ? f : g, view.x, view.y, view.heading);
        this.updateSmoke(view);
        this.drawSmoke(g, f, carDepth);

        const sheet = this.sheet;
        const degrees = (view.heading * 180) / Math.PI;
        const frame = ((Math.round(sheet.noseDownFrame + (45 - degrees) / sheet.degreesPerFrame) % sheet.frames) + sheet.frames) % sheet.frames;
        const scale = ((CAR_LENGTH_M * LOOK.CAR_SIZE * LOOK.SCALE) / sheet.lengthPx) * LOOK.CAR_SPRITE_SCALE;
        const y = shadow.y + LOOK.CAR_SPRITE_Y;
        this.wheels.setPosition(shadow.x, y).setScale(scale).setFrame(frame);
        // The body rides on its springs over the wheels
        const spring = this.suspension(view);
        const bodyX = shadow.x + spring.x;
        const bodyY = y + spring.y;
        this.body.setPosition(bodyX, bodyY).setScale(scale).setFrame(frame).setRotation(spring.tilt);
        this.bodyTint.setPosition(bodyX, bodyY).setScale(scale).setFrame(frame).setRotation(spring.tilt)
            .setTintFill(tint.colour).setAlpha(tint.alpha);
    }

    /**
     * Tyre smoke: puffs of little cubes from the two rear tyres, more the harder
     * the wheels spin (the pedal down and the revs up, the most in a testacoda),
     * none standing still. Each cube drifts back off the tyre, rises, grows and
     * fades. Render only (it doesn't touch the rules).
     */
    private updateSmoke(view: DonutView): void {
        const dt = Math.min(0.05, view.dt);
        if (dt <= 0) return;
        const state = view.state;
        for (const puff of this.smoke) {
            puff.age += dt;
            puff.x += puff.vx * dt;
            puff.y += puff.vy * dt;
            puff.z += LOOK.SMOKE_RISE * dt * (1 - puff.age / puff.life * 0.5);
            puff.vx *= 1 - 1.5 * dt;
            puff.vy *= 1 - 1.5 * dt;
        }
        for (let i = this.smoke.length - 1; i >= 0; i--) if (this.smoke[i].age >= this.smoke[i].life) this.smoke.splice(i, 1);

        const moving = Math.min(1, state.speed / DONUT.SPEED_MAX);
        const spinning = state.spinning > 0 ? 1.5 : 0;
        const pedal = state.lifted === 0 ? 0.25 + 0.75 * state.revs : 0.15 * state.revs;
        const amount = state.stalled ? 0.1 * moving : Math.max(spinning, pedal * (0.3 + 0.7 * moving));
        if (amount <= 0 || LOOK.SMOKE <= 0) return;
        this.smokeDue += LOOK.SMOKE * amount * dt;
        const c = Math.cos(view.heading);
        const s = Math.sin(view.heading);
        const tyres = this.rearTyres(view.x, view.y, view.heading);
        while (this.smokeDue >= 1 && this.smoke.length < SMOKE_MAX) {
            this.smokeDue -= 1;
            // One rear tyre or the other
            const tyre = tyres[Math.random() < 0.5 ? 0 : 1];
            const kick = 0.8 + Math.random() * 1.2;
            this.smoke.push({
                x: tyre.x + (Math.random() - 0.5) * 0.4,
                y: tyre.y + (Math.random() - 0.5) * 0.4,
                z: 0.1,
                vx: -c * kick + (Math.random() - 0.5) * 0.6,
                vy: -s * kick + (Math.random() - 0.5) * 0.6,
                size: (0.25 + Math.random() * 0.25) * LOOK.SMOKE_SIZE,
                age: 0,
                life: LOOK.SMOKE_LIFE * (0.7 + Math.random() * 0.6),
                shade: 0.85 + Math.random() * 0.15,
            });
        }
        if (this.smoke.length >= SMOKE_MAX) this.smokeDue = 0;
    }

    /** The smoke cubes, farthest first: those farther than `depth` (the car) on `behind`, the rest on `front`. */
    private drawSmoke(behind: Phaser.GameObjects.Graphics, front: Phaser.GameObjects.Graphics, depth: number): void {
        const puffs = this.smoke.slice().sort((a, b) => (a.x + a.y) - (b.x + b.y));
        for (const puff of puffs) {
            const t = puff.age / puff.life;
            const size = puff.size * (1 + 3 * t);
            // Thickest just after it appears, then thinning out
            const alpha = LOOK.SMOKE_OPACITY * Math.min(1, t * 8) * (1 - t) * (1 - t);
            if (alpha < 0.01) continue;
            voxel(puff.x + puff.y > depth ? front : behind, puff.x, puff.y, puff.z, size, shade(COLOURS.smoke, puff.shade), alpha);
        }
    }

    /** A jolt to the suspension (a hit, a landing): the body bounces, `strength` 0 to 1. */
    bump(strength = 1): void {
        this.spring.vy += LOOK.SUSP_BUMP * strength * 12;
    }

    /**
     * The body on its springs: it only travels straight up and down over the
     * wheels (sliding or tilting it would pull the arches off them), at most
     * LOOK.SUSP_TRAVEL px. Loaded going round, it sits lower; speeding up it
     * lifts, slowing it dips; at speed it rumbles; bumps bounce it. A spring and
     * a damper bring it back (LOOK.SUSP_FREQ, LOOK.SUSP_DAMP).
     */
    private suspension(view: DonutView): { x: number; y: number; tilt: number } {
        const sp = this.spring;
        const dt = Math.min(0.05, view.dt);
        const state = view.state;
        if (dt <= 0) return sp;
        // Going round: how hard (1 at top speed on the widest donut)
        const top = DONUT.SPEED_MAX * DONUT.SPEED_MAX / DONUT.RADIUS_MAX;
        const cornering = state.spinning > 0 ? 0 : Math.min(1.5, (state.speed * state.speed) / Math.max(1, view.radius) / top);
        // Speeding up or slowing down (1 for a second from standing to top speed)
        const accel = Math.max(-2, Math.min(2, (state.speed - sp.speed) / dt / DONUT.SPEED_MAX));
        sp.speed = state.speed;
        const rumble = LOOK.SUSP_RUMBLE * Math.min(1.5, state.speed / DONUT.SPEED_MAX) * (Math.random() * 2 - 1);
        const target = LOOK.SUSP_LEAN * cornering - LOOK.SUSP_SQUAT * accel + rumble;
        // A damped spring towards that, kept within the travel
        const omega = 2 * Math.PI * Math.max(0.1, LOOK.SUSP_FREQ);
        sp.vy += (omega * omega * (target - sp.y) - 2 * LOOK.SUSP_DAMP * omega * sp.vy) * dt;
        sp.y += sp.vy * dt;
        const travel = Math.max(0, LOOK.SUSP_TRAVEL);
        if (Math.abs(sp.y) > travel) {
            sp.y = Math.sign(sp.y) * travel;
            sp.vy *= -0.3;
        }
        sp.x = 0;
        sp.tilt = 0;
        return sp;
    }

    /** Seconds of exhaust flame left, and how big this one is (0 to 1). */
    private flame = 0;
    private flameSize = 1;

    /** A backfire: a burst of flame from the exhaust, `size` 0 to 1. */
    backfire(size = 1): void {
        this.flame = LOOK.BACKFIRE_MS / 1000;
        this.flameSize = size;
    }

    /** Called each step: the flame burns out. */
    tick(dt: number): void {
        this.flame = Math.max(0, this.flame - dt);
    }

    /** Flame from the back of the car: a hot core and orange tongues that flicker and shrink as it burns out. */
    private drawBackfire(g: Phaser.GameObjects.Graphics, x: number, y: number, heading: number): void {
        if (this.flame <= 0 || LOOK.BACKFIRE_MS <= 0) return;
        const k = LOOK.CAR_SIZE;
        const life = this.flame / (LOOK.BACKFIRE_MS / 1000);
        const size = LOOK.BACKFIRE_SIZE * this.flameSize * (0.4 + 0.6 * life);
        const back = { x: x - Math.cos(heading) * 2.3 * k, y: y - Math.sin(heading) * 2.3 * k };
        const flicker = 0.75 + 0.25 * Math.sin(this.flame * 90);
        for (const [reach, radius, colour, alpha] of [[2.4, 0.55, 0xff5a1a, 0.75], [1.5, 0.45, 0xffa030, 0.9], [0.7, 0.32, 0xfff0a0, 1]] as const) {
            const d = reach * size * flicker * k;
            const p = iso(back.x - Math.cos(heading) * d, back.y - Math.sin(heading) * d, 0.55 * k);
            g.fillStyle(colour, alpha * life).fillCircle(p.x, p.y, radius * size * k * LOOK.SCALE * 1.4);
        }
    }

    /** When the car last reached the green (for the flash), and whether it's in it now. */
    private greenSince = -1;
    private wasLocked = false;

    /**
     * The rev bar on the car itself: black at rest, a white tint growing
     * through the white; reaching the green, a bright flash, then green, turning
     * orange as the engine heats and flashing red, faster and faster, before
     * it overheats; a dull throbbing red while stalled. (The steering shows
     * only on the STERZO bar, not on the car.)
     */
    private revsTint(state: DonutState): { colour: number; alpha: number } {
        const t = state.steps / 60;
        if (state.locked && !this.wasLocked) this.greenSince = t;
        this.wasLocked = state.locked;
        const flash = (perSecond: number) => 0.5 + 0.5 * Math.sin(t * perSecond * Math.PI * 2);
        const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
        // Stalled after overheating: a dull red, slowly throbbing, as it coasts home
        if (state.stalled) return { colour: COLOURS.tintRed, alpha: LOOK.TINT_STALL * (0.5 + 0.5 * flash(1.5)) };
        if (!state.locked) return { colour: COLOURS.tintWhite, alpha: LOOK.TINT_WHITE * whiteShare(state) };
        // Just reached the green: a bright flash fading into the green
        const sinceGreen = t - this.greenSince;
        if (sinceGreen < 0.35) {
            const u = 1 - sinceGreen / 0.35;
            return { colour: mix(COLOURS.tintGreen, 0xffffff, u), alpha: Math.max(LOOK.TINT_GREEN, LOOK.GREEN_FLASH * u) };
        }
        if (state.heat < 0.5) return { colour: COLOURS.tintGreen, alpha: LOOK.TINT_GREEN * (0.85 + 0.15 * flash(1.5)) };
        if (state.heat < 0.75) {
            const u = (state.heat - 0.5) / 0.25;
            return { colour: mix(COLOURS.tintGreen, COLOURS.tintHot, u), alpha: lerp(LOOK.TINT_GREEN, LOOK.TINT_HOT, u) };
        }
        // About to overheat: red flashes, quicker the hotter it gets
        const u = flash(LOOK.HOT_FLASH * (0.5 + (state.heat - 0.75) / 0.25));
        return { colour: mix(COLOURS.tintHot, COLOURS.tintRed, u), alpha: lerp(LOOK.TINT_HOT, LOOK.TINT_RED, u) };
    }

    destroy(): void {
        this.ground.destroy();
        this.rubber.destroy();
        this.brush.destroy();
        this.fader.destroy();
        this.graphics.destroy();
        this.front.destroy();
        this.wheels?.destroy();
        this.body?.destroy();
        this.bodyTint?.destroy();
    }
}

// ─── The junction ───

function drawJunction(g: Phaser.GameObjects.Graphics): void {
    const H = JUNCTION.ROAD_HALF_WIDTH;
    const { CROSSING_AT, CROSSING_WIDTH } = JUNCTION;
    const R = ROAD_REACH;
    g.fillStyle(COLOURS.pavement).fillRect(0, 0, 1920, 1080);
    // Paving lines, so the ground reads as a surface
    for (let i = -R; i <= R; i += 4) {
        line(g, COLOURS.pavementLine, 1, i, -R, i, R);
        line(g, COLOURS.pavementLine, 1, -R, i, R, i);
    }

    // Kerbs, then the two roads crossing
    groundRect(g, COLOURS.kerb, -R, -H - 0.4, R, H + 0.4);
    groundRect(g, COLOURS.kerb, -H - 0.4, -R, H + 0.4, R);
    groundRect(g, COLOURS.road, -R, -H, R, H);
    groundRect(g, COLOURS.road, -H, -R, H, R);

    // Dashed centre lines, beyond the crossings
    const clear = CROSSING_AT + CROSSING_WIDTH / 2 + 1.5;
    for (let d = clear; d < R; d += 4) {
        for (const side of [-1, 1]) {
            groundRect(g, COLOURS.lane, side * d, -0.12, side * (d + 2), 0.12);
            groundRect(g, COLOURS.lane, -0.12, side * d, 0.12, side * (d + 2));
        }
    }

    // Zebra crossings on the four arms: stripes along the road, across its width
    const half = CROSSING_WIDTH / 2;
    for (let s = -H + 0.4; s < H - 0.4; s += 1.4) {
        groundRect(g, COLOURS.zebra, s, -CROSSING_AT - half, s + 0.8, -CROSSING_AT + half);
        groundRect(g, COLOURS.zebra, s, CROSSING_AT - half, s + 0.8, CROSSING_AT + half);
        groundRect(g, COLOURS.zebra, -CROSSING_AT - half, s, -CROSSING_AT + half, s + 0.8);
        groundRect(g, COLOURS.zebra, CROSSING_AT - half, s, CROSSING_AT + half, s + 0.8);
    }

    // Blocks of buildings on the far corners, farthest first; the near corner stays open
    const blocks: [number, number, number, number, number][] = [
        [-40, -40, -H - 5, -H - 5, 8],
        [H + 5, -38, 34, -H - 5, 6],
        [-36, H + 5, -H - 5, 32, 5],
    ];
    blocks.forEach(([x1, y1, x2, y2, h], i) => box(g, COLOURS.building[i % COLOURS.building.length], x1, y1, x2, y2, 0, h));
}

/** A flat rectangle on the ground, x1..x2 by y1..y2. */
function groundRect(g: Phaser.GameObjects.Graphics, colour: number, x1: number, y1: number, x2: number, y2: number, z = 0): void {
    const points = [iso(x1, y1, z), iso(x2, y1, z), iso(x2, y2, z), iso(x1, y2, z)];
    g.fillStyle(colour).fillPoints(points, true);
}

function line(g: Phaser.GameObjects.Graphics, colour: number, width: number, x1: number, y1: number, x2: number, y2: number): void {
    const a = iso(x1, y1);
    const b = iso(x2, y2);
    g.lineStyle(width, colour, 0.5).lineBetween(a.x, a.y, b.x, b.y);
}

/** An axis-aligned box: the two sides facing the camera, then the top. */
function box(g: Phaser.GameObjects.Graphics, colour: number, x1: number, y1: number, x2: number, y2: number, z1: number, z2: number): void {
    g.fillStyle(shade(colour, 0.78)).fillPoints([iso(x2, y1, z1), iso(x2, y2, z1), iso(x2, y2, z2), iso(x2, y1, z2)], true);
    g.fillStyle(shade(colour, 0.9)).fillPoints([iso(x1, y2, z1), iso(x2, y2, z1), iso(x2, y2, z2), iso(x1, y2, z2)], true);
    g.fillStyle(colour).fillPoints([iso(x1, y1, z2), iso(x2, y1, z2), iso(x2, y2, z2), iso(x1, y2, z2)], true);
}

// ─── The car and the people ───

/**
 * A box turned to `heading`: its corners on the ground at `x`,`y`, the sides
 * facing the camera drawn, then the top.
 */
function turnedBox(g: Phaser.GameObjects.Graphics, colour: number, x: number, y: number, heading: number,
    length: number, width: number, z1: number, z2: number, shift = 0): void {
    const c = Math.cos(heading);
    const s = Math.sin(heading);
    const corner = (along: number, across: number) => ({ x: x + (along + shift) * c - across * s, y: y + (along + shift) * s + across * c });
    const corners = [corner(length / 2, width / 2), corner(length / 2, -width / 2), corner(-length / 2, -width / 2), corner(-length / 2, width / 2)];
    // A side faces the camera when its outward normal points towards +x +y (down the screen)
    for (let i = 0; i < 4; i++) {
        const a = corners[i];
        const b = corners[(i + 1) % 4];
        const nx = b.y - a.y;
        const ny = -(b.x - a.x);
        if (nx + ny <= 0) continue;
        const light = 0.72 + 0.2 * (nx / Math.hypot(nx, ny) + 1) / 2;
        g.fillStyle(shade(colour, light)).fillPoints([iso(a.x, a.y, z1), iso(b.x, b.y, z1), iso(b.x, b.y, z2), iso(a.x, a.y, z2)], true);
    }
    g.fillStyle(colour).fillPoints(corners.map(p => iso(p.x, p.y, z2)), true);
}

function drawCar(g: Phaser.GameObjects.Graphics, x: number, y: number, heading: number, body: number): void {
    // Shadow, body, cabin set back, and headlights on the nose so the heading reads
    const k = LOOK.CAR_SIZE;
    const shadow = iso(x, y);
    g.fillStyle(COLOURS.shadow, 0.28).fillEllipse(shadow.x, shadow.y, 5.2 * k * isoX(), 5.2 * k * isoY());
    turnedBox(g, body, x, y, heading, 4.4 * k, 1.9 * k, 0.25 * k, 1.0 * k);
    turnedBox(g, COLOURS.cabin, x, y, heading, 2.1 * k, 1.65 * k, 1.0 * k, 1.55 * k, -0.35 * k);
    const c = Math.cos(heading);
    const s = Math.sin(heading);
    for (const side of [-0.6 * k, 0.6 * k]) {
        const lx = x + 2.2 * k * c - side * s;
        const ly = y + 2.2 * k * s + side * c;
        const p = iso(lx, ly, 0.75 * k);
        g.fillStyle(0xfff3b0).fillCircle(p.x, p.y, 3.5 * k);
    }
}

/** A cube of `size` metres centred on x, y, `z` metres up: the two sides facing the camera, then the top, at `alpha`. */
function voxel(g: Phaser.GameObjects.Graphics, x: number, y: number, z: number, size: number, colour: number, alpha: number): void {
    const h = size / 2;
    const x1 = x - h, x2 = x + h, y1 = y - h, y2 = y + h, z1 = z, z2 = z + size;
    g.fillStyle(shade(colour, 0.78), alpha).fillPoints([iso(x2, y1, z1), iso(x2, y2, z1), iso(x2, y2, z2), iso(x2, y1, z2)], true);
    g.fillStyle(shade(colour, 0.9), alpha).fillPoints([iso(x1, y2, z1), iso(x2, y2, z1), iso(x2, y2, z2), iso(x1, y2, z2)], true);
    g.fillStyle(colour, alpha).fillPoints([iso(x1, y1, z2), iso(x2, y1, z2), iso(x2, y2, z2), iso(x1, y2, z2)], true);
}

function drawPedestrian(g: Phaser.GameObjects.Graphics, p: Pedestrian, x: number, y: number): void {
    const colour = p.kind === 'walker' ? COLOURS.walker : COLOURS.booster;
    const at = iso(x, y);
    g.fillStyle(COLOURS.shadow, 0.25).fillEllipse(at.x, at.y, 1.2 * isoX(), 1.2 * isoY());
    if (p.hit) {
        // Knocked flat, fading
        const fade = Math.max(0, p.hitTimer / 0.8);
        g.fillStyle(colour, fade).fillPoints([iso(x - 0.9, y - 0.3, 0.2), iso(x + 0.9, y - 0.3, 0.2), iso(x + 0.9, y + 0.3, 0.2), iso(x - 0.9, y + 0.3, 0.2)], true);
        return;
    }
    box(g, colour, x - 0.3, y - 0.3, x + 0.3, y + 0.3, 0, 1.4);
    box(g, 0xf2d3b3, x - 0.22, y - 0.22, x + 0.22, y + 0.22, 1.4, 1.8);
}

/** From colour `a` to `b`, `amount` 0 to 1. */
function mix(a: number, b: number, amount: number): number {
    const t = Math.max(0, Math.min(1, amount));
    const channel = (shift: number) => Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t);
    return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

function shade(colour: number, amount: number): number {
    const r = Math.round(((colour >> 16) & 255) * amount);
    const gr = Math.round(((colour >> 8) & 255) * amount);
    const b = Math.round((colour & 255) * amount);
    return (Math.min(255, r) << 16) | (Math.min(255, gr) << 8) | Math.min(255, b);
}

/**
 * The drawn heading: along the circle with the nose swung into it, the
 * balance rocking it and the revs swinging the tail out a little more,
 * whirling round in a testacoda.
 */
export function carHeading(state: DonutState, angle: number): number {
    const degrees = Math.PI / 180;
    const drift = (LOOK.NOSE_IN + state.slip * LOOK.SLIP_SWING + state.revs * LOOK.REV_SWING) * degrees;
    const spin = state.spinning > 0 ? (DONUT.SPIN_SECONDS - state.spinning) * LOOK.SPIN_TURN * degrees : 0;
    return angle + Math.PI / 2 + drift + spin;
}
