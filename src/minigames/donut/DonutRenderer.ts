import Phaser from 'phaser';
import { LOOK } from './DonutLook';
import { DONUT, JUNCTION, pedestrianPosition, whiteShare, type DonutState, type Pedestrian } from './DonutSim';

/**
 * Draws DERAPATE from a fixed isometric camera: the junction (roads, zebra
 * crossings, pavements, corner blocks) once; the rubber the tyres lay on the
 * road; the car from Riccardo's renders (the wheels, and the body on its
 * springs over them, tinted by the revs); the people; the tyre smoke (little
 * cubes) and the exhaust flame. Nearer the camera is drawn over farther.
 *
 * Everything drawn every frame goes straight from numbers to the Graphics as
 * triangles (no throwaway point objects, here or in Phaser's renderer), and
 * the smoke's cubes are recycled.
 */

/** How far the road runs out from the centre (off screen). */
const ROAD_REACH = 70;
/** The most smoke cubes in the air at once. */
const SMOKE_MAX = 800;
/** The car is drawn as long as Riccardo's renders' car is (4.4 m), times LOOK.CAR_SIZE. */
const CAR_LENGTH_M = 4.4;
/** How far behind the car's centre the exhaust is (metres before the car's size). */
const EXHAUST_BACK = 2.3;
/** How often the old rubber is rubbed out a little (seconds). */
const FADE_EVERY = 2;
/** How long the car flashes on reaching the green (seconds). */
const GREEN_FLASH_SECONDS = 0.35;

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
    /** The revs shown on the car (see revsTint). */
    tintWhite: 0xf2efe6,
    tintGreen: 0x4cff8a,
    tintHot: 0xffa040,
    tintRed: 0xff3a2e,
    /** The people: navy blue cost you, white give a boost; their heads. */
    walker: 0x23306b,
    booster: 0xf4f2ec,
    skin: 0xf2d3b3,
    shadow: 0x000000,
    smoke: 0xe4e4e8,
    flame: [0xff5a1a, 0xffa030, 0xfff0a0],
};

/**
 * The car's sprite sheets (scripts/donut-car-sprites.py: Riccardo's renders of the
 * car turning on the spot), the body and the wheels as separate layers with the
 * same frames, and what their JSON says: frame size and how many frames in a
 * row, where the car's centre on the ground is in a frame, which frame faces
 * straight down the screen (heading 45°), degrees per frame (the frames turn
 * the other way round as they go), and the car's length in a frame's pixels.
 */
const CAR_SHEET = {
    body: 'donut_car_body', bodyPath: 'assets/donut/car_body.webp',
    wheels: 'donut_car_wheels', wheelsPath: 'assets/donut/car_wheels.webp',
    json: 'donut_car_info', jsonPath: 'assets/donut/car.json',
};
interface CarSheetInfo {
    frameWidth: number;
    frameHeight: number;
    frames: number;
    columns: number;
    pivotX: number;
    pivotY: number;
    noseDownFrame: number;
    degreesPerFrame: number;
    lengthPx: number;
}

/** Load the car's sheets and their JSON (in the scene's preload). */
export function preloadDonutCar(scene: Phaser.Scene): void {
    scene.load.json(CAR_SHEET.json, CAR_SHEET.jsonPath);
    scene.load.image(CAR_SHEET.body, CAR_SHEET.bodyPath);
    scene.load.image(CAR_SHEET.wheels, CAR_SHEET.wheelsPath);
}

/** What a frame shows: the car placed between its last two steps. */
export interface DonutView {
    state: DonutState;
    x: number;
    y: number;
    radius: number;
    /** Which way the car's nose points. */
    heading: number;
    /** Seconds since the last frame (0 while frozen). */
    dt: number;
}

interface Point {
    x: number;
    y: number;
}

/** A cube of smoke: where it is on the ground and how high (metres), its drift, size, age and life, and its faces' colours. */
interface Puff {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    size: number;
    age: number;
    life: number;
    top: number;
    right: number;
    front: number;
}

// ─── The isometric projection ───

/** Across the screen and down it per metre of ground (the camera's scale is LOOK.SCALE). */
const isoX = () => LOOK.SCALE * 0.866;
const isoY = () => LOOK.SCALE * 0.5;

/** A point on the ground (or `z` metres above it) on screen. */
export function iso(x: number, y: number, z = 0): Point {
    return { x: screenX(x, y), y: screenY(x, y, z) };
}

function screenX(x: number, y: number): number {
    return LOOK.CENTRE_X + (x - y) * isoX();
}

function screenY(x: number, y: number, z = 0): number {
    return LOOK.CENTRE_Y + (x + y) * isoY() - z * LOOK.SCALE;
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

export class DonutRenderer {
    private readonly sheet: CarSheetInfo;
    /** The ground and everything fixed on it, drawn once (again when the Lab moves it). */
    private readonly ground: Phaser.GameObjects.Graphics;
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
    /** Where the rear tyres were at the last mark (if they were on the road: else the next mark starts new strips), and a scratch pair for working them out. */
    private readonly lastTyres: [Point, Point] = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
    private tyresDown = false;
    private readonly tyres: [Point, Point] = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
    /** What's farther from the camera than the car (the ring, its shadow, people, smoke), and what's nearer. */
    private readonly back: Phaser.GameObjects.Graphics;
    private readonly front: Phaser.GameObjects.Graphics;
    /** The car: the wheels, the body over them on its springs, and a copy of the body filled with the revs' tint. */
    private readonly wheels: Phaser.GameObjects.Sprite;
    private readonly body: Phaser.GameObjects.Sprite;
    private readonly bodyTint: Phaser.GameObjects.Sprite;
    /** The body's height on its springs (screen px), how fast it's moving, and the speed last frame. */
    private readonly spring = { y: 0, vy: 0, speed: 0 };
    /** The smoke in the air (farthest first once sorted), spent cubes kept to reuse, and the part-cube due. */
    private readonly smoke: Puff[] = [];
    private readonly spareSmoke: Puff[] = [];
    private smokeDue = 0;
    /** Seconds of exhaust flame left, and how big this one is (0 to 1). */
    private flame = 0;
    private flameSize = 1;
    /** When the car last reached the green (for the flash), and whether it's in it now. */
    private greenSince = -1;
    private wasLocked = false;

    constructor(scene: Phaser.Scene) {
        const sheet = scene.cache.json.get(CAR_SHEET.json) as CarSheetInfo;
        this.sheet = sheet;
        cutFrames(scene.textures.get(CAR_SHEET.body), sheet);
        cutFrames(scene.textures.get(CAR_SHEET.wheels), sheet);
        this.ground = scene.add.graphics();
        drawJunction(this.ground);
        const { width, height } = scene.scale;
        this.rubber = scene.add.renderTexture(0, 0, width, height).setOrigin(0, 0);
        this.brush = new Phaser.GameObjects.Graphics(scene);
        this.fader = new Phaser.GameObjects.Graphics(scene);
        this.back = scene.add.graphics();
        const originX = sheet.pivotX / sheet.frameWidth;
        const originY = sheet.pivotY / sheet.frameHeight;
        this.wheels = scene.add.sprite(0, 0, CAR_SHEET.wheels, 0).setOrigin(originX, originY);
        this.body = scene.add.sprite(0, 0, CAR_SHEET.body, 0).setOrigin(originX, originY);
        this.bodyTint = scene.add.sprite(0, 0, CAR_SHEET.body, 0).setOrigin(originX, originY);
        this.front = scene.add.graphics();
    }

    /**
     * Called each step with the car: a strip of rubber under each rear tyre from
     * where it was, darker the harder the wheels spin (`strength` 0 to 1; 0 lifts
     * the tyres off: the next mark starts a new strip).
     */
    addMarks(x: number, y: number, heading: number, strength: number): void {
        if (strength <= 0) {
            this.tyresDown = false;
            return;
        }
        const tyres = this.rearTyres(x, y, heading);
        const width = LOOK.MARK_WIDTH * carScale();
        for (let i = 0; i < 2; i++) {
            const tyre = tyres[i];
            const last = this.lastTyres[i];
            const fromX = last.x;
            const fromY = last.y;
            last.x = tyre.x;
            last.y = tyre.y;
            const dx = tyre.x - fromX;
            const dy = tyre.y - fromY;
            const length = Math.hypot(dx, dy);
            if (!this.tyresDown || length < 1e-4 || length > 2) continue;
            // A strip as wide as the tyre on the ground, a little ragged; a darker core where it bites hardest
            const nx = -dy / length;
            const ny = dx / length;
            const alpha = Math.min(1, LOOK.MARK_DARKNESS * strength * (0.8 + 0.2 * Math.random()));
            for (const [share, a] of MARK_LAYERS) {
                const h = (width * share * (0.9 + 0.2 * Math.random())) / 2;
                this.brush.fillStyle(COLOURS.marks, alpha * a);
                groundQuad(this.brush, fromX + nx * h, fromY + ny * h, tyre.x + nx * h, tyre.y + ny * h,
                    tyre.x - nx * h, tyre.y - ny * h, fromX - nx * h, fromY - ny * h);
            }
            this.brushDirty = true;
        }
        this.tyresDown = true;
    }

    /** The junction again, after the Lab changed its size or the camera (the rubber can't follow: it's cleared). */
    redrawGround(): void {
        drawJunction(this.ground.clear());
        this.reset();
    }

    /** A fresh start: no rubber on the road, no smoke, no flame, the springs at rest. */
    reset(): void {
        this.rubber.clear();
        this.brush.clear();
        this.brushDirty = false;
        this.tyresDown = false;
        this.spareSmoke.push(...this.smoke);
        this.smoke.length = 0;
        this.smokeDue = 0;
        this.flame = 0;
        this.spring.y = this.spring.vy = 0;
    }

    /** A backfire: a burst of flame from the exhaust, `size` 0 to 1. */
    backfire(size = 1): void {
        this.flame = LOOK.BACKFIRE_MS / 1000;
        this.flameSize = size;
    }

    /** A jolt to the suspension (a hit, a testacoda): the body bounces, `strength` 0 to 1. */
    bump(strength = 1): void {
        this.spring.vy += LOOK.SUSP_BUMP * strength * 12;
    }

    draw(view: DonutView): void {
        const dt = Math.min(0.05, view.dt);
        const g = this.back.clear();
        const f = this.front.clear();
        this.layRubber(dt);
        this.flame = Math.max(0, this.flame - dt);

        // Where the donut runs now, faintly
        g.lineStyle(2, COLOURS.ring, LOOK.RING).beginPath();
        for (let i = 0; i <= 64; i++) {
            const angle = (i / 64) * Math.PI * 2;
            const x = DONUT.CENTRE_X + Math.cos(angle) * view.radius;
            const y = DONUT.CENTRE_Y + Math.sin(angle) * view.radius;
            if (i === 0) g.moveTo(screenX(x, y), screenY(x, y));
            else g.lineTo(screenX(x, y), screenY(x, y));
        }
        g.strokePath();

        // The car's shadow, then everything split by depth: farther than the car behind it, nearer over it
        const carDepth = view.x + view.y;
        const k = carScale();
        const groundX = screenX(view.x, view.y);
        const groundY = screenY(view.x, view.y);
        g.fillStyle(COLOURS.shadow, LOOK.CAR_SHADOW);
        flatEllipse(g, groundX, groundY, 4.6 * k * isoX(), 4.6 * k * isoY());
        drawPeople(view.state.pedestrians, g, f, carDepth);
        // The exhaust flame goes over the car when the rear points towards the camera, behind it otherwise
        const rearNearer = Math.cos(view.heading) + Math.sin(view.heading) < 0;
        this.drawFlame(rearNearer ? f : g, view.x, view.y, view.heading);
        this.updateSmoke(view, dt);
        this.drawSmoke(g, f, carDepth);

        // The car: the frame for its heading, as long as the renders' car times its size; the body on its springs
        const sheet = this.sheet;
        const degrees = (view.heading * 180) / Math.PI;
        const frame = wrap(Math.round(sheet.noseDownFrame + (45 - degrees) / sheet.degreesPerFrame), sheet.frames);
        const scale = (CAR_LENGTH_M * LOOK.CAR_SIZE * LOOK.SCALE / sheet.lengthPx) * LOOK.CAR_SPRITE_SCALE;
        const y = groundY + LOOK.CAR_SPRITE_Y;
        const bodyY = y + this.suspension(view, dt);
        const tint = this.revsTint(view.state);
        this.wheels.setPosition(groundX, y).setScale(scale).setFrame(frame);
        this.body.setPosition(groundX, bodyY).setScale(scale).setFrame(frame);
        this.bodyTint.setVisible(tint.alpha > 0.01);
        if (tint.alpha > 0.01) {
            this.bodyTint.setPosition(groundX, bodyY).setScale(scale).setFrame(frame).setTintFill(tint.colour).setAlpha(tint.alpha);
        }
    }

    destroy(): void {
        this.ground.destroy();
        this.rubber.destroy();
        this.brush.destroy();
        this.fader.destroy();
        this.back.destroy();
        this.front.destroy();
        this.wheels.destroy();
        this.body.destroy();
        this.bodyTint.destroy();
    }

    /** Where the two rear tyres touch the ground, for the car at x, y pointing along `heading` (a scratch pair: copy to keep). */
    private rearTyres(x: number, y: number, heading: number): readonly [Point, Point] {
        const k = carScale();
        const c = Math.cos(heading);
        const s = Math.sin(heading);
        const back = LOOK.REAR_AXLE * k;
        const side = LOOK.HALF_TRACK * k;
        this.tyres[0].x = x - c * back + s * side;
        this.tyres[0].y = y - s * back - c * side;
        this.tyres[1].x = x - c * back - s * side;
        this.tyres[1].y = y - s * back + c * side;
        return this.tyres;
    }

    /** The new rubber onto the road, and every couple of seconds the old rubbed out a little. */
    private layRubber(dt: number): void {
        if (this.brushDirty) {
            this.rubber.draw(this.brush);
            this.brush.clear();
            this.brushDirty = false;
        }
        this.fadeDue += dt;
        if (this.fadeDue < FADE_EVERY || LOOK.MARK_FADE <= 0) return;
        const share = 1 - Math.pow(1 - Math.min(0.99, LOOK.MARK_FADE), this.fadeDue);
        this.fadeDue = 0;
        this.fader.clear().fillStyle(0xffffff, share).fillRect(0, 0, this.rubber.width, this.rubber.height);
        this.rubber.erase(this.fader);
    }

    /**
     * Tyre smoke: puffs of little cubes from the two rear tyres, more the harder
     * the wheels spin (the pedal down and the revs up, the most in a testacoda),
     * none standing still. Each cube kicks back off the tyre, rises, grows and
     * fades. Render only (it doesn't touch the rules).
     */
    private updateSmoke(view: DonutView, dt: number): void {
        if (dt <= 0) return;
        // Age, drift and rise; the spent ones go back to the spare pile (in place, keeping the order)
        let kept = 0;
        for (const puff of this.smoke) {
            puff.age += dt;
            if (puff.age >= puff.life) {
                this.spareSmoke.push(puff);
                continue;
            }
            puff.x += puff.vx * dt;
            puff.y += puff.vy * dt;
            puff.z += LOOK.SMOKE_RISE * dt * (1 - (puff.age / puff.life) * 0.5);
            puff.vx *= 1 - 1.5 * dt;
            puff.vy *= 1 - 1.5 * dt;
            this.smoke[kept++] = puff;
        }
        this.smoke.length = kept;

        const state = view.state;
        const moving = Math.min(1, state.speed / DONUT.SPEED_MAX);
        const pedal = state.lifted === 0 ? 0.25 + 0.75 * state.revs : 0.15 * state.revs;
        const amount = state.stalled ? 0.1 * moving : Math.max(state.spinning > 0 ? 1.5 : 0, pedal * (0.3 + 0.7 * moving));
        if (amount <= 0 || LOOK.SMOKE <= 0) return;
        this.smokeDue += LOOK.SMOKE * amount * dt;
        const c = Math.cos(view.heading);
        const s = Math.sin(view.heading);
        const tyres = this.rearTyres(view.x, view.y, view.heading);
        while (this.smokeDue >= 1 && this.smoke.length < SMOKE_MAX) {
            this.smokeDue -= 1;
            const tyre = tyres[Math.random() < 0.5 ? 0 : 1];
            const kick = 0.8 + Math.random() * 1.2;
            const colour = shade(COLOURS.smoke, 0.85 + Math.random() * 0.15);
            const puff = this.spareSmoke.pop() ?? ({} as Puff);
            puff.x = tyre.x + (Math.random() - 0.5) * 0.4;
            puff.y = tyre.y + (Math.random() - 0.5) * 0.4;
            puff.z = 0.1;
            puff.vx = -c * kick + (Math.random() - 0.5) * 0.6;
            puff.vy = -s * kick + (Math.random() - 0.5) * 0.6;
            puff.size = (0.25 + Math.random() * 0.25) * LOOK.SMOKE_SIZE;
            puff.age = 0;
            puff.life = LOOK.SMOKE_LIFE * (0.7 + Math.random() * 0.6);
            puff.top = colour;
            puff.right = shade(colour, 0.78);
            puff.front = shade(colour, 0.9);
            this.smoke.push(puff);
        }
        if (this.smoke.length >= SMOKE_MAX) this.smokeDue = 0;
    }

    /** The smoke cubes, farthest first: those farther than `depth` (the car) on `behind`, the rest on `front`. */
    private drawSmoke(behind: Phaser.GameObjects.Graphics, front: Phaser.GameObjects.Graphics, depth: number): void {
        this.smoke.sort(byDepth);
        for (const puff of this.smoke) {
            const t = puff.age / puff.life;
            // Thickest just after it appears, then thinning out as it grows
            const alpha = LOOK.SMOKE_OPACITY * Math.min(1, t * 8) * (1 - t) * (1 - t);
            if (alpha < 0.01) continue;
            voxel(puff.x + puff.y > depth ? front : behind, puff, puff.size * (1 + 3 * t), alpha);
        }
    }

    /**
     * The body on its springs: it only travels straight up and down over the
     * wheels (sliding or tilting it would pull the arches off them), at most
     * LOOK.SUSP_TRAVEL px. Loaded going round, it sits lower; speeding up it
     * lifts, slowing it dips; at speed it rumbles; bumps bounce it. A spring and
     * a damper bring it back (LOOK.SUSP_FREQ, LOOK.SUSP_DAMP). Returns its height (px).
     */
    private suspension(view: DonutView, dt: number): number {
        const sp = this.spring;
        if (dt <= 0) return sp.y;
        const state = view.state;
        // Going round: how hard (1 at top speed on the widest donut)
        const top = (DONUT.SPEED_MAX * DONUT.SPEED_MAX) / DONUT.RADIUS_MAX;
        const cornering = state.spinning > 0 ? 0 : Math.min(1.5, (state.speed * state.speed) / Math.max(1, view.radius) / top);
        // Speeding up or slowing down (1 for a second from standing to top speed)
        const accel = Phaser.Math.Clamp((state.speed - sp.speed) / dt / DONUT.SPEED_MAX, -2, 2);
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
        return sp.y;
    }

    /** Flame from the back of the car: a hot core and orange tongues that flicker and shrink as it burns out. */
    private drawFlame(g: Phaser.GameObjects.Graphics, x: number, y: number, heading: number): void {
        if (this.flame <= 0 || LOOK.BACKFIRE_MS <= 0) return;
        const k = carScale();
        const life = this.flame / (LOOK.BACKFIRE_MS / 1000);
        const size = LOOK.BACKFIRE_SIZE * this.flameSize * (0.4 + 0.6 * life);
        const c = Math.cos(heading);
        const s = Math.sin(heading);
        const flicker = 0.75 + 0.25 * Math.sin(this.flame * 90);
        FLAME_TONGUES.forEach(([reach, radius, alpha], i) => {
            const d = EXHAUST_BACK * k + reach * size * flicker * k;
            g.fillStyle(COLOURS.flame[i], alpha * life)
                .fillCircle(screenX(x - c * d, y - s * d), screenY(x - c * d, y - s * d, 0.55 * k), radius * size * k * LOOK.SCALE * 1.4);
        });
    }

    /**
     * The rev bar on the car itself: a white tint growing through the white;
     * reaching the green, a flash, then green, turning orange as the engine
     * heats and flashing red, faster and faster, before it overheats; a dull
     * throbbing red while stalled. (Each tint's opacity is in LOOK.)
     */
    private revsTint(state: DonutState): { colour: number; alpha: number } {
        const t = state.steps / 60;
        if (state.locked && !this.wasLocked) this.greenSince = t;
        this.wasLocked = state.locked;
        const flash = (perSecond: number) => 0.5 + 0.5 * Math.sin(t * perSecond * Math.PI * 2);
        const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
        if (state.stalled) return { colour: COLOURS.tintRed, alpha: LOOK.TINT_STALL * (0.5 + 0.5 * flash(1.5)) };
        if (!state.locked) return { colour: COLOURS.tintWhite, alpha: LOOK.TINT_WHITE * whiteShare(state) };
        const sinceGreen = t - this.greenSince;
        if (sinceGreen < GREEN_FLASH_SECONDS) {
            const u = 1 - sinceGreen / GREEN_FLASH_SECONDS;
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
}

/** The two layers of a tyre mark: share of the tyre's width, and of the mark's darkness (the strip, then its core). */
const MARK_LAYERS: readonly (readonly [number, number])[] = [[1, 0.6], [0.45, 0.55]];
/** The flame's three tongues, outer to inner: how far back (metres per size), how wide, how opaque. */
const FLAME_TONGUES: readonly (readonly [number, number, number])[] = [[2.4, 0.55, 0.75], [1.5, 0.45, 0.9], [0.7, 0.32, 1]];

/** How much bigger than life the car is drawn: the size the rear tyres, marks, smoke and flame follow. */
function carScale(): number {
    return LOOK.CAR_SIZE * LOOK.CAR_SPRITE_SCALE;
}

function byDepth(a: { x: number; y: number }, b: { x: number; y: number }): number {
    return a.x + a.y - (b.x + b.y);
}

function wrap(value: number, length: number): number {
    return ((value % length) + length) % length;
}

/** Cut a sheet into its numbered frames, row by row as car.json says (once: the texture keeps them). */
function cutFrames(texture: Phaser.Textures.Texture, sheet: CarSheetInfo): void {
    if (texture.has('0')) return;
    for (let i = 0; i < sheet.frames; i++) {
        const x = (i % sheet.columns) * sheet.frameWidth;
        const y = Math.floor(i / sheet.columns) * sheet.frameHeight;
        texture.add(i, 0, x, y, sheet.frameWidth, sheet.frameHeight);
    }
}

// ─── The junction ───

function drawJunction(g: Phaser.GameObjects.Graphics): void {
    const H = JUNCTION.ROAD_HALF_WIDTH;
    const { CROSSING_AT, CROSSING_WIDTH } = JUNCTION;
    const R = ROAD_REACH;
    g.fillStyle(COLOURS.pavement).fillRect(0, 0, 1920, 1080);
    // Paving lines, so the ground reads as a surface
    g.lineStyle(1, COLOURS.pavementLine, 0.5);
    for (let i = -R; i <= R; i += 4) {
        g.lineBetween(screenX(i, -R), screenY(i, -R), screenX(i, R), screenY(i, R));
        g.lineBetween(screenX(-R, i), screenY(-R, i), screenX(R, i), screenY(R, i));
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
    blocks.forEach(([x1, y1, x2, y2, h], i) => box(g, COLOURS.building[i % COLOURS.building.length], 1, x1, y1, x2, y2, 0, h));
}

// ─── Drawing on the ground, straight from numbers ───

/**
 * A filled quadrilateral on screen, as two triangles: Phaser's WebGL renderer
 * batches triangles as they come, while a filled path is cut into triangles
 * again every frame, leaving garbage behind. (Under the Canvas renderer a
 * see-through quad could show a hairline along its diagonal; the game runs
 * on WebGL.)
 */
function quad(g: Phaser.GameObjects.Graphics, ax: number, ay: number, bx: number, by: number,
    cx: number, cy: number, dx: number, dy: number): void {
    g.fillTriangle(ax, ay, bx, by, cx, cy);
    g.fillTriangle(ax, ay, cx, cy, dx, dy);
}

/** A filled quadrilateral through four points on the ground (z metres up). */
function groundQuad(g: Phaser.GameObjects.Graphics, ax: number, ay: number, bx: number, by: number,
    cx: number, cy: number, dx: number, dy: number, z = 0): void {
    quad(g, screenX(ax, ay), screenY(ax, ay, z), screenX(bx, by), screenY(bx, by, z),
        screenX(cx, cy), screenY(cx, cy, z), screenX(dx, dy), screenY(dx, dy, z));
}

/** The sides of a flat ellipse (a shadow): round enough, as a fan of triangles. */
const ELLIPSE_SIDES = 32;
const ELLIPSE_COS = Array.from({ length: ELLIPSE_SIDES + 1 }, (_, i) => Math.cos((i / ELLIPSE_SIDES) * Math.PI * 2));
const ELLIPSE_SIN = Array.from({ length: ELLIPSE_SIDES + 1 }, (_, i) => Math.sin((i / ELLIPSE_SIDES) * Math.PI * 2));

/** A filled ellipse on screen, `width` by `height`, as a fan of triangles from its centre (see quad). */
function flatEllipse(g: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number): void {
    const rx = width / 2;
    const ry = height / 2;
    for (let i = 0; i < ELLIPSE_SIDES; i++) {
        g.fillTriangle(x, y, x + ELLIPSE_COS[i] * rx, y + ELLIPSE_SIN[i] * ry, x + ELLIPSE_COS[i + 1] * rx, y + ELLIPSE_SIN[i + 1] * ry);
    }
}

/** A flat rectangle on the ground, x1..x2 by y1..y2. */
function groundRect(g: Phaser.GameObjects.Graphics, colour: number, x1: number, y1: number, x2: number, y2: number): void {
    g.fillStyle(colour);
    groundQuad(g, x1, y1, x2, y1, x2, y2, x1, y2);
}

/** An axis-aligned box: the two sides facing the camera (shaded), then the top. */
function box(g: Phaser.GameObjects.Graphics, colour: number, alpha: number,
    x1: number, y1: number, x2: number, y2: number, z1: number, z2: number): void {
    // The side facing down-right (x2), the side facing down-left (y2), then the top
    g.fillStyle(shade(colour, 0.78), alpha);
    sideX(g, x2, y1, y2, z1, z2);
    g.fillStyle(shade(colour, 0.9), alpha);
    sideY(g, y2, x1, x2, z1, z2);
    g.fillStyle(colour, alpha);
    groundQuad(g, x1, y1, x2, y1, x2, y2, x1, y2, z2);
}

/** A cube of smoke: the same three faces as a box, its colours worked out when it appeared. */
function voxel(g: Phaser.GameObjects.Graphics, puff: Puff, size: number, alpha: number): void {
    const h = size / 2;
    const x1 = puff.x - h, x2 = puff.x + h, y1 = puff.y - h, y2 = puff.y + h, z1 = puff.z, z2 = puff.z + size;
    g.fillStyle(puff.right, alpha);
    sideX(g, x2, y1, y2, z1, z2);
    g.fillStyle(puff.front, alpha);
    sideY(g, y2, x1, x2, z1, z2);
    g.fillStyle(puff.top, alpha);
    groundQuad(g, x1, y1, x2, y1, x2, y2, x1, y2, z2);
}

/** The upright face at x, from y1 to y2 and z1 to z2. */
function sideX(g: Phaser.GameObjects.Graphics, x: number, y1: number, y2: number, z1: number, z2: number): void {
    const ax = screenX(x, y1), bx = screenX(x, y2);
    quad(g, ax, screenY(x, y1, z1), bx, screenY(x, y2, z1), bx, screenY(x, y2, z2), ax, screenY(x, y1, z2));
}

/** The upright face at y, from x1 to x2 and z1 to z2. */
function sideY(g: Phaser.GameObjects.Graphics, y: number, x1: number, x2: number, z1: number, z2: number): void {
    const ax = screenX(x1, y), bx = screenX(x2, y);
    quad(g, ax, screenY(x1, y, z1), bx, screenY(x2, y, z1), bx, screenY(x2, y, z2), ax, screenY(x1, y, z2));
}

// ─── The people ───

/** The people, farthest first: those farther than `depth` (the car) on `behind`, the rest on `front`. */
function drawPeople(people: readonly Pedestrian[], behind: Phaser.GameObjects.Graphics, front: Phaser.GameObjects.Graphics, depth: number): void {
    const placed = people.map(p => ({ p, ...pedestrianPosition(p) })).sort(byDepth);
    for (const { p, x, y } of placed) drawPedestrian(x + y > depth ? front : behind, p, x, y);
}

/** A person: a body and a head as blocks; knocked down, flat on the road, fading. */
function drawPedestrian(g: Phaser.GameObjects.Graphics, p: Pedestrian, x: number, y: number): void {
    const colour = p.kind === 'walker' ? COLOURS.walker : COLOURS.booster;
    g.fillStyle(COLOURS.shadow, 0.25);
    flatEllipse(g, screenX(x, y), screenY(x, y), 1.2 * isoX(), 1.2 * isoY());
    if (p.hit) {
        g.fillStyle(colour, Math.max(0, p.hitTimer / 0.8));
        groundQuad(g, x - 0.9, y - 0.3, x + 0.9, y - 0.3, x + 0.9, y + 0.3, x - 0.9, y + 0.3, 0.2);
        return;
    }
    box(g, colour, 1, x - 0.3, y - 0.3, x + 0.3, y + 0.3, 0, 1.4);
    box(g, COLOURS.skin, 1, x - 0.22, y - 0.22, x + 0.22, y + 0.22, 1.4, 1.8);
}

// ─── Colours ───

/** From colour `a` to `b`, `amount` 0 to 1. */
function mix(a: number, b: number, amount: number): number {
    const t = Phaser.Math.Clamp(amount, 0, 1);
    const channel = (shift: number) => Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t);
    return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

/** `colour` darker (under 1) or lighter (over 1). */
function shade(colour: number, amount: number): number {
    const channel = (shift: number) => Math.min(255, Math.round(((colour >> shift) & 255) * amount));
    return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}
