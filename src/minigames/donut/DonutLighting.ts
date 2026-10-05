import Phaser from 'phaser';
import { AtmospherePipeline, type AtmosphereFrame, type AtmosphereLook } from '../../lighting/AtmospherePipeline';
import { createGlowTextures, GLOW_TEXTURES } from '../../lighting/Lighting';
import { LitPipeline, MAX_LIGHTS } from '../../lighting/LitPipeline';
import { GROUND_FALLOFF, isoX, isoY, screenX, screenY } from './DonutIso';
import { LAMPS, LIGHT, MAX_LAMPS, colourParts, coneShare, falloff } from './DonutLight';
import { LOOK } from './DonutLook';

/**
 * DERAPATE's lights on screen, with the fighting game's shaders (see
 * src/lighting): the street lamps, the car's headlights (two cones) and tail
 * lights, the exhaust flame's light and flashes where people are hit.
 *
 * - The junction and the rubber on it are lit per pixel ('ground'), each
 *   light's pool an ellipse on the isometric ground.
 * - The car's renders are lit per pixel too ('car'), with a rim on the edges
 *   facing each light, coming from the lamp's head; its own lights don't
 *   light it.
 * - The people, the smoke and the lamp posts are lit per face by the renderer
 *   (lightAt), from the same lights.
 * - The camera's atmosphere pass adds bloom, grading, vignette, grain, colour
 *   fringes, tilt-shift and CRT; the HUD's camera has none of it.
 *
 * Drawing only. Switched off (the Lab's G, or the phone's LUCI button, which
 * is remembered), DERAPATE is drawn as before.
 */

export type LitGroup = 'ground' | 'car';

/** Anything with a texture that can take a pipeline. */
export type LitObject = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Pipeline;

/** Where the car and its lights are this frame (ground metres), and how much its exhaust flame burns (0 out). */
export interface CarLights {
    x: number;
    y: number;
    heading: number;
    flame: number;
    exhaustX: number;
    exhaustY: number;
}

export type FlashKind = 'boost' | 'hit';

const PIPELINES: Record<LitGroup, string> = { ground: 'DonutGround', car: 'DonutCar' };
const LIGHTS_OFF_KEY = 'sgalalla.donutLightsOff';
const ATMOSPHERE_KEY = 'Atmosphere';
const FLASH_COLOURS: Record<FlashKind, number> = { boost: 0xcfe6ff, hit: 0xffffff };
const FLAME_COLOUR = 0xff8a3a;
/** The car's lights sit this high (metres, before the car's size), and the car is lit as if at this height. */
const CAR_LIGHT_HEIGHT = 0.5;
/** The headlights are this far ahead of the car's centre and either side of it, the tail lights this far behind (metres, before the car's size). */
const HEAD_FRONT = 1.9;
const HEAD_SIDE = 0.62;
const TAIL_BACK = 2.2;
/** A headlight's beam is full inside this share of its spread, fading out to the edge. */
const BEAM_CORE = 0.55;
/** The lamps' glows: the orb and the glow round each head (metres). */
const ORB_SIZE = 1.1;
const HALO_SIZE = 7;
const MAX_FLASHES = 3;

/**
 * A light this frame: the ground point it lights from, its height, reach
 * (metres), colour times strength, whether it lights the car, and the cone it
 * shines in (the way it points on the ground, the cosines of its inner and
 * outer angles; no direction: all round).
 */
interface ActiveLight {
    x: number;
    y: number;
    height: number;
    reach: number;
    rgb: Float32Array;
    car: boolean;
    dirX: number;
    dirY: number;
    cosInner: number;
    cosOuter: number;
}

interface Flash {
    x: number;
    y: number;
    kind: FlashKind;
    ageMs: number;
    lifeMs: number;
}

/** One lit shader's lights this frame, in its uniform layout. */
interface GroupUniforms {
    ambient: Float32Array;
    count: number;
    positions: Float32Array;
    colours: Float32Array;
    rimOffsets: Float32Array;
    cones: Float32Array;
}

export class DonutLighting {
    private readonly camera: Phaser.Cameras.Scene2D.Camera;
    private readonly renderer: Phaser.Renderer.WebGL.WebGLRenderer;
    private readonly pipelines: Record<LitGroup, LitPipeline>;
    private readonly uniforms: Record<LitGroup, GroupUniforms>;
    private readonly lit = new Map<LitObject, LitGroup>();
    private readonly atmosphere: AtmospherePipeline;
    private readonly look: AtmosphereLook;
    private readonly frame: AtmosphereFrame;
    /** This frame's lights (the first `count`), reused frame to frame. */
    private readonly lights: ActiveLight[];
    private count = 0;
    private readonly flashes: Flash[] = [];
    /** The people's ambient light, for lightAt. */
    private readonly peopleAmbient = new Float32Array(3);
    private readonly glows: { orb: Phaser.GameObjects.Image; halo: Phaser.GameObjects.Image }[] = [];
    private enabled = true;

    /** Whether the player wants the lights on (the phone's button switches them off, remembered on this browser). */
    static wanted(): boolean {
        try {
            return localStorage.getItem(LIGHTS_OFF_KEY) !== 'true';
        } catch {
            return true;
        }
    }

    static rememberWanted(on: boolean): void {
        try {
            localStorage.setItem(LIGHTS_OFF_KEY, String(!on));
        } catch {
            // Browser storage unavailable: lights on next time
        }
    }

    /** Lighting needs WebGL with shader derivatives, which nearly every browser has. */
    static isSupported(scene: Phaser.Scene): boolean {
        const renderer = scene.renderer;
        return renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer && renderer.getExtension('OES_standard_derivatives') !== null;
    }

    constructor(scene: Phaser.Scene) {
        this.camera = scene.cameras.main;
        this.renderer = scene.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
        const manager = this.renderer.pipelines;
        for (const key of Object.values(PIPELINES)) {
            if (!manager.has(key)) manager.add(key, new LitPipeline(scene.game));
        }
        this.pipelines = { ground: manager.get(PIPELINES.ground) as LitPipeline, car: manager.get(PIPELINES.car) as LitPipeline };
        for (const pipeline of Object.values(this.pipelines)) pipeline.setFalloffScale(GROUND_FALLOFF.x, GROUND_FALLOFF.y);
        this.uniforms = { ground: groupUniforms(), car: groupUniforms() };
        this.lights = Array.from({ length: MAX_LIGHTS }, () => ({
            x: 0, y: 0, height: 0, reach: 1, rgb: new Float32Array(3), car: false, dirX: 0, dirY: 0, cosInner: 1, cosOuter: 1,
        }));

        this.look = atmosphereLook();
        this.frame = { look: this.look, sunX: 0, sunY: 0, sunReach: 0, rayColor: [0, 0, 0], worldBottom: 0, worldHeight: 1 };
        if (!manager.postPipelineClasses.has(ATMOSPHERE_KEY)) manager.addPostPipeline(ATMOSPHERE_KEY, AtmospherePipeline);
        this.camera.setPostPipeline(ATMOSPHERE_KEY);
        this.atmosphere = this.camera.getPostPipeline(ATMOSPHERE_KEY) as AtmospherePipeline;
        this.atmosphere.frame = this.frame;

        // A bright orb and a soft glow on each lamp's head, drawn over everything
        createGlowTextures(scene);
        for (let i = 0; i < MAX_LAMPS; i++) {
            this.glows.push({
                orb: scene.add.image(0, 0, GLOW_TEXTURES.orb).setBlendMode(Phaser.BlendModes.ADD).setVisible(false),
                halo: scene.add.image(0, 0, GLOW_TEXTURES.halo).setBlendMode(Phaser.BlendModes.ADD).setVisible(false),
            });
        }

        this.renderer.on(Phaser.Renderer.Events.RENDER, this.onRender, this);
    }

    get isEnabled(): boolean {
        return this.enabled;
    }

    /** Draws `object` lit with its group's lights (the wheels touch the ground: no rim on their bottom edge). */
    add(object: LitObject, group: LitGroup, onGround = false): void {
        this.lit.set(object, group);
        if (onGround) this.pipelines[group].setFloorContact(object, 1);
        if (this.enabled) object.setPipeline(PIPELINES[group]);
    }

    /** Off, everything is drawn as it was before lighting. */
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        for (const [object, group] of this.lit) {
            // Gone with its scene: nothing to draw
            if (!object.scene) continue;
            if (enabled) object.setPipeline(PIPELINES[group]);
            else object.resetPipeline();
        }
        this.atmosphere.active = enabled;
    }

    /** A burst of light where someone was hit, fading out. */
    flash(kind: FlashKind, x: number, y: number): void {
        const lifeMs = kind === 'boost' ? LIGHT.BOOST_FLASH_MS : LIGHT.HIT_FLASH_MS;
        if (lifeMs <= 0) return;
        if (this.flashes.length >= MAX_FLASHES) this.flashes.shift();
        this.flashes.push({ x, y, kind, ageMs: 0, lifeMs });
    }

    /** No flashes left (a fresh start). */
    reset(): void {
        this.flashes.length = 0;
    }

    /**
     * This frame's lights, most important first (the shaders take 8): the
     * lamps, the two headlights, the exhaust flame, the flashes, the tail
     * lights. The glows follow the lamps. `dt` in seconds.
     */
    update(car: CarLights, dt: number): void {
        this.count = 0;
        const k = LOOK.CAR_SIZE * LOOK.CAR_SPRITE_SCALE;
        const height = CAR_LIGHT_HEIGHT * k;
        for (let i = 0; i < LAMPS.length && i < MAX_LAMPS; i++) {
            const lamp = LAMPS[i];
            this.addLight(lamp.x, lamp.y, lamp.height, lamp.reach, lamp.colour, lamp.strength * LIGHT.LAMPS, true);
        }
        // Two cones from the front corners, along the way the car points
        const c = Math.cos(car.heading);
        const s = Math.sin(car.heading);
        const spread = (Math.max(1, Math.min(89, LIGHT.HEADLIGHT_SPREAD)) * Math.PI) / 180;
        for (const side of [-1, 1]) {
            const x = car.x + c * HEAD_FRONT * k - s * HEAD_SIDE * k * side;
            const y = car.y + s * HEAD_FRONT * k + c * HEAD_SIDE * k * side;
            const light = this.addLight(x, y, height, LIGHT.HEADLIGHT_REACH, LIGHT.HEADLIGHT_COLOUR, LIGHT.HEADLIGHTS, false);
            if (light) setCone(light, c, s, Math.cos(spread * BEAM_CORE), Math.cos(spread));
        }
        if (car.flame > 0) {
            this.addLight(car.exhaustX, car.exhaustY, height, LIGHT.FLAME_LIGHT_REACH, FLAME_COLOUR, LIGHT.FLAME_LIGHT * car.flame, true);
        }
        // Flashes, newest first (they're the ones dropped when the shaders' lights run out), fading out
        for (let i = this.flashes.length - 1; i >= 0; i--) {
            const flash = this.flashes[i];
            flash.ageMs += dt * 1000;
            if (flash.ageMs >= flash.lifeMs) {
                this.flashes.splice(i, 1);
                continue;
            }
            const left = 1 - flash.ageMs / flash.lifeMs;
            const boost = flash.kind === 'boost';
            this.addLight(flash.x, flash.y, height, boost ? LIGHT.BOOST_FLASH_REACH : LIGHT.HIT_FLASH_REACH,
                FLASH_COLOURS[flash.kind], (boost ? LIGHT.BOOST_FLASH : LIGHT.HIT_FLASH) * left * left, true);
        }
        const back = TAIL_BACK * k;
        this.addLight(car.x - c * back, car.y - s * back, height, LIGHT.TAILLIGHT_REACH, LIGHT.TAILLIGHT_COLOUR, LIGHT.TAILLIGHTS, false);
        colourParts(LIGHT.AMBIENT_COLOUR, LIGHT.AMBIENT_PEOPLE, this.peopleAmbient);
        this.updateGlows();
        copyLook(this.look);
    }

    /**
     * The light falling at `x`, `y` on the ground (metres), as red, green and
     * blue multipliers into `out`: the people's ambient plus every light's
     * share. All 1 while lighting is off.
     */
    lightAt(x: number, y: number, out: Float32Array): void {
        if (!this.enabled) {
            out[0] = out[1] = out[2] = 1;
            return;
        }
        out[0] = this.peopleAmbient[0];
        out[1] = this.peopleAmbient[1];
        out[2] = this.peopleAmbient[2];
        for (let i = 0; i < this.count; i++) {
            const light = this.lights[i];
            let share = falloff(Math.hypot(x - light.x, y - light.y), light.reach);
            if (share > 0 && (light.dirX !== 0 || light.dirY !== 0)) {
                share *= coneShare(x - light.x, y - light.y, light.dirX, light.dirY, light.cosInner, light.cosOuter);
            }
            if (share <= 0) continue;
            out[0] += light.rgb[0] * share;
            out[1] += light.rgb[1] * share;
            out[2] += light.rgb[2] * share;
        }
    }

    destroy(): void {
        this.renderer.off(Phaser.Renderer.Events.RENDER, this.onRender, this);
        this.atmosphere.frame = null;
        this.camera.removePostPipeline(this.atmosphere);
        for (const glow of this.glows) {
            glow.orb.destroy();
            glow.halo.destroy();
        }
        this.lit.clear();
    }

    /** A light shining all round (setCone makes it a cone); null when there's no room or it's off. */
    private addLight(x: number, y: number, height: number, reach: number, colour: number, strength: number, lightsCar: boolean): ActiveLight | null {
        if (this.count >= MAX_LIGHTS || strength <= 0 || reach <= 0) return null;
        const light = this.lights[this.count++];
        light.x = x;
        light.y = y;
        light.height = height;
        light.reach = reach;
        light.car = lightsCar;
        light.dirX = light.dirY = 0;
        colourParts(colour, strength, light.rgb);
        return light;
    }

    private updateGlows(): void {
        const scale = LOOK.SCALE / GLOW_TEXTURES.size;
        this.glows.forEach((glow, i) => {
            const lamp = i < LAMPS.length ? LAMPS[i] : null;
            const brightness = lamp ? lamp.strength * LIGHT.LAMPS : 0;
            const shown = this.enabled && lamp !== null && brightness > 0;
            glow.orb.setVisible(shown);
            glow.halo.setVisible(shown && lamp.glow * LIGHT.HAZE > 0);
            if (!shown) return;
            const x = screenX(lamp.x, lamp.y);
            const y = screenY(lamp.x, lamp.y, lamp.height);
            glow.orb.setPosition(x, y).setTint(lamp.colour).setScale(ORB_SIZE * scale).setAlpha(Math.min(1, brightness));
            glow.halo.setPosition(x, y).setTint(lamp.colour).setScale(HALO_SIZE * scale)
                .setAlpha(Math.min(1, brightness * lamp.glow * LIGHT.HAZE * 0.5));
        });
    }

    /** The lights on screen for this frame's camera (its shake and zoom included), handed to the shaders. */
    private onRender(_scene: Phaser.Scene, camera: Phaser.Cameras.Scene2D.Camera): void {
        if (camera !== this.camera || !this.enabled) return;
        const matrix = cameraMatrix(camera);
        const zoom = camera.zoom;
        const pixels = LOOK.SCALE * zoom;
        const k = LOOK.CAR_SIZE * LOOK.CAR_SPRITE_SCALE;
        const carHeight = CAR_LIGHT_HEIGHT * k;
        const ground = this.uniforms.ground;
        const car = this.uniforms.car;
        ground.count = car.count = 0;

        for (let i = 0; i < this.count; i++) {
            const light = this.lights[i];
            // The ground is lit from the light's foot, the car as if it stood at its own height
            put(ground, matrix, screenX(light.x, light.y), screenY(light.x, light.y), light.reach * pixels, 0, light, 0);
            if (light.car) {
                const rimFrom = -(light.height - carHeight) * pixels;
                put(car, matrix, screenX(light.x, light.y), screenY(light.x, light.y, carHeight), light.reach * pixels, LIGHT.RIM, light, rimFrom);
            }
        }

        colourParts(LIGHT.AMBIENT_COLOUR, LIGHT.AMBIENT_GROUND, ground.ambient);
        colourParts(LIGHT.AMBIENT_COLOUR, LIGHT.AMBIENT_CAR, car.ambient);
        this.pipelines.ground.setLights(ground.ambient, ground.count, ground.positions, ground.colours, 0, undefined, ground.cones);
        this.pipelines.car.setLights(car.ambient, car.count, car.positions, car.colours, LIGHT.RIM_WIDTH, car.rimOffsets, car.cones);
        this.frame.worldBottom = camera.worldView.bottom;
        this.frame.worldHeight = camera.worldView.height;
    }
}

/** Points a light's cone along the ground (`dirX`, `dirY`, a unit vector), full inside the angle whose cosine is `cosInner`, gone at `cosOuter`. */
function setCone(light: ActiveLight, dirX: number, dirY: number, cosInner: number, cosOuter: number): void {
    light.dirX = dirX;
    light.dirY = dirY;
    light.cosInner = cosInner;
    light.cosOuter = cosOuter;
}

/**
 * Adds a light at world pixel `x`, `y` (through the camera's matrix) to a
 * shader's uniforms; its rim comes from `rimFrom` pixels up the screen, and
 * its cone (if any) points the way it does on the ground, in the shader's
 * scaled axes (where angles on the ground stay as they are).
 */
function put(group: GroupUniforms, matrix: Phaser.GameObjects.Components.TransformMatrix, x: number, y: number, radius: number,
    rim: number, light: ActiveLight, rimFrom: number): void {
    if (group.count >= MAX_LIGHTS) return;
    const i = group.count++;
    const k = i * 4;
    group.positions[k] = matrix.getX(x, y);
    group.positions[k + 1] = matrix.getY(x, y);
    group.positions[k + 2] = radius;
    group.positions[k + 3] = rim;
    group.colours[k] = light.rgb[0];
    group.colours[k + 1] = light.rgb[1];
    group.colours[k + 2] = light.rgb[2];
    group.colours[k + 3] = 1;
    group.rimOffsets[i * 2] = 0;
    group.rimOffsets[i * 2 + 1] = rimFrom;
    if (light.dirX === 0 && light.dirY === 0) {
        group.cones[k] = group.cones[k + 1] = 0;
        return;
    }
    const across = (light.dirX - light.dirY) * isoX() * GROUND_FALLOFF.x;
    const down = (light.dirX + light.dirY) * isoY() * GROUND_FALLOFF.y;
    const length = Math.hypot(across, down);
    group.cones[k] = across / length;
    group.cones[k + 1] = down / length;
    group.cones[k + 2] = light.cosInner;
    group.cones[k + 3] = light.cosOuter;
}

/**
 * Where the camera draws the world this frame (its position, zoom and shake):
 * Phaser keeps it out of its typings, but it's how the camera places every
 * object, so lights placed through it stay on what they light while it shakes.
 */
function cameraMatrix(camera: Phaser.Cameras.Scene2D.Camera): Phaser.GameObjects.Components.TransformMatrix {
    return (camera as unknown as { matrix: Phaser.GameObjects.Components.TransformMatrix }).matrix;
}

function groupUniforms(): GroupUniforms {
    return {
        ambient: new Float32Array(3),
        count: 0,
        positions: new Float32Array(MAX_LIGHTS * 4),
        colours: new Float32Array(MAX_LIGHTS * 4),
        rimOffsets: new Float32Array(MAX_LIGHTS * 2),
        cones: new Float32Array(MAX_LIGHTS * 4),
    };
}

/** The atmosphere pass's settings, from LIGHT (no sun rays or mist over the junction). */
function atmosphereLook(): AtmosphereLook {
    const look: AtmosphereLook = {
        bloomThreshold: 0, bloomStrength: 0, bloomSpread: 1, rayLength: 0, rayFade: 1, mist: 0, aberration: 0, tiltShift: 0, tiltFocus: 0,
        tiltBand: 0, exposure: 1, temperature: 0, saturation: 1, contrast: 1, vignette: 0, grain: 0, grainSize: 1, crt: 0, crtLineSize: 2, crtMask: 0,
    };
    copyLook(look);
    return look;
}

function copyLook(look: AtmosphereLook): void {
    look.bloomThreshold = LIGHT.BLOOM_THRESHOLD;
    look.bloomStrength = LIGHT.BLOOM_STRENGTH;
    look.bloomSpread = LIGHT.BLOOM_SPREAD;
    look.exposure = LIGHT.EXPOSURE;
    look.temperature = LIGHT.TEMPERATURE;
    look.saturation = LIGHT.SATURATION;
    look.contrast = LIGHT.CONTRAST;
    look.vignette = LIGHT.VIGNETTE;
    look.grain = LIGHT.GRAIN;
    look.grainSize = LIGHT.GRAIN_SIZE;
    look.aberration = LIGHT.ABERRATION;
    look.tiltShift = LIGHT.TILT_SHIFT;
    look.tiltFocus = LIGHT.TILT_FOCUS;
    look.tiltBand = LIGHT.TILT_BAND;
    look.crt = LIGHT.CRT;
    look.crtLineSize = LIGHT.CRT_LINE_SIZE;
    look.crtMask = LIGHT.CRT_MASK;
}
