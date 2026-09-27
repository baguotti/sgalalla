import Phaser from 'phaser';
import { DEFAULT_GHOST_STYLE, ghostStyle, type GhostStyle } from '../effects/GhostStyle';
import { Lighting, MAX_STAGE_LIGHTS, standardPlacement, type LightPlacement, type LitObject } from './Lighting';
import type { GameSceneData } from '../scenes/GameScene';
import {
    defaultStageStyle, STAGE_ELEMENT_IDS, STAGE_ELEMENTS, STAGE_SLOT,
    type ElementStyle, type LayeredStageStyle, type LondraLayers, type StageElementId, type StageOrderEntry,
} from '../stages/LondraLayers';
import { DEFAULT_LOOK, elementBehind, LAB_LIGHTS, LIGHT_LAYERS, NEW_LAMP, type LightDef, type LightLayer, type Look } from './Look';
import { CameraPanel } from './lab/CameraPanel';
import { applyRims, StageViewToggle, type LabContext } from './lab/LabContext';
import { LabStats } from './lab/LabStats';
import { colorToHex, type LabPanelBox } from './lab/LabUi';
import { LightsPanel } from './lab/LightsPanel';
import { StagePanel } from './lab/StagePanel';

/**
 * The Studio Lab's LOOK mode (see StudioLab): the lighting look on Fok and a
 * Fok dummy on Londra at dusk, drawn in layers (sky, clouds, island). Three
 * panels tune it: LIGHTS, CAMERA (post-processing) and STAGE (the layers and
 * the sky), with frame statistics top left. G switches the lights on and off;
 * rings on screen drag the lights and a square drags the selected layer.
 * Settings are kept in the browser between visits.
 */
export const LIGHT_LAB_SCENE_DATA: GameSceneData = {
    mode: 'training',
    lab: true,
    selectedMap: 'londra_bg',
    playerData: [
        { playerId: 0, joined: true, ready: true, input: { type: 'KEYBOARD', gamepadIndex: 0, keyboardMapping: 'all' }, character: 'fok' },
        { playerId: 1, joined: true, ready: true, input: { type: 'KEYBOARD', gamepadIndex: null }, character: 'fok', isAI: true, isTrainingDummy: true },
    ],
};

/** Behind the sky painting, where it doesn't reach. */
const DUSK_SKY = '#2b2742';
const STORAGE_KEY = 'sgalalla.lightLab';
/** Panel width plus the gap between panels (see LabUi). */
const PANEL_STEP = 338;

export interface LabScene {
    uiCamera: Phaser.Cameras.Scene2D.Camera;
    /** Everything behind the platforms: the painting, or the layers. */
    sky: readonly LitObject[];
    /** The stage's layers, which the STAGE panel tunes. */
    layers: LondraLayers | null;
    stage: readonly LitObject[];
    fighters: readonly LitObject[];
    /** Holds the camera on the whole stage instead of following the fighters, for placing lights. */
    setStageView(on: boolean): void;
    /** Right edge of the FPS panel on screen, 0 while hidden: the lab's statistics sit beside it. */
    statsLeftOf(): number;
}

/** The LOOK mode's lighting, and its panels and handles shown or hidden. */
export interface LookLab {
    lighting: Lighting;
    setShown(shown: boolean): void;
    /** The panels' columns in the windowed view. */
    columns: { left: LabPanelBox[]; right: LabPanelBox[] };
    /** Windowed, the statistics move to a strip above the game. */
    setWindowed(windowed: boolean): void;
}

/** Lights the lab and adds its panels, statistics, handles and keys. Null where lighting isn't supported. */
export function startLightLab(scene: Phaser.Scene, parts: LabScene): LookLab | null {
    if (!Lighting.isSupported(scene)) {
        console.warn('[Light lab] Lighting needs WebGL with OES_standard_derivatives');
        return null;
    }

    const saved = loadSettings();
    // Ghosts are drawn by the fighters in every match, from the shared style
    Object.assign(ghostStyle, saved.ghosts);
    const layers = parts.layers;
    if (layers) {
        Object.assign(layers.style, saved.stage);
        layers.redrawSky();
    }
    const lighting = new Lighting(scene, saved.lights, saved.look, [parts.uiCamera]);
    for (const object of parts.sky) lighting.add(object, 'sky');
    if (layers) {
        lighting.placement = layer => placementBehind(layers, layer);
        lighting.add(layers.sky, 'sky');
        for (const id of STAGE_ELEMENT_IDS) {
            if (id === 'sky') continue;
            for (const object of layers.objectsOf(id)) lighting.add(object, 'scenery');
        }
        applyRims(lighting, layers);
    }
    for (const object of parts.stage) lighting.add(object, 'stage');
    for (const object of parts.fighters) lighting.add(object, 'fighter');
    scene.cameras.main.setBackgroundColor(DUSK_SKY);

    const ctx: LabContext = {
        lighting,
        layers,
        save: () => saveSettings(lighting, layers),
        copy: () => copySettings(lighting, layers),
        stageView: new StageViewToggle(parts.setStageView),
        stageOrderChanged: () => lightsPanel.refreshLight(),
    };
    // Side by side along the right edge: stage, lights, camera
    const stagePanel = layers ? new StagePanel(ctx, layers, { top: 8, right: 8 }) : null;
    const lightsPanel = new LightsPanel(ctx, { top: 8, right: 8 + (layers ? PANEL_STEP : 0) });
    const cameraPanel = new CameraPanel(ctx, { top: 8, right: 8 + (layers ? 2 : 1) * PANEL_STEP });
    const panels = [lightsPanel, cameraPanel, ...(stagePanel ? [stagePanel] : [])];
    const stats = new LabStats(scene, lighting, scene.cameras.main, parts.statsLeftOf);

    const handles = new LightHandles(scene, lighting, parts.uiCamera, def => lightsPanel.select(def), def => lightsPanel.showPosition(def), ctx.save);
    const elementHandle = layers && stagePanel ? new ElementHandle(scene, layers, parts.uiCamera, () => stagePanel.refreshElement(), ctx.save) : null;
    let panelsShown = true;
    const onPostUpdate = () => {
        handles.update(lightsPanel.selected, panelsShown && lighting.isEnabled);
        elementHandle?.update(stagePanel?.selectedElement ?? null, panelsShown);
    };
    scene.events.on('postupdate', onPostUpdate);

    const toggleLights = () => lighting.setEnabled(!lighting.isEnabled);
    const keyboard = scene.input.keyboard;
    keyboard?.on('keydown-G', toggleLights);

    scene.events.once('shutdown', () => {
        keyboard?.off('keydown-G', toggleLights);
        scene.events.off('postupdate', onPostUpdate);
        stats.destroy();
        handles.destroy();
        elementHandle?.destroy();
        for (const panel of panels) panel.destroy();
    });
    return {
        lighting,
        columns: { left: [lightsPanel.box], right: [...(stagePanel ? [stagePanel.box] : []), cameraPanel.box] },
        setWindowed: windowed => stats.setWindowed(windowed),
        setShown: shown => {
            panelsShown = shown;
            for (const panel of panels) panel.setVisible(shown);
        },
    };
}

/** Lights behind an element sit at its depth and scroll with it. */
function placementBehind(layers: LondraLayers, layer: LightLayer): LightPlacement {
    const id = elementBehind(layer);
    if (!id || !(id in STAGE_ELEMENTS)) return standardPlacement(layer);
    const element = id as StageElementId;
    return { depth: layers.depthOf(element) - 1, scroll: layers.style.elements[element].parallax };
}

// ─── Settings kept in the browser ───

interface LabSettings {
    look: Look;
    lights: LightDef[];
    ghosts: GhostStyle;
    stage: LayeredStageStyle;
}

function defaultSettings(): LabSettings {
    return {
        look: { ...DEFAULT_LOOK },
        lights: LAB_LIGHTS.map(def => ({ ...def })),
        ghosts: { ...DEFAULT_GHOST_STYLE },
        stage: defaultStageStyle(),
    };
}

/** The saved settings over the defaults; anything missing or malformed keeps its default. */
function loadSettings(): LabSettings {
    const settings = defaultSettings();
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
        for (const key of Object.keys(settings.look) as (keyof Look)[]) {
            if (typeof saved?.look?.[key] === 'number') settings.look[key] = saved.look[key];
        }
        for (const key of Object.keys(settings.ghosts) as (keyof GhostStyle)[]) {
            if (typeof saved?.ghosts?.[key] === 'number') settings.ghosts[key] = saved.ghosts[key];
        }
        loadStageStyle(settings.stage, saved?.stage);
        if (Array.isArray(saved?.lights) && saved.lights.length > 0) {
            settings.lights = saved.lights.slice(0, MAX_STAGE_LIGHTS).map((light: Partial<LightDef>, i: number) => {
                const def: LightDef = { ...NEW_LAMP, x: 960, y: 540 };
                for (const key of Object.keys(def) as (keyof LightDef)[]) {
                    if (typeof light[key] === typeof def[key]) (def as unknown as Record<string, unknown>)[key] = light[key];
                }
                // Exactly one sun: the first light
                def.kind = i === 0 ? 'sun' : 'lamp';
                const behind = elementBehind(def.layer);
                if (!(def.layer in LIGHT_LAYERS) && !(behind && behind in STAGE_ELEMENTS)) def.layer = NEW_LAMP.layer;
                return def;
            });
        }
    } catch {
        // Browser storage unavailable or the saved settings unreadable: defaults
    }
    return settings;
}

/** The saved stage over the defaults in `style`: each setting kept only if it's the right type. */
function loadStageStyle(style: LayeredStageStyle, saved: Partial<LayeredStageStyle> | undefined): void {
    const order = saved?.order;
    const entries: readonly StageOrderEntry[] = [...STAGE_ELEMENT_IDS, STAGE_SLOT];
    if (Array.isArray(order) && order.length === entries.length && entries.every(entry => order.includes(entry))) {
        style.order = [...order];
    }
    for (const id of STAGE_ELEMENT_IDS) {
        const element = saved?.elements?.[id];
        for (const key of Object.keys(style.elements[id]) as (keyof ElementStyle)[]) {
            if (typeof element?.[key] === typeof style.elements[id][key]) (style.elements[id] as unknown as Record<string, unknown>)[key] = element![key];
        }
    }
    const sky = saved?.sky;
    if (Array.isArray(sky) && sky.length >= 2 && sky.every(stop => typeof stop?.at === 'number' && typeof stop?.color === 'number')) {
        style.sky = sky.map(stop => ({ at: stop.at, color: stop.color }));
    }
}

function saveSettings(lighting: Lighting, layers: LondraLayers | null): void {
    try {
        const stage = layers?.style ?? defaultStageStyle();
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ look: lighting.look, lights: lighting.stageLights, ghosts: ghostStyle, stage }));
    } catch {
        // Browser storage unavailable: settings last until the page reloads
    }
}

/** Every setting as JSON, colours as hex, on the clipboard and in the console. */
function copySettings(lighting: Lighting, layers: LondraLayers | null): void {
    const lights = lighting.stageLights.map(def => ({ ...def, color: colorToHex(def.color) }));
    const ghosts = { ...ghostStyle, color: colorToHex(ghostStyle.color) };
    const style = layers?.style;
    const stage = style ? { ...style, sky: style.sky.map(stop => ({ at: stop.at, color: colorToHex(stop.color) })) } : undefined;
    const json = JSON.stringify({ look: lighting.look, lights, ghosts, stage }, null, 4);
    console.log(json);
    navigator.clipboard?.writeText(json).catch(() => undefined);
}

// ─── Rings on screen for dragging lights ───

class LightHandles {
    private readonly scene: Phaser.Scene;
    private readonly lighting: Lighting;
    private readonly uiCamera: Phaser.Cameras.Scene2D.Camera;
    private readonly onSelect: (def: LightDef) => void;
    private readonly onMove: (def: LightDef) => void;
    private readonly onMoved: () => void;
    private readonly rings = new Map<LightDef, Phaser.GameObjects.Arc>();

    constructor(scene: Phaser.Scene, lighting: Lighting, uiCamera: Phaser.Cameras.Scene2D.Camera,
        onSelect: (def: LightDef) => void, onMove: (def: LightDef) => void, onMoved: () => void) {
        this.scene = scene;
        this.lighting = lighting;
        this.uiCamera = uiCamera;
        this.onSelect = onSelect;
        this.onMove = onMove;
        this.onMoved = onMoved;
    }

    /** One ring per stage light, the same size on screen at any zoom. Once per frame. */
    update(selected: LightDef | null, visible: boolean): void {
        const lights = this.lighting.stageLights;
        for (const [def, ring] of this.rings) {
            if (!lights.includes(def)) {
                ring.destroy();
                this.rings.delete(def);
            }
        }
        const scale = 1 / this.scene.cameras.main.zoom;
        for (const def of lights) {
            const ring = this.rings.get(def) ?? this.createRing(def);
            const isSelected = def === selected;
            ring.setPosition(def.x, def.y)
                // A light behind a layer scrolls with it
                .setScrollFactor(this.lighting.placement(def.layer).scroll)
                .setScale(scale)
                .setStrokeStyle(isSelected ? 5 : 3, isSelected ? 0xffffff : def.color)
                .setVisible(visible);
        }
    }

    destroy(): void {
        for (const ring of this.rings.values()) ring.destroy();
        this.rings.clear();
    }

    private createRing(def: LightDef): Phaser.GameObjects.Arc {
        const ring = this.scene.add.circle(def.x, def.y, def.kind === 'sun' ? 28 : 18)
            .setFillStyle(0x000000, 0.25)
            .setDepth(1000)
            .setInteractive({ draggable: true, useHandCursor: true });
        this.uiCamera.ignore(ring);
        ring.on('pointerdown', () => this.onSelect(def));
        dragBy(this.scene, ring, () => ({ x: def.x, y: def.y }), (x, y) => {
            def.x = Math.round(x);
            def.y = Math.round(y);
            this.onMove(def);
        }, this.onMoved);
        this.rings.set(def, ring);
        return ring;
    }
}

/**
 * Drags `object` by how far the pointer moves on screen, so it follows the
 * pointer at any scroll rate. `start` is read when the drag starts; `move` gets
 * the new position.
 */
function dragBy(scene: Phaser.Scene, object: Phaser.GameObjects.GameObject, start: () => { x: number; y: number },
    move: (x: number, y: number) => void, end: () => void): void {
    let from = { x: 0, y: 0, pointerX: 0, pointerY: 0 };
    object.on('dragstart', (pointer: Phaser.Input.Pointer) => {
        from = { ...start(), pointerX: pointer.x, pointerY: pointer.y };
    });
    object.on('drag', (pointer: Phaser.Input.Pointer) => {
        const zoom = scene.cameras.main.zoom;
        move(from.x + (pointer.x - from.pointerX) / zoom, from.y + (pointer.y - from.pointerY) / zoom);
    });
    object.on('dragend', end);
}

// ─── A square on screen for dragging the selected stage element ───

class ElementHandle {
    private readonly scene: Phaser.Scene;
    private readonly layers: LondraLayers;
    private readonly square: Phaser.GameObjects.Rectangle;
    private element: StageElementId | null = null;

    constructor(scene: Phaser.Scene, layers: LondraLayers, uiCamera: Phaser.Cameras.Scene2D.Camera, onMove: () => void, onMoved: () => void) {
        this.scene = scene;
        this.layers = layers;
        this.square = scene.add.rectangle(0, 0, 34, 34)
            .setFillStyle(0x000000, 0.3)
            .setStrokeStyle(4, 0x9ee6ff)
            .setDepth(1000)
            .setInteractive({ draggable: true, useHandCursor: true });
        uiCamera.ignore(this.square);
        dragBy(scene, this.square, () => {
            const style = this.element ? layers.style.elements[this.element] : null;
            return { x: style?.x ?? 0, y: style?.y ?? 0 };
        }, (x, y) => {
            if (!this.element) return;
            const style = layers.style.elements[this.element];
            // The sky only moves up and down
            if (this.element !== 'sky') style.x = Math.round(x);
            style.y = Math.round(y);
            onMove();
        }, onMoved);
    }

    /** On the selected element, the same size on screen at any zoom. Once per frame. */
    update(element: StageElementId | null, visible: boolean): void {
        this.element = element;
        if (!element || !visible) {
            this.square.setVisible(false);
            return;
        }
        const handle = this.layers.handleOf(element);
        this.square.setVisible(true)
            .setPosition(handle.x, handle.y)
            .setScrollFactor(handle.scrollX, handle.scrollY)
            .setScale(1 / this.scene.cameras.main.zoom);
    }

    destroy(): void {
        this.square.destroy();
    }
}
