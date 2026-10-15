import type { Lighting } from '../Lighting';
import { STAGE_ELEMENT_IDS, type LondraLayers } from '../../stages/LondraLayers';
import { checkbox } from './LabUi';

/** What the Studio Lab's panels share. */
export interface LabContext {
    lighting: Lighting;
    /** The layered stage, if the scene draws one. */
    layers: LondraLayers | null;
    /** Keeps the settings in the browser. */
    save(): void;
    /** Puts every setting on the clipboard (and the console) as JSON. */
    copy(): void;
    stageView: StageViewToggle;
    /** The stage's order changed: lights' "behind" choices follow it. */
    stageOrderChanged(): void;
}

/** The whole-stage view, with a checkbox in more than one panel kept in step. */
export class StageViewToggle {
    private on = false;
    private readonly inputs: HTMLInputElement[] = [];
    private readonly apply: (on: boolean) => void;

    constructor(apply: (on: boolean) => void) {
        this.apply = apply;
    }

    checkbox(text: string): HTMLElement {
        const node = checkbox(text, this.on, on => this.set(on));
        this.inputs.push(node.querySelector('input')!);
        return node;
    }

    private set(on: boolean): void {
        this.on = on;
        for (const input of this.inputs) input.checked = on;
        this.apply(on);
    }
}

/** Each scenery object's rim strength from its element's style. */
export function applyRims(lighting: Lighting, layers: LondraLayers): void {
    for (const id of STAGE_ELEMENT_IDS) {
        if (id === 'sky') continue;
        for (const object of layers.objectsOf(id)) lighting.setRim(object, layers.style.elements[id].rim);
    }
}
