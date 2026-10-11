import Phaser from 'phaser';
import { AtmospherePipeline, type AtmosphereFrame } from './AtmospherePipeline';
import { LitPipeline, MAX_LIGHTS } from './LitPipeline';
import { FLASH_COLORS, type FlashKind, type LightDef, type LightLayer, type Look } from './Look';

/**
 * Which lit shader an object uses. The sky only sees lights that reach it and
 * gets no rim; scenery (a layered stage's island and clouds) is lit like the
 * sky, but lights outline it, and lights behind it outline its silhouette.
 */
export type LitGroup = 'sky' | 'scenery' | 'stage' | 'fighter';

/** Anything with a texture that can take a pipeline: images, sprites, tile sprites. */
export type LitObject = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Pipeline;

/** Stage lights at most, leaving room for flashes. */
export const MAX_STAGE_LIGHTS = MAX_LIGHTS - 2;

const GROUPS: readonly LitGroup[] = ['sky', 'scenery', 'stage', 'fighter'];
const PIPELINE_KEYS: Record<LitGroup, string> = { sky: 'LitSky', scenery: 'LitScenery', stage: 'LitStage', fighter: 'LitFighter' };
const ATMOSPHERE_KEY = 'Atmosphere';
/** Colour of each group's ambient light: dusk blues and violets. */
const AMBIENT_TINTS: Record<LitGroup, readonly number[]> = {
    sky: [0.8, 0.72, 0.95],
    scenery: [0.8, 0.72, 0.95],
    stage: [0.72, 0.74, 1],
    fighter: [0.82, 0.82, 1],
};
/** Rays start from the sky within this many screen heights of the sun, at zoom 1. */
const SUN_REACH = 0.35;
/** A light's glow reaches this share of its radius. */
const HALO_SIZE = 0.6;
const ORB_TEXTURE = 'light_orb';
const HALO_TEXTURE = 'light_halo';
const TEXTURE_SIZE = 256;
/** Where a light's orb and glow are drawn, and how fast they scroll with the camera. */
export interface LightPlacement {
    depth: number;
    scroll: number;
}

/** In front of the background (-100 and below), the platforms (0) or the fighters (10), scrolling with the stage. */
const PLACEMENTS: Record<string, LightPlacement> = {
    back: { depth: -50, scroll: 1 },
    stage: { depth: 5, scroll: 1 },
    front: { depth: 50, scroll: 1 },
};

/** The standard layers; anything else falls back to behind the stage. */
export function standardPlacement(layer: LightLayer): LightPlacement {
    return PLACEMENTS[layer] ?? PLACEMENTS.back;
}

interface Light {
    def: LightDef;
    /** Brightness this frame, from flicker or what's left of a flash. */
    intensity: number;
    peak: number;
    /** Flashes fade out over their life; stage lights have none. */
    lifeMs: number;
    ageMs: number;
    /** Stage lights' orb and glow, hidden while not visible. */
    orb: Phaser.GameObjects.Image | null;
    halo: Phaser.GameObjects.Image | null;
}

/** One lit shader's lights this frame, in its uniform layout. */
interface GroupLights {
    ambient: Float32Array;
    count: number;
    positions: Float32Array;
    colors: Float32Array;
}

/**
 * The lights of one scene, the stage's own plus short flashes from match
 * events, drawn by lit shaders on the sky, stage and fighters and by the
 * camera's atmosphere pass. Purely visual: switched off, the scene looks as
 * it always did. Stage lights are read every frame, so they can be edited
 * while the scene runs.
 */
export class Lighting {
    readonly look: Look;
    readonly camera: Phaser.Cameras.Scene2D.Camera;
    private readonly scene: Phaser.Scene;
    private readonly renderer: Phaser.Renderer.WebGL.WebGLRenderer;
    private readonly hideFrom: readonly Phaser.Cameras.Scene2D.Camera[];
    private readonly lights: Light[] = [];
    private readonly lit = new Map<LitObject, LitGroup>();
    private readonly pipelines: Record<LitGroup, LitPipeline>;
    private readonly groups: Record<LitGroup, GroupLights>;
    private readonly atmosphere: AtmospherePipeline;
    private readonly frame: AtmosphereFrame;
    /** Depth of each light handed to the scenery shader this frame, in its order. */
    private readonly sceneryDepths = new Float32Array(MAX_LIGHTS);
    private enabled = true;
    private timeMs = 0;
    /** Where each layer puts a light; a layered stage adds its `behind:` layers. */
    placement: (layer: LightLayer) => LightPlacement = standardPlacement;

    /** Lighting needs WebGL with shader derivatives, which nearly every browser has. */
    static isSupported(scene: Phaser.Scene): boolean {
        const renderer = scene.renderer;
        return renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer && renderer.getExtension('OES_standard_derivatives') !== null;
    }

    /** Lights the scene's main camera; orbs and glows drawn at the lights are hidden from the `hideFrom` cameras. */
    constructor(scene: Phaser.Scene, lights: readonly LightDef[], look: Look, hideFrom: readonly Phaser.Cameras.Scene2D.Camera[]) {
        this.scene = scene;
        this.camera = scene.cameras.main;
        this.look = look;
        this.hideFrom = hideFrom;
        this.renderer = scene.renderer as Phaser.Renderer.WebGL.WebGLRenderer;

        const manager = this.renderer.pipelines;
        for (const group of GROUPS) {
            if (!manager.has(PIPELINE_KEYS[group])) manager.add(PIPELINE_KEYS[group], new LitPipeline(scene.game));
        }
        this.pipelines = {
            sky: manager.get(PIPELINE_KEYS.sky) as LitPipeline,
            scenery: manager.get(PIPELINE_KEYS.scenery) as LitPipeline,
            stage: manager.get(PIPELINE_KEYS.stage) as LitPipeline,
            fighter: manager.get(PIPELINE_KEYS.fighter) as LitPipeline,
        };
        this.groups = { sky: groupLights(), scenery: groupLights(), stage: groupLights(), fighter: groupLights() };

        this.frame = { look, sunX: 0, sunY: 0, sunReach: SUN_REACH, rayColor: [0, 0, 0], worldBottom: 0, worldHeight: 1 };
        if (!manager.postPipelineClasses.has(ATMOSPHERE_KEY)) manager.addPostPipeline(ATMOSPHERE_KEY, AtmospherePipeline);
        this.camera.setPostPipeline(ATMOSPHERE_KEY);
        this.atmosphere = this.camera.getPostPipeline(ATMOSPHERE_KEY) as AtmospherePipeline;
        this.atmosphere.frame = this.frame;

        createGlowTextures(scene);
        for (const def of lights) this.addLight(def);

        this.renderer.on(Phaser.Renderer.Events.RENDER, this.onRender, this);
    }

    get isEnabled(): boolean {
        return this.enabled;
    }

    /** Objects drawn lit, and flashes lighting the scene right now: for the Studio Lab's stats. */
    get litCount(): number {
        return this.lit.size;
    }

    get flashCount(): number {
        return this.lights.filter(light => light.lifeMs > 0).length;
    }

    /** The stage's lights, in the order they were added. */
    get stageLights(): LightDef[] {
        return this.lights.filter(light => light.lifeMs === 0).map(light => light.def);
    }

    /** Draws `object` lit, with its group's ambient level and rim. */
    add(object: LitObject, group: LitGroup): void {
        this.lit.set(object, group);
        // Nothing lights a platform's underside through it, as with fighters' feet
        if (group === 'stage') this.pipelines.stage.setFloorContact(object, 1);
        if (this.enabled) object.setPipeline(PIPELINE_KEYS[group]);
    }

    /** How strongly lights outline a scenery object. */
    setRim(object: LitObject, rim: number): void {
        this.pipelines.scenery.setObjectRim(object, rim);
    }

    /** A fighter standing on the floor gets no rim on its soles. */
    setGrounded(object: LitObject, grounded: boolean): void {
        this.pipelines.fighter.setFloorContact(object, grounded ? 1 : 0);
    }

    /** Adds a stage light, drawn from `def` as it changes. False when there's no room for another. */
    addLight(def: LightDef): boolean {
        if (this.stageLights.length >= MAX_STAGE_LIGHTS) return false;
        const orb = this.glowImage(ORB_TEXTURE);
        const halo = this.glowImage(HALO_TEXTURE);
        // Stage lights go before any flashes, so flashes are the ones dropped when slots run out
        const firstFlash = this.lights.findIndex(light => light.lifeMs > 0);
        const light: Light = { def, intensity: 1, peak: 1, lifeMs: 0, ageMs: 0, orb, halo };
        this.lights.splice(firstFlash < 0 ? this.lights.length : firstFlash, 0, light);
        this.updateGlow(light);
        return true;
    }

    removeLight(def: LightDef): void {
        const index = this.lights.findIndex(light => light.def === def);
        if (index < 0) return;
        this.lights[index].orb?.destroy();
        this.lights[index].halo?.destroy();
        this.lights.splice(index, 1);
    }

    /** A short burst of light, fading out, as strong, wide and long as the look says. */
    flash(kind: FlashKind, x: number, y: number): void {
        const look = this.look;
        const [intensity, radius, durationMs] =
            kind === 'hit' ? [look.hitFlash, look.hitFlashRadius, look.hitFlashTime]
            : kind === 'ko' ? [look.koFlash, look.koFlashRadius, look.koFlashTime]
            : [look.respawnFlash, look.respawnFlashRadius, look.respawnFlashTime];
        if (intensity <= 0) return;
        // Makes way for newer flashes when all light slots are taken
        if (this.lights.length >= MAX_LIGHTS) {
            const oldest = this.lights.findIndex(light => light.lifeMs > 0);
            if (oldest < 0) return;
            this.lights.splice(oldest, 1);
        }
        const def: LightDef = {
            kind: 'lamp', x, y, color: FLASH_COLORS[kind], radius, fill: 1, rim: 1, sky: 0, halo: 0, orb: 0, flicker: 0, visible: false, layer: 'front',
        };
        this.lights.push({ def, intensity, peak: intensity, lifeMs: durationMs, ageMs: 0, orb: null, halo: null });
    }

    /** Flicker and fading flashes. Once per drawn frame. */
    update(deltaMs: number): void {
        this.timeMs += deltaMs;
        const seconds = this.timeMs / 1000;

        for (let i = this.lights.length - 1; i >= 0; i--) {
            const light = this.lights[i];
            const def = light.def;
            if (light.lifeMs > 0) {
                light.ageMs += deltaMs;
                if (light.ageMs >= light.lifeMs) {
                    this.lights.splice(i, 1);
                    continue;
                }
                const left = 1 - light.ageMs / light.lifeMs;
                light.intensity = light.peak * left * left;
            } else if (def.flicker > 0) {
                const wobble = 0.6 * Math.sin(seconds * 11.3 + i * 1.7) + 0.4 * Math.sin(seconds * 23.9 + i * 4.1);
                light.intensity = 1 + def.flicker * wobble;
            } else {
                light.intensity = 1;
            }
            this.updateGlow(light);
        }
    }

    /** Off, everything is drawn as it was before lighting. */
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        for (const [object, group] of this.lit) {
            if (enabled) object.setPipeline(PIPELINE_KEYS[group]);
            else object.resetPipeline();
        }
        this.atmosphere.active = enabled;
        for (const light of this.lights) this.updateGlow(light);
    }

    destroy(): void {
        this.renderer.off(Phaser.Renderer.Events.RENDER, this.onRender, this);
        this.atmosphere.frame = null;
        this.camera.removePostPipeline(this.atmosphere);
        for (const light of this.lights) {
            light.orb?.destroy();
            light.halo?.destroy();
        }
        this.lights.length = 0;
        this.lit.clear();
    }

    private strength(def: LightDef): number {
        return def.kind === 'sun' ? this.look.sun : this.look.lamps;
    }

    private glowImage(texture: string): Phaser.GameObjects.Image {
        const image = this.scene.add.image(0, 0, texture).setBlendMode(Phaser.BlendModes.ADD);
        for (const camera of this.hideFrom) camera.ignore(image);
        return image;
    }

    /** The orb and the glow follow the light's settings. */
    private updateGlow(light: Light): void {
        const { def, orb, halo } = light;
        if (!orb || !halo) return;
        const visible = this.enabled && def.visible;
        const brightness = light.intensity * this.strength(def);
        const { depth, scroll } = this.placement(def.layer);
        if (orb.depth !== depth) orb.setDepth(depth);
        if (halo.depth !== depth) halo.setDepth(depth);
        orb.setScrollFactor(scroll);
        halo.setScrollFactor(scroll);
        orb.setPosition(def.x, def.y)
            .setTint(def.color)
            .setScale(def.orb)
            .setAlpha(Math.min(1, brightness))
            .setVisible(visible && def.orb > 0);
        halo.setPosition(def.x, def.y)
            .setTint(def.color)
            .setScale(2 * def.radius * HALO_SIZE / TEXTURE_SIZE)
            .setAlpha(Math.min(1, brightness * def.halo * this.look.haze))
            .setVisible(visible && def.halo > 0);
    }

    /** Places the lights on screen for this frame's camera and hands them to the shaders. */
    private onRender(_scene: Phaser.Scene, camera: Phaser.Cameras.Scene2D.Camera): void {
        if (camera !== this.camera || !this.enabled) return;

        const look = this.look;
        const frame = this.frame;
        const { zoom, width, height } = camera;
        const originX = width * camera.originX;
        const originY = height * camera.originY;
        for (const group of GROUPS) this.groups[group].count = 0;
        frame.rayColor[0] = frame.rayColor[1] = frame.rayColor[2] = 0;
        let sunFound = false;

        for (const light of this.lights) {
            const def = light.def;
            const strength = light.intensity * this.strength(def);
            if (strength <= 0) continue;

            // Where Phaser would draw an object at the light
            const placement = this.placement(def.layer);
            const x = camera.x + originX + (def.x - camera.scrollX * placement.scroll - originX) * zoom;
            const y = camera.y + originY + (def.y - camera.scrollY * placement.scroll - originY) * zoom;
            const radius = def.radius * zoom;
            const r = ((def.color >> 16) & 0xff) / 255 * strength;
            const g = ((def.color >> 8) & 0xff) / 255 * strength;
            const b = (def.color & 0xff) / 255 * strength;

            for (const group of GROUPS) {
                const fill = group === 'sky' || group === 'scenery' ? def.sky : def.fill;
                const rim = group === 'fighter' ? def.rim * look.rimStrength
                    : group === 'stage' ? def.rim * look.stageRim
                    : group === 'scenery' ? def.rim : 0;
                const lights = this.groups[group];
                if (lights.count === MAX_LIGHTS || (fill <= 0 && rim <= 0)) continue;
                if (group === 'scenery') this.sceneryDepths[lights.count] = placement.depth;
                const k = lights.count * 4;
                lights.positions[k] = x;
                lights.positions[k + 1] = y;
                lights.positions[k + 2] = radius;
                lights.positions[k + 3] = rim;
                lights.colors[k] = r;
                lights.colors[k + 1] = g;
                lights.colors[k + 2] = b;
                lights.colors[k + 3] = fill;
                lights.count++;
            }

            // The atmosphere pass works in texture coordinates, y up
            if (def.kind === 'sun' && !sunFound) {
                sunFound = true;
                frame.sunX = x / width;
                frame.sunY = 1 - y / height;
                frame.sunReach = SUN_REACH * zoom;
                frame.rayColor[0] = r * look.rays;
                frame.rayColor[1] = g * look.rays;
                frame.rayColor[2] = b * look.rays;
            }
        }

        for (const group of GROUPS) {
            const lights = this.groups[group];
            const tint = AMBIENT_TINTS[group];
            const level = group === 'sky' || group === 'scenery' ? look.skyAmbient : group === 'stage' ? look.stageAmbient : look.fighterAmbient;
            for (let c = 0; c < 3; c++) lights.ambient[c] = tint[c] * level;
            const rimWidth = group === 'sky' ? 0 : look.rimWidth;
            this.pipelines[group].setLights(lights.ambient, lights.count, lights.positions, lights.colors, rimWidth);
        }

        // Lights drawn behind a scenery object light its silhouette, not its face
        const scenery = this.groups.scenery;
        for (const [object, group] of this.lit) {
            if (group !== 'scenery') continue;
            const depth = (object as LitObject & Phaser.GameObjects.Components.Depth).depth;
            let mask = 0;
            for (let k = 0; k < scenery.count; k++) {
                if (this.sceneryDepths[k] < depth) mask |= 1 << k;
            }
            this.pipelines.scenery.setBehind(object, mask);
        }

        frame.worldBottom = camera.worldView.bottom;
        frame.worldHeight = camera.worldView.height;
    }
}

function groupLights(): GroupLights {
    return { ambient: new Float32Array(3), count: 0, positions: new Float32Array(MAX_LIGHTS * 4), colors: new Float32Array(MAX_LIGHTS * 4) };
}

/** White discs tinted per light: a bright orb with a hot centre, and a soft glow fading out to its edge. */
function createGlowTextures(scene: Phaser.Scene): void {
    radialTexture(scene, ORB_TEXTURE, [[0, 1], [0.12, 0.95], [0.35, 0.3], [1, 0]]);
    radialTexture(scene, HALO_TEXTURE, [[0, 1], [0.25, 0.42], [0.5, 0.125], [0.75, 0.016], [1, 0]]);
}

function radialTexture(scene: Phaser.Scene, key: string, stops: readonly [number, number][]): void {
    if (scene.textures.exists(key)) return;
    const texture = scene.textures.createCanvas(key, TEXTURE_SIZE, TEXTURE_SIZE);
    if (!texture) return;
    const context = texture.getContext();
    const middle = TEXTURE_SIZE / 2;
    const gradient = context.createRadialGradient(middle, middle, 0, middle, middle, middle);
    for (const [offset, alpha] of stops) gradient.addColorStop(offset, `rgba(255, 255, 255, ${alpha})`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    texture.refresh();
}
