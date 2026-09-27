import { DEFAULT_GHOST_STYLE, ghostStyle } from '../../effects/GhostStyle';
import { MAX_STAGE_LIGHTS } from '../Lighting';
import {
    behindLayer, DEFAULT_LOOK, LAB_LIGHTS, LIGHT_LAYERS, LIGHT_RANGES, LOOK_RANGES, LOOK_SECTIONS, NEW_LAMP,
    type LightDef, type LightLayer,
} from '../Look';
import { STAGE_ELEMENTS, STAGE_SLOT, type StageElementId } from '../../stages/LondraLayers';
import type { LabContext } from './LabContext';
import { button, buttons, checkbox, choice, colourRow, element, hint, LabPanelBox, openSections, section, slider } from './LabUi';

/** The look's sections this panel has; the camera's are in CameraPanel. */
const SECTIONS = ['AMBIENT', 'LIGHTS', 'FLASHES'];
/** Slider ranges for the ghosts' opacity and glow. */
const GHOST_RANGES = { opacity: [0, 1, 0.01], glow: [0, 4, 0.05] } as const;

/** The lights: pick, add and tune them; the ambient levels, flashes and attack ghosts. */
export class LightsPanel {
    selected: LightDef | null = null;
    private readonly ctx: LabContext;
    readonly box: LabPanelBox;
    private readonly lightList = document.createElement('select');
    private readonly lightEditor = element('div');
    private readonly lookEditor = element('div');
    private position: HTMLElement | null = null;

    constructor(ctx: LabContext, place: { top: number; left?: number; right?: number }) {
        this.ctx = ctx;
        this.box = new LabPanelBox('LIGHTS', place);

        this.lightList.addEventListener('change', () => {
            this.select(ctx.lighting.stageLights[Number(this.lightList.value)] ?? null);
            this.lightList.blur();
        });
        this.box.body.append(
            hint('G lights on / off · H hide the panels · drag the rings on screen to move lights'),
            ctx.stageView.checkbox('Whole stage view'),
            section('LIGHT', true,
                buttons(this.lightList, button('+ Lamp', () => this.addLamp()), button('Delete', () => this.removeSelected())),
                this.lightEditor),
            this.lookEditor,
        );
        this.box.footer.append(button('Copy settings', () => ctx.copy()), button('Reset panel', () => this.reset()));
        this.buildLookEditor();
        this.select(ctx.lighting.stageLights[0] ?? null);
    }

    get isVisible(): boolean {
        return this.box.isVisible;
    }

    setVisible(visible: boolean): void {
        this.box.setVisible(visible);
    }

    select(def: LightDef | null): void {
        this.selected = def;
        this.buildLightList();
        this.buildLightEditor();
    }

    /** The light's editor again, for new "behind" choices after the stage's order changed. */
    refreshLight(): void {
        this.buildLightEditor();
    }

    showPosition(def: LightDef): void {
        if (def === this.selected && this.position) this.position.textContent = `x ${def.x}  y ${def.y}`;
    }

    destroy(): void {
        this.box.destroy();
    }

    private buildLightList(): void {
        let lamp = 0;
        this.lightList.replaceChildren(...this.ctx.lighting.stageLights.map((def, i) => {
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
        const save = () => this.ctx.save();
        const fallback = this.defaultFor(def);
        this.position = hint(`x ${def.x}  y ${def.y}`);
        const visible = checkbox('Visible (off: lights the scene unseen)', def.visible, on => {
            def.visible = on;
            save();
        });
        const glow = choice('Glow', this.lightLayers(), def.layer, value => {
            def.layer = value;
            save();
        });
        const colour = colourRow('Colour', def.color, value => def.color = value, save, fallback.color);
        const sliders = (Object.keys(LIGHT_RANGES) as (keyof typeof LIGHT_RANGES)[])
            .map(key => slider(key, LIGHT_RANGES[key], def[key], value => def[key] = value, save, fallback[key]));
        this.lightEditor.replaceChildren(this.position, visible, glow, colour, ...sliders);
    }

    /** The light as the lab starts it: the rig's light in the same place in the list, or a new lamp. */
    private defaultFor(def: LightDef): Omit<LightDef, 'x' | 'y'> {
        const rig = LAB_LIGHTS[this.ctx.lighting.stageLights.indexOf(def)];
        return rig && rig.kind === def.kind ? rig : def.kind === 'sun' ? LAB_LIGHTS[0] : NEW_LAMP;
    }

    /** Where a light can glow: right behind each of the stage's elements, back to front, then the standard layers. */
    private lightLayers(): [LightLayer, string][] {
        const standard: [LightLayer, string][] = Object.entries(LIGHT_LAYERS);
        const layers = this.ctx.layers;
        if (!layers) return standard;
        const behind = layers.style.order
            .filter((entry): entry is StageElementId => entry !== STAGE_SLOT && entry !== 'sky')
            .map((id): [LightLayer, string] => [behindLayer(id), `behind the ${STAGE_ELEMENTS[id].label.toLowerCase()}`]);
        return [...behind, ...standard];
    }

    private buildLookEditor(): void {
        const look = this.ctx.lighting.look;
        const save = () => this.ctx.save();
        const open = openSections(this.lookEditor);
        const sections = LOOK_SECTIONS.filter(([title]) => SECTIONS.includes(title)).map(([title, keys]) => section(title, open.has(title),
            ...keys.map(key => slider(key, LOOK_RANGES[key], look[key], value => look[key] = value, save, DEFAULT_LOOK[key]))));
        const ghosts = section('GHOSTS', open.has('GHOSTS'),
            ...(Object.keys(GHOST_RANGES) as (keyof typeof GHOST_RANGES)[])
                .map(key => slider(key, GHOST_RANGES[key], ghostStyle[key], value => ghostStyle[key] = value, save, DEFAULT_GHOST_STYLE[key])),
            colourRow('Colour', ghostStyle.color, value => ghostStyle.color = value, save, DEFAULT_GHOST_STYLE.color),
            hint('New ghosts take the changes: do a heavy attack.'));
        this.lookEditor.replaceChildren(...sections, ghosts);
    }

    /** A new lamp in the middle of the view. */
    private addLamp(): void {
        const middle = this.ctx.lighting.camera.midPoint;
        const def: LightDef = { ...NEW_LAMP, x: Math.round(middle.x), y: Math.round(middle.y) };
        if (!this.ctx.lighting.addLight(def)) {
            window.alert(`At most ${MAX_STAGE_LIGHTS} lights.`);
            return;
        }
        this.select(def);
        this.ctx.save();
    }

    /** Lamps can go; the sun stays. */
    private removeSelected(): void {
        const def = this.selected;
        if (!def || def.kind === 'sun') return;
        this.ctx.lighting.removeLight(def);
        this.select(this.ctx.lighting.stageLights[0] ?? null);
        this.ctx.save();
    }

    /** This panel's settings back to the lab's defaults: the rig's lights, ambient, light strengths, flashes, ghosts. */
    private reset(): void {
        const { lighting } = this.ctx;
        for (const [title, keys] of LOOK_SECTIONS) {
            if (!SECTIONS.includes(title)) continue;
            for (const key of keys) lighting.look[key] = DEFAULT_LOOK[key];
        }
        Object.assign(ghostStyle, DEFAULT_GHOST_STYLE);
        for (const def of lighting.stageLights) lighting.removeLight(def);
        for (const def of LAB_LIGHTS) lighting.addLight({ ...def });
        this.buildLookEditor();
        this.select(lighting.stageLights[0] ?? null);
        this.ctx.save();
    }
}
