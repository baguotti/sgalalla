import Phaser from 'phaser';
import { DEFAULT_GHOST_STYLE, ghostStyle, type GhostStyle } from '../effects/GhostStyle';
import { Lighting, MAX_STAGE_LIGHTS, type LitObject } from './Lighting';
import type { GameSceneData } from '../scenes/GameScene';
import {
    DEFAULT_LOOK, LAB_LIGHTS, LIGHT_LAYERS, LIGHT_RANGES, LOOK_RANGES, LOOK_SECTIONS, NEW_LAMP,
    type LightDef, type LightLayer, type Look,
} from './Look';

/**
 * The Studio Lab (main menu), a test environment for the lighting look: Fok
 * and a Fok dummy on Londra at dusk. G switches the lights on and off; H shows
 * the panel, where the look and the lights are tuned, and rings on screen to
 * drag the lights. Settings are kept in the browser between visits.
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

export interface LabScene {
    uiCamera: Phaser.Cameras.Scene2D.Camera;
    sky: LitObject;
    stage: readonly LitObject[];
    fighters: readonly LitObject[];
    /** Holds the camera on the whole stage instead of following the fighters, for placing lights. */
    setStageView(on: boolean): void;
}

/** Lights the lab and adds its panel, light handles and keys. Null where lighting isn't supported. */
export function startLightLab(scene: Phaser.Scene, parts: LabScene): Lighting | null {
    if (!Lighting.isSupported(scene)) {
        console.warn('[Light lab] Lighting needs WebGL with OES_standard_derivatives');
        return null;
    }

    const saved = loadSettings();
    // Ghosts are drawn by the fighters in every match, from the shared style
    Object.assign(ghostStyle, saved.ghosts);
    const lighting = new Lighting(scene, saved.lights, saved.look, [parts.uiCamera]);
    lighting.add(parts.sky, 'sky');
    for (const object of parts.stage) lighting.add(object, 'stage');
    for (const object of parts.fighters) lighting.add(object, 'fighter');
    scene.cameras.main.setBackgroundColor(DUSK_SKY);

    const save = () => saveSettings(lighting);
    const handles = new LightHandles(scene, lighting, parts.uiCamera, def => panel.select(def), def => panel.showPosition(def), save);
    const panel = new LabPanel(lighting, parts.setStageView, save);
    const stats = new FrameStats(scene.game);

    const refreshStats = scene.time.addEvent({
        delay: 250,
        loop: true,
        callback: () => panel.setStats(`LIGHTS ${lighting.isEnabled ? 'ON' : 'OFF'}  ${stats.describe()}`),
    });
    const onPostUpdate = () => handles.update(panel.selected, panel.isVisible && lighting.isEnabled);
    scene.events.on('postupdate', onPostUpdate);

    const toggleLights = () => lighting.setEnabled(!lighting.isEnabled);
    const togglePanel = () => panel.toggle();
    const keyboard = scene.input.keyboard;
    keyboard?.on('keydown-G', toggleLights);
    keyboard?.on('keydown-H', togglePanel);

    scene.events.once('shutdown', () => {
        keyboard?.off('keydown-G', toggleLights);
        keyboard?.off('keydown-H', togglePanel);
        scene.events.off('postupdate', onPostUpdate);
        refreshStats.remove();
        stats.destroy();
        handles.destroy();
        panel.destroy();
    });
    return lighting;
}

// ─── Settings kept in the browser ───

interface LabSettings {
    look: Look;
    lights: LightDef[];
    ghosts: GhostStyle;
}

function defaultSettings(): LabSettings {
    return { look: { ...DEFAULT_LOOK }, lights: LAB_LIGHTS.map(def => ({ ...def })), ghosts: { ...DEFAULT_GHOST_STYLE } };
}

/** Slider ranges for the ghosts' opacity and glow. */
const GHOST_RANGES = { opacity: [0, 1, 0.01], glow: [0, 4, 0.05] } as const;

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
        if (Array.isArray(saved?.lights) && saved.lights.length > 0) {
            settings.lights = saved.lights.slice(0, MAX_STAGE_LIGHTS).map((light: Partial<LightDef>, i: number) => {
                const def: LightDef = { ...NEW_LAMP, x: 960, y: 540 };
                for (const key of Object.keys(def) as (keyof LightDef)[]) {
                    if (typeof light[key] === typeof def[key]) (def as unknown as Record<string, unknown>)[key] = light[key];
                }
                // Exactly one sun: the first light
                def.kind = i === 0 ? 'sun' : 'lamp';
                if (!(def.layer in LIGHT_LAYERS)) def.layer = NEW_LAMP.layer;
                return def;
            });
        }
    } catch {
        // Browser storage unavailable or the saved settings unreadable: defaults
    }
    return settings;
}

function saveSettings(lighting: Lighting): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ look: lighting.look, lights: lighting.stageLights, ghosts: ghostStyle }));
    } catch {
        // Browser storage unavailable: settings last until the page reloads
    }
}

function clearSettings(): void {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch {
        // Nothing saved to clear
    }
}

function colorToHex(color: number): string {
    return '#' + color.toString(16).padStart(6, '0');
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
        ring.on('drag', (_pointer: Phaser.Input.Pointer, x: number, y: number) => {
            def.x = Math.round(x);
            def.y = Math.round(y);
            this.onMove(def);
        });
        ring.on('dragend', () => this.onMoved());
        this.rings.set(def, ring);
        return ring;
    }
}

// ─── The panel ───

const STYLESHEET = `
.studio-lab { position: fixed; top: 8px; right: 8px; z-index: 1000; width: 360px; max-height: calc(100vh - 16px);
    overflow-y: auto; overflow-x: hidden; box-sizing: border-box; padding: 10px 12px; border-radius: 8px;
    background: rgba(16, 14, 28, 0.92); color: #e8e6f0; font: 12px/1.5 system-ui, sans-serif; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5); }
.studio-lab * { box-sizing: border-box; }
.studio-lab h1 { margin: 0; font-size: 13px; letter-spacing: 0.05em; }
.studio-lab .hint { color: #9a95b0; font-size: 11px; }
.studio-lab .stats { margin: 2px 0 8px; color: #9fe0a8; font: 11px monospace; }
.studio-lab details { border-top: 1px solid rgba(255, 255, 255, 0.1); padding: 4px 0; }
.studio-lab summary { cursor: pointer; padding: 3px 0; color: #b9a8ff; font-weight: 600; letter-spacing: 0.04em; }
.studio-lab .row { display: grid; grid-template-columns: 124px minmax(0, 1fr) 44px; gap: 8px; align-items: center; min-height: 22px; }
.studio-lab .row input[type=range] { width: 100%; margin: 0; }
.studio-lab .value { text-align: right; color: #c9c4dc; font-variant-numeric: tabular-nums; }
.studio-lab .buttons { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 4px 0; }
.studio-lab button, .studio-lab select { font: inherit; color: #e8e6f0; background: #2d2946; border: 1px solid #4a4470; border-radius: 4px; padding: 2px 8px; }
.studio-lab button:hover { background: #3a3560; }
.studio-lab label.check { display: flex; gap: 6px; align-items: center; margin: 3px 0; }
`;

/** Sliders for the look and the selected light; Copy puts everything on the clipboard (and the console) as JSON. */
class LabPanel {
    selected: LightDef | null = null;
    private readonly lighting: Lighting;
    private readonly save: () => void;
    private readonly root = document.createElement('div');
    private readonly stats = document.createElement('div');
    private readonly lightList = document.createElement('select');
    private readonly lightEditor = document.createElement('div');
    private readonly lookEditor = document.createElement('div');
    private position: HTMLElement | null = null;

    constructor(lighting: Lighting, setStageView: (on: boolean) => void, save: () => void) {
        this.lighting = lighting;
        this.save = save;
        this.root.className = 'studio-lab';
        this.stats.className = 'stats';
        const style = element('style', STYLESHEET);
        const title = element('h1', 'STUDIO LAB');
        const keys = hint('G: lights on / off  ·  H: hide this panel');
        const stageView = checkbox('Whole stage view, to place lights', false, setStageView);

        const add = button('+ Lamp', () => this.addLamp());
        const remove = button('Delete', () => this.removeSelected());
        this.lightList.addEventListener('change', () => {
            this.select(this.lighting.stageLights[Number(this.lightList.value)] ?? null);
            this.lightList.blur();
        });
        const lightRow = element('div');
        lightRow.className = 'buttons';
        lightRow.append(this.lightList, add, remove);
        const dragHint = hint('Drag the rings on screen to move lights.');

        const copy = button('Copy settings', () => this.copy());
        const reset = button('Reset all', () => this.reset());
        const bottom = element('div');
        bottom.className = 'buttons';
        bottom.append(copy, reset);

        this.root.append(
            style, title, keys, this.stats, stageView,
            section('LIGHT', true, lightRow, dragHint, this.lightEditor),
            this.lookEditor,
            bottom,
        );
        document.body.append(this.root);

        this.buildLookEditor();
        this.select(this.lighting.stageLights[0] ?? null);
    }

    get isVisible(): boolean {
        return this.root.style.display !== 'none';
    }

    select(def: LightDef | null): void {
        this.selected = def;
        this.buildLightList();
        this.buildLightEditor();
    }

    showPosition(def: LightDef): void {
        if (def === this.selected && this.position) this.position.textContent = `x ${def.x}  y ${def.y}`;
    }

    setStats(text: string): void {
        this.stats.textContent = text;
    }

    toggle(): void {
        this.root.style.display = this.isVisible ? 'none' : '';
    }

    destroy(): void {
        this.root.remove();
    }

    private buildLightList(): void {
        const lights = this.lighting.stageLights;
        let lamp = 0;
        this.lightList.replaceChildren(...lights.map((def, i) => {
            const option = element('option', def.kind === 'sun' ? 'Sun' : `Lamp ${++lamp}`) as HTMLOptionElement;
            option.value = String(i);
            option.selected = def === this.selected;
            return option;
        }));
    }

    private buildLightEditor(): void {
        const def = this.selected;
        this.position = null;
        if (!def) {
            this.lightEditor.replaceChildren();
            return;
        }

        const color = colorInput(def.color, value => def.color = value, this.save);
        this.position = hint(`x ${def.x}  y ${def.y}`);
        const colorRow = row('Colour', color);

        const visible = checkbox('Visible (off: lights the scene unseen)', def.visible, on => {
            def.visible = on;
            this.save();
        });
        const layer = document.createElement('select');
        layer.style.width = '100%';
        for (const [value, label] of Object.entries(LIGHT_LAYERS)) {
            const option = element('option', label) as HTMLOptionElement;
            option.value = value;
            option.selected = value === def.layer;
            layer.append(option);
        }
        layer.addEventListener('change', () => {
            def.layer = layer.value as LightLayer;
            this.save();
            layer.blur();
        });

        const rows = (Object.keys(LIGHT_RANGES) as (keyof typeof LIGHT_RANGES)[])
            .map(key => slider(key, LIGHT_RANGES[key], def[key], value => def[key] = value, this.save));
        this.lightEditor.replaceChildren(this.position, visible, row('Glow', layer), colorRow, ...rows);
    }

    private buildLookEditor(): void {
        const look = this.lighting.look;
        // Sections keep whether they're open when the editor is rebuilt
        const open = new Set([...this.lookEditor.querySelectorAll('details[open] > summary')].map(node => node.textContent));
        const first = this.lookEditor.childElementCount === 0;
        const color = colorInput(ghostStyle.color, value => ghostStyle.color = value, this.save);
        const ghosts = section('GHOSTS', open.has('GHOSTS'),
            ...(Object.keys(GHOST_RANGES) as (keyof typeof GHOST_RANGES)[])
                .map(key => slider(key, GHOST_RANGES[key], ghostStyle[key], value => ghostStyle[key] = value, this.save)),
            row('Colour', color),
            hint('New ghosts take the changes: do a heavy attack.'));
        this.lookEditor.replaceChildren(...LOOK_SECTIONS.map(([title, keys], i) => section(title, first ? i === 0 : open.has(title),
            ...keys.map(key => slider(key, LOOK_RANGES[key], look[key], value => look[key] = value, this.save)))), ghosts);
    }

    /** A new lamp in the middle of the view. */
    private addLamp(): void {
        const middle = this.lighting.camera.midPoint;
        const def: LightDef = { ...NEW_LAMP, x: Math.round(middle.x), y: Math.round(middle.y) };
        if (!this.lighting.addLight(def)) {
            window.alert(`At most ${MAX_STAGE_LIGHTS} lights.`);
            return;
        }
        this.select(def);
        this.save();
    }

    /** Lamps can go; the sun stays. */
    private removeSelected(): void {
        const def = this.selected;
        if (!def || def.kind === 'sun') return;
        this.lighting.removeLight(def);
        this.select(this.lighting.stageLights[0] ?? null);
        this.save();
    }

    private copy(): void {
        const lights = this.lighting.stageLights.map(def => ({ ...def, color: colorToHex(def.color) }));
        const ghosts = { ...ghostStyle, color: colorToHex(ghostStyle.color) };
        const json = JSON.stringify({ look: this.lighting.look, lights, ghosts }, null, 4);
        console.log(json);
        navigator.clipboard?.writeText(json).catch(() => undefined);
    }

    private reset(): void {
        const defaults = defaultSettings();
        Object.assign(this.lighting.look, defaults.look);
        Object.assign(ghostStyle, defaults.ghosts);
        for (const def of this.lighting.stageLights) this.lighting.removeLight(def);
        for (const def of defaults.lights) this.lighting.addLight(def);
        clearSettings();
        this.buildLookEditor();
        this.select(this.lighting.stageLights[0] ?? null);
    }
}

function element(tag: string, text = ''): HTMLElement {
    const node = document.createElement(tag);
    node.textContent = text;
    return node;
}

function hint(text: string): HTMLElement {
    const node = element('div', text);
    node.className = 'hint';
    return node;
}

function colorInput(initial: number, onInput: (color: number) => void, onChange: () => void): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'color';
    input.value = colorToHex(initial);
    input.addEventListener('input', () => onInput(parseInt(input.value.slice(1), 16)));
    input.addEventListener('change', () => {
        onChange();
        input.blur();
    });
    return input;
}

/** A section that folds away under its title. */
function section(title: string, open: boolean, ...children: HTMLElement[]): HTMLElement {
    const node = document.createElement('details');
    node.open = open;
    node.append(element('summary', title), ...children);
    return node;
}

/** A label, a control, and room for a value on the right. */
function row(label: string, control: HTMLElement, value = element('span')): HTMLElement {
    const node = element('label');
    node.className = 'row';
    value.className = 'value';
    node.append(element('span', label), control, value);
    return node;
}

/** `rimWidth` → `Rim width`. */
function labelFor(key: string): string {
    const words = key.replace(/([A-Z])/g, ' $1').toLowerCase();
    return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatValue(value: number, step: number): string {
    const decimals = step >= 1 ? 0 : Math.min(3, Math.ceil(-Math.log10(step)));
    return value.toFixed(decimals);
}

function checkbox(text: string, checked: boolean, onChange: (checked: boolean) => void): HTMLElement {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.addEventListener('change', () => {
        onChange(input.checked);
        input.blur();
    });
    const label = element('label', text);
    label.className = 'check';
    label.prepend(input);
    return label;
}

function button(text: string, onClick: () => void): HTMLButtonElement {
    const node = element('button', text) as HTMLButtonElement;
    node.addEventListener('click', () => {
        onClick();
        node.blur();
    });
    return node;
}

function slider(name: string, [min, max, step]: readonly number[], initial: number, onInput: (value: number) => void, onChange: () => void): HTMLElement {
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(initial);
    const value = element('span', formatValue(initial, step));
    input.addEventListener('input', () => {
        onInput(Number(input.value));
        value.textContent = formatValue(Number(input.value), step);
    });
    // Save, and hand the arrow keys back to the game
    input.addEventListener('change', () => {
        onChange();
        input.blur();
    });
    return row(labelFor(name), input, value);
}

// ─── Frame timing ───

/** Frame rate, and how long each frame's drawing takes on the CPU and, where the browser allows timing it, the GPU. */
class FrameStats {
    private readonly game: Phaser.Game;
    private readonly renderer: Phaser.Renderer.WebGL.WebGLRenderer;
    private readonly gpu: GpuTimer | null;
    private renderStart = 0;
    private cpuMs = 0;

    constructor(game: Phaser.Game) {
        this.game = game;
        this.renderer = game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
        this.gpu = GpuTimer.create(this.renderer.gl);
        this.renderer.on(Phaser.Renderer.Events.PRE_RENDER, this.onPreRender, this);
        this.renderer.on(Phaser.Renderer.Events.POST_RENDER, this.onPostRender, this);
    }

    describe(): string {
        const gpu = this.gpu ? `${this.gpu.ms.toFixed(2)} ms` : 'n/a';
        return `${this.game.loop.actualFps.toFixed(0)} FPS  draw CPU ${this.cpuMs.toFixed(2)} ms  GPU ${gpu}`;
    }

    destroy(): void {
        this.renderer.off(Phaser.Renderer.Events.PRE_RENDER, this.onPreRender, this);
        this.renderer.off(Phaser.Renderer.Events.POST_RENDER, this.onPostRender, this);
        this.gpu?.destroy();
    }

    private onPreRender(): void {
        this.renderStart = performance.now();
        this.gpu?.begin();
    }

    private onPostRender(): void {
        this.gpu?.end();
        this.cpuMs += (performance.now() - this.renderStart - this.cpuMs) * 0.1;
    }
}

/** The WebGL 1 timer query extension, where the browser offers it. */
interface TimerQueryExtension {
    TIME_ELAPSED_EXT: number;
    QUERY_RESULT_EXT: number;
    QUERY_RESULT_AVAILABLE_EXT: number;
    GPU_DISJOINT_EXT: number;
    createQueryEXT(): object;
    deleteQueryEXT(query: object): void;
    beginQueryEXT(target: number, query: object): void;
    endQueryEXT(target: number): void;
    getQueryObjectEXT(query: object, pname: number): number | boolean;
}

/** GPU time per frame, averaged. Results arrive a few frames late. */
class GpuTimer {
    ms = 0;
    private readonly gl: WebGLRenderingContext;
    private readonly ext: TimerQueryExtension;
    private active: object | null = null;
    private readonly pending: object[] = [];

    static create(gl: WebGLRenderingContext): GpuTimer | null {
        const ext = gl.getExtension('EXT_disjoint_timer_query') as TimerQueryExtension | null;
        return ext ? new GpuTimer(gl, ext) : null;
    }

    private constructor(gl: WebGLRenderingContext, ext: TimerQueryExtension) {
        this.gl = gl;
        this.ext = ext;
    }

    begin(): void {
        if (this.active) return;
        // A query whose result never comes (the tab was hidden, say) mustn't stop the timing
        if (this.pending.length > 4) this.ext.deleteQueryEXT(this.pending.shift()!);
        this.active = this.ext.createQueryEXT();
        this.ext.beginQueryEXT(this.ext.TIME_ELAPSED_EXT, this.active);
    }

    end(): void {
        if (!this.active) return;
        this.ext.endQueryEXT(this.ext.TIME_ELAPSED_EXT);
        this.pending.push(this.active);
        this.active = null;

        while (this.pending.length > 0) {
            const query = this.pending[0];
            if (!this.ext.getQueryObjectEXT(query, this.ext.QUERY_RESULT_AVAILABLE_EXT)) break;
            if (!this.gl.getParameter(this.ext.GPU_DISJOINT_EXT)) {
                const ms = Number(this.ext.getQueryObjectEXT(query, this.ext.QUERY_RESULT_EXT)) / 1e6;
                this.ms += (ms - this.ms) * 0.1;
            }
            this.ext.deleteQueryEXT(query);
            this.pending.shift();
        }
    }

    destroy(): void {
        if (this.active) {
            this.ext.endQueryEXT(this.ext.TIME_ELAPSED_EXT);
            this.pending.push(this.active);
            this.active = null;
        }
        for (const query of this.pending) this.ext.deleteQueryEXT(query);
        this.pending.length = 0;
    }
}
