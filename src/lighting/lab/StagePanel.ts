import {
    defaultStageStyle, STAGE_ELEMENTS, STAGE_SLOT,
    type LondraLayers, type StageElementId,
} from '../../stages/LondraLayers';
import { applyRims, type LabContext } from './LabContext';
import { button, buttons, checkbox, colourInput, colorToHex, element, hint, LabPanelBox, section, slider } from './LabUi';

/** Slider ranges for a stage element's settings; which ones an element has depends on its kind. */
const ELEMENT_RANGES = {
    x: [-2500, 2500, 5],
    y: [-2000, 2000, 5],
    scale: [0.2, 3, 0.01],
    parallax: [0, 1.5, 0.01],
    opacity: [0, 1, 0.01],
    rim: [0, 3, 0.05],
    drift: [-60, 60, 1],
} as const;
type ElementSetting = keyof typeof ELEMENT_RANGES;
const ELEMENT_SETTINGS: Record<'sky' | 'clouds' | 'image', readonly ElementSetting[]> = {
    sky: ['y', 'scale', 'parallax', 'opacity'],
    clouds: ['x', 'y', 'scale', 'parallax', 'opacity', 'rim', 'drift'],
    image: ['x', 'y', 'scale', 'parallax', 'opacity', 'rim'],
};
/** A sky colour's height: 0 the painting's top, 1 its bottom. */
const SKY_HEIGHT_RANGE = [-0.3, 1.3, 0.005] as const;

/** The layered stage: its elements' order, placement and look, and the sky's gradient. */
export class StagePanel {
    selectedElement: StageElementId | null;
    private readonly ctx: LabContext;
    private readonly layers: LondraLayers;
    private readonly box: LabPanelBox;
    private readonly defaults = defaultStageStyle();
    private readonly elementList = document.createElement('select');
    private readonly elementEditor = element('div');
    private readonly skyEditor = element('div');

    constructor(ctx: LabContext, layers: LondraLayers, place: { top: number; left?: number; right?: number }) {
        this.ctx = ctx;
        this.layers = layers;
        this.selectedElement = 'island';
        this.box = new LabPanelBox('STAGE', place);

        this.elementList.addEventListener('change', () => {
            this.selectedElement = this.elementList.value as StageElementId;
            this.elementList.blur();
            this.build();
        });
        this.box.body.append(
            ctx.stageView.checkbox('Whole stage view'),
            section('LAYERS', true,
                buttons(this.elementList, button('Send back', () => this.move(-1)), button('Bring forward', () => this.move(1))),
                hint('Front at the top, like layers in an image editor; above "Stage & fighters" is in front of them. Drag the square on screen to move the selected layer.'),
                this.elementEditor),
            section('SKY GRADIENT', false, this.skyEditor),
        );
        this.box.footer.append(button('Copy settings', () => ctx.copy()), button('Reset panel', () => this.reset()));
        this.build();
    }

    setVisible(visible: boolean): void {
        this.box.setVisible(visible);
    }

    /** The selected element moved on screen: its sliders follow. */
    refreshElement(): void {
        this.buildElementEditor();
    }

    destroy(): void {
        this.box.destroy();
    }

    private build(): void {
        this.elementList.replaceChildren(...[...this.layers.style.order].reverse().map(entry => {
            const isStage = entry === STAGE_SLOT;
            const option = element('option', isStage ? '— Stage & fighters —' : STAGE_ELEMENTS[entry].label) as HTMLOptionElement;
            option.value = entry;
            option.disabled = isStage;
            option.selected = entry === this.selectedElement;
            return option;
        }));
        this.buildElementEditor();
        this.buildSkyEditor();
    }

    private buildElementEditor(): void {
        const id = this.selectedElement;
        if (!id) {
            this.elementEditor.replaceChildren();
            return;
        }
        const save = () => this.ctx.save();
        const style = this.layers.style.elements[id];
        const fallback = this.defaults.elements[id];
        const visible = checkbox('Visible', style.visible, on => {
            style.visible = on;
            save();
        });
        const sliders = ELEMENT_SETTINGS[STAGE_ELEMENTS[id].kind].map(key => slider(key, ELEMENT_RANGES[key], style[key], value => {
            style[key] = value;
            if (key === 'rim') applyRims(this.ctx.lighting, this.layers);
        }, save, fallback[key]));
        this.elementEditor.replaceChildren(visible, ...sliders);
    }

    /** Moves the selected element one place back (-1) or forward (1); stepping over the platforms and fighters puts it in front of them or back behind. */
    private move(step: -1 | 1): void {
        const id = this.selectedElement;
        if (!id) return;
        const order = this.layers.style.order;
        const from = order.indexOf(id);
        const to = from + step;
        if (to < 0 || to >= order.length) return;
        [order[from], order[to]] = [order[to], order[from]];
        this.build();
        this.ctx.stageOrderChanged();
        this.ctx.save();
    }

    /** The sky's colours top to bottom, each with its height; ↺ gives the default gradient's colour at the same place. */
    private buildSkyEditor(): void {
        const layers = this.layers;
        const stops = layers.style.sky;
        stops.sort((a, b) => a.at - b.at);
        const save = () => this.ctx.save();
        const blocks = stops.map((stop, i) => {
            const fallback = this.defaults.sky[i];
            const colour = colourInput(stop.color, value => {
                stop.color = value;
                layers.redrawSky();
            }, save);
            const resetColour = button('↺', () => {
                if (!fallback) return;
                stop.color = fallback.color;
                colour.value = colorToHex(fallback.color);
                layers.redrawSky();
                save();
            });
            resetColour.className = 'reset';
            resetColour.disabled = !fallback;
            resetColour.title = 'Back to the default';
            const remove = button('×', () => {
                if (stops.length <= 2) return;
                stops.splice(stops.indexOf(stop), 1);
                layers.redrawSky();
                this.buildSkyEditor();
                save();
            });
            remove.disabled = stops.length <= 2;
            remove.title = 'Remove this colour';
            const height = slider('height', SKY_HEIGHT_RANGE, stop.at, value => {
                stop.at = value;
                layers.redrawSky();
            }, () => {
                save();
                this.buildSkyEditor();
            }, fallback?.at);
            const top = buttons(colour, resetColour, remove);
            top.style.display = 'grid';
            top.style.gridTemplateColumns = 'minmax(0, 1fr) 18px 24px';
            const block = element('div');
            block.className = 'stop';
            block.append(top, height);
            return block;
        });
        const add = button('+ Colour', () => {
            // Halfway down the biggest gap between two colours, in their mix
            let at = 0.5;
            let color = stops[0]?.color ?? 0xffffff;
            let widest = -1;
            for (let i = 0; i + 1 < stops.length; i++) {
                const gap = stops[i + 1].at - stops[i].at;
                if (gap > widest) {
                    widest = gap;
                    at = (stops[i].at + stops[i + 1].at) / 2;
                    color = mixColors(stops[i].color, stops[i + 1].color);
                }
            }
            stops.push({ at, color });
            layers.redrawSky();
            this.buildSkyEditor();
            save();
        });
        this.skyEditor.replaceChildren(hint('Top to bottom. Height: 0 is the top of the old painting, 1 its bottom.'), ...blocks, add);
    }

    private reset(): void {
        Object.assign(this.layers.style, defaultStageStyle());
        this.layers.redrawSky();
        applyRims(this.ctx.lighting, this.layers);
        this.build();
        this.ctx.stageOrderChanged();
        this.ctx.save();
    }
}

/** Halfway between two colours. */
function mixColors(a: number, b: number): number {
    let mixed = 0;
    for (const shift of [16, 8, 0]) mixed |= Math.round((((a >> shift) & 0xff) + ((b >> shift) & 0xff)) / 2) << shift;
    return mixed;
}
